import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import type { BatchValidationError } from "@/domains/product/types";
import { INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT } from "@/domains/product/inventory-mirror-state";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import {
  batchCreateGmItems,
  batchDiscontinueItems,
  batchHardDeleteItems,
  batchUpdateItems,
  validateBatchCreateAgainstPrism,
  validateBatchUpdateAgainstPrism,
} from "@/domains/product/prism-batch";
import { hasTransactionHistory } from "@/domains/product/prism-delete";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_LOCATION_ABBREV_BY_ID } from "@/domains/product/location-filters";
import type { ProductLocationId } from "@/domains/product/types";
import {
  getInventoryMirrorSnapshotRows,
  getInventoryPatches,
  getItemSnapshot,
  normalizeUpdaterInput,
} from "@/domains/product/prism-updates";
import {
  buildInventoryMirrorPayload,
  buildProductMirrorPayload,
  getMissingInventoryMirrorLocationIds,
} from "@/domains/product/mirror-payloads";

export const dynamic = "force-dynamic";

type MirrorError = {
  sku: number;
  message: string;
};

type BatchUpdateMirrorRow = {
  sku: number;
  patch: Record<string, unknown>;
  isTextbook?: boolean;
};

function getSupabaseErrorMessage(
  result: { error?: { message?: string | null } | null } | null | undefined,
  fallback: string,
): string | null {
  const message = result?.error?.message;
  return typeof message === "string" && message.length > 0 ? message : (result?.error ? fallback : null);
}

function formatInventoryMirrorLocationList(locationIds: ProductLocationId[]): string {
  return locationIds
    .map((locationId) => PRODUCT_LOCATION_ABBREV_BY_ID[locationId] ?? `Location ${locationId}`)
    .join(", ");
}

function formatInventoryMirrorMissingMessage(
  sku: number,
  locationIds: ProductLocationId[],
): string {
  return `Inventory mirror snapshot for SKU ${sku} omitted ${formatInventoryMirrorLocationList(locationIds)}; browse data may stay stale until the next sync.`;
}

async function invalidateMissingInventoryMirrorRows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  sku: number,
  locationIds: ProductLocationId[],
): Promise<string | null> {
  if (locationIds.length === 0) {
    return null;
  }

  const invalidateResult = await supabase
    .from("product_inventory")
    .update({
      synced_at: INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT,
    })
    .eq("sku", sku)
    .in("location_id", locationIds);
  return getSupabaseErrorMessage(
    invalidateResult,
    `Failed to invalidate stale product_inventory rows for SKU ${sku}`,
  );
}

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex] as T, currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function collectBatchUpdateMirrorWarnings(
  rows: readonly BatchUpdateMirrorRow[],
): Promise<MirrorError[]> {
  if (rows.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const mirrorResults = await mapWithConcurrencyLimit(rows, 4, async (row) => {
    const rowErrors: string[] = [];

    try {
      const snapshot = await getItemSnapshot(row.sku, 2);
      const productMirrorResult = await supabase.from("products").upsert(
        buildProductMirrorPayload(row.sku, row.patch, snapshot, !!row.isTextbook),
      );
      const productMirrorError = getSupabaseErrorMessage(
        productMirrorResult,
        `Failed to mirror products row for SKU ${row.sku}`,
      );
      if (productMirrorError) {
        rowErrors.push(productMirrorError);
      }
    } catch (productMirrorErr) {
      rowErrors.push(
        productMirrorErr instanceof Error ? productMirrorErr.message : String(productMirrorErr),
      );
      console.warn(`[batch update] products mirror failed for SKU ${row.sku}:`, productMirrorErr);
    }

    try {
      const touchedLocationIds = Array.from(new Set(
        getInventoryPatches(normalizeUpdaterInput(row.patch)).map(
          (entry) => entry.locationId,
        ),
      ));
      const inventoryMirrorRows = await getInventoryMirrorSnapshotRows(row.sku, touchedLocationIds);
      const missingLocationIds = getMissingInventoryMirrorLocationIds(
        touchedLocationIds,
        inventoryMirrorRows,
      );
      const inventoryRows = buildInventoryMirrorPayload(row.sku, inventoryMirrorRows);
      if (inventoryRows.length > 0) {
        const inventoryMirrorResult = await supabase.from("product_inventory").upsert(inventoryRows, {
          onConflict: "sku,location_id",
        });
        const inventoryMirrorError = getSupabaseErrorMessage(
          inventoryMirrorResult,
          `Failed to mirror product_inventory rows for SKU ${row.sku}`,
        );
        if (inventoryMirrorError) {
          rowErrors.push(inventoryMirrorError);
        }
      }
      if (missingLocationIds.length > 0) {
        rowErrors.push(formatInventoryMirrorMissingMessage(row.sku, missingLocationIds));
        const inventoryInvalidateError = await invalidateMissingInventoryMirrorRows(
          supabase,
          row.sku,
          missingLocationIds,
        );
        if (inventoryInvalidateError) {
          rowErrors.push(inventoryInvalidateError);
        }
      }
    } catch (inventoryMirrorErr) {
      rowErrors.push(
        inventoryMirrorErr instanceof Error ? inventoryMirrorErr.message : String(inventoryMirrorErr),
      );
      console.warn(`[batch update] inventory mirror failed for SKU ${row.sku}:`, inventoryMirrorErr);
    }

    if (rowErrors.length === 0) {
      return null;
    }

    return {
      sku: row.sku,
      message: rowErrors.join("; "),
    };
  });

  return mirrorResults.filter((result): result is MirrorError => result !== null);
}

const ROW_FIELD_LABEL: Record<string, string> = {
  description: "Description",
  vendorId: "Vendor",
  dccId: "DCC",
  retail: "Retail",
  cost: "Cost",
  itemTaxTypeId: "Tax type",
  barcode: "Barcode",
  catalogNumber: "Catalog number",
  comment: "Comment",
};

/**
 * Translate a Zod failure on a create/update `rows[i].field` path into the
 * row-indexed `BatchValidationError` envelope the batch UI already consumes.
 * Returns an empty array if the failure is not row-scoped (e.g. top-level
 * action mismatch), so the caller can fall back to the generic shape.
 */
function extractRowIndexedErrors(
  error: ZodError,
  body: unknown,
): BatchValidationError[] {
  const out: BatchValidationError[] = [];
  const action = (body as { action?: unknown } | null)?.action;

  for (const issue of error.issues) {
    const [root, indexKey, fieldKey] = issue.path;
    if (root !== "rows" || typeof indexKey !== "number" || typeof fieldKey !== "string") {
      continue;
    }
    const label = ROW_FIELD_LABEL[fieldKey] ?? fieldKey;
    const code: BatchValidationError["code"] =
      issue.code === "too_small" && (fieldKey === "retail" || fieldKey === "cost")
        ? (fieldKey === "retail" ? "NEGATIVE_PRICE" : "NEGATIVE_COST")
        : "MISSING_REQUIRED";
    out.push({
      rowIndex: indexKey,
      field: fieldKey,
      code,
      message: action === "create" && (fieldKey === "dccId" || fieldKey === "vendorId")
        ? `${label} is required`
        : issue.message || `${label} is invalid`,
    });
  }

  return out;
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    rows: z.array(z.object({
      description: z.string(),
      vendorId: z.number().int().positive(),
      dccId: z.number().int().positive(),
      itemTaxTypeId: z.number().int().optional(),
      barcode: z.string().nullable().optional(),
      catalogNumber: z.string().nullable().optional(),
      comment: z.string().nullable().optional(),
      packageType: z.string().nullable().optional(),
      unitsPerPack: z.number().int().optional(),
      retail: z.number(),
      cost: z.number(),
      inventory: z.array(z.object({
        locationId: z.union([z.literal(2), z.literal(3), z.literal(4)]),
        retail: z.number(),
        cost: z.number(),
      })).optional(),
    })),
  }),
  z.object({
    action: z.literal("update"),
    rows: z.array(z.object({
      sku: z.number().int().positive(),
      isTextbook: z.boolean().optional(),
      patch: z.record(z.string(), z.unknown()),
      // Matches the single-item PATCH's `snapshotSchema` constraints
      // (nonnegative retail/cost, positive tax-type id) so the two routes
      // don't disagree on what a valid baseline looks like. `primaryLocationId`
      // is required here (the batch path is always V2) while the single-item
      // route accepts it as optional with a PIER default for V1-legacy compat.
      baseline: z.object({
        sku: z.number().int().positive(),
        barcode: z.string().nullable(),
        itemTaxTypeId: z.number().int().positive().nullable().optional(),
        retail: z.number().nonnegative().nullable(),
        cost: z.number().nonnegative().nullable(),
        fDiscontinue: z.union([z.literal(0), z.literal(1)]),
        primaryLocationId: z.union([z.literal(2), z.literal(3), z.literal(4)]),
      }),
    })),
  }),
  z.object({
    action: z.literal("discontinue"),
    skus: z.array(z.number().int().positive()),
  }),
  z.object({
    action: z.literal("hard-delete"),
    skus: z.array(z.number().int().positive()),
  }),
]);

export const POST = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const rowErrors = extractRowIndexedErrors(parsed.error, body);
    if (rowErrors.length > 0) {
      return NextResponse.json({ errors: rowErrors }, { status: 400 });
    }
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.action === "create") {
      // Re-validate server-side before committing
      const errors = await validateBatchCreateAgainstPrism(parsed.data.rows);
      if (errors.length > 0) return NextResponse.json({ errors }, { status: 400 });
      const skus = await batchCreateGmItems(parsed.data.rows);
      // Non-blocking mirror
      try {
        const supabase = getSupabaseAdminClient();
        await supabase.from("products").upsert(parsed.data.rows.map((row, i) => ({
          sku: skus[i],
          item_type: "general_merchandise",
          description: row.description,
          barcode: row.barcode ?? null,
          retail_price: row.retail,
          cost: row.cost,
          vendor_id: row.vendorId,
          dcc_id: row.dccId,
          synced_at: new Date().toISOString(),
        })));

        const inventoryRows = parsed.data.rows.flatMap((row, i) => {
          const sku = skus[i];
          const rowInventory = row.inventory && row.inventory.length > 0
            ? row.inventory
            : [{ locationId: 2 as const, retail: row.retail, cost: row.cost }];
          return rowInventory.map((inventoryRow) => ({
            sku,
            location_id: inventoryRow.locationId,
            location_abbrev: PRODUCT_LOCATION_ABBREV_BY_ID[inventoryRow.locationId as ProductLocationId],
            retail_price: inventoryRow.retail,
            cost: inventoryRow.cost,
          }));
        });

        if (inventoryRows.length > 0) {
          await supabase.from("product_inventory").upsert(inventoryRows, { onConflict: "sku,location_id" });
        }
      } catch (mirrorErr) {
        console.warn("[batch create] mirror failed:", mirrorErr);
      }
      return NextResponse.json({ action: "create", count: skus.length, skus }, { status: 201 });
    }

    if (parsed.data.action === "update") {
      const errors = await validateBatchUpdateAgainstPrism(parsed.data.rows.map((r) => ({ sku: r.sku, patch: r.patch })));
      if (errors.length > 0) return NextResponse.json({ errors }, { status: 400 });
      try {
        const skus = await batchUpdateItems(parsed.data.rows.map((r) => ({
          sku: r.sku,
          patch: r.patch,
          isTextbook: !!r.isTextbook,
          baseline: r.baseline,
        })));
        // Keep the success path bound to the Prism transaction. Mirror refresh
        // is best-effort follow-up work, so callers get a fast 200 once Prism
        // commits and the browse mirror catches up in the background.
        void collectBatchUpdateMirrorWarnings(parsed.data.rows)
          .then((mirrorErrors) => {
            if (mirrorErrors.length > 0) {
              console.warn("[batch update] deferred mirror refresh reported warnings:", mirrorErrors);
            }
          })
          .catch((mirrorErr) => {
            console.warn("[batch update] deferred mirror refresh failed:", mirrorErr);
          });
        return NextResponse.json({
          action: "update",
          count: skus.length,
          skus,
          mirrorRefreshDeferred: true,
        });
      } catch (err) {
        if (err instanceof Error && (err as Error & { code?: string }).code === "CONCURRENT_MODIFICATION") {
          const e = err as Error & { rowIndex?: number; sku?: number; current?: unknown };
          // Narrow the `current` echo to known ItemSnapshot fields so future
          // domain code that accidentally attaches richer objects (e.g. a full
          // DB row with internal columns) can't leak to the client.
          const rawCurrent = e.current as Record<string, unknown> | null | undefined;
          const current = rawCurrent
            ? {
                sku: rawCurrent.sku,
                barcode: rawCurrent.barcode,
                itemTaxTypeId: rawCurrent.itemTaxTypeId,
                retail: rawCurrent.retail,
                cost: rawCurrent.cost,
                fDiscontinue: rawCurrent.fDiscontinue,
                primaryLocationId: rawCurrent.primaryLocationId,
              }
            : null;
          return NextResponse.json(
            { error: "CONCURRENT_MODIFICATION", rowIndex: e.rowIndex ?? null, sku: e.sku ?? null, current },
            { status: 409 },
          );
        }
        if (err instanceof Error && (err as Error & { code?: string; rowIndex?: number; sku?: number; locationId?: number }).code === "MISSING_INVENTORY_ROW") {
          const e = err as Error & { rowIndex?: number; sku?: number; locationId?: number };
          const locationId = e.locationId ?? null;
          const locationLabel = locationId == null ? "the selected location" : `location ${locationId}`;
          return NextResponse.json(
            {
              errors: [
                {
                  rowIndex: e.rowIndex ?? null,
                  field: "inventory",
                  code: "MISSING_INVENTORY_ROW",
                  message: e.sku == null
                    ? `One selected item no longer has an inventory row at ${locationLabel}. Refresh and try again.`
                    : `SKU ${e.sku} no longer has an inventory row at ${locationLabel}. Refresh and try again.`,
                },
              ],
            },
            { status: 400 },
          );
        }
        throw err;
      }
    }

    if (parsed.data.action === "discontinue") {
      const skus = await batchDiscontinueItems(parsed.data.skus);
      return NextResponse.json({ action: "discontinue", count: skus.length, skus });
    }

    // hard-delete
    const hdSkus = parsed.data.skus;
    const hist = await hasTransactionHistory(hdSkus);
    const blocked = hdSkus.filter((s) => hist.has(s));
    if (blocked.length > 0) {
      return NextResponse.json({
        errors: blocked.map((sku) => ({ rowIndex: hdSkus.indexOf(sku), field: "sku", code: "HAS_HISTORY", message: `SKU ${sku} has transaction history` })),
      }, { status: 409 });
    }
    const deleted = await batchHardDeleteItems(hdSkus);
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from("products").delete().in("sku", deleted);
    } catch (mirrorErr) {
      console.warn("[batch hard-delete] mirror failed:", mirrorErr);
    }
    return NextResponse.json({ action: "hard-delete", count: deleted.length, skus: deleted });
  } catch (err) {
    console.error("POST /api/products/batch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
