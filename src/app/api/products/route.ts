import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { createGmItem } from "@/domains/product/prism-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProductLocationAbbrev, ProductLocationId } from "@/domains/product/types";

export const dynamic = "force-dynamic";

interface RawInventoryRow {
  locationId?: unknown;
  retail?: unknown;
  cost?: unknown;
}

interface RawCreateItemBody {
  retail?: unknown;
  cost?: unknown;
  inventory?: RawInventoryRow[];
}

const LOCATION_ABBREV_BY_ID: Record<ProductLocationId, ProductLocationAbbrev> = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
};

function parseRequiredNonNegativeNumber(
  value: unknown,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value === "number") {
    if (Number.isFinite(value) && value >= 0) {
      return { ok: true, value };
    }
    return { ok: false, error: `${label} must be a non-negative number` };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: `${label} is required` };
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return { ok: true, value: parsed };
    }
  }

  return { ok: false, error: `${label} must be a non-negative number` };
}

const createItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(128),
  vendorId: z.coerce.number().int().positive(),
  dccId: z.coerce.number().int().positive(),
  mfgId: z.coerce.number().int().positive().optional(),
  itemTaxTypeId: z.coerce.number().int().positive().optional(),
  barcode: z.string().max(20).optional().nullable(),
  catalogNumber: z.string().max(30).optional().nullable(),
  comment: z.string().max(25).optional().nullable(),
  weight: z.coerce.number().nonnegative().optional(),
  imageUrl: z.string().max(128).optional().nullable(),
  unitsPerPack: z.coerce.number().int().positive().optional(),
  packageType: z.string().max(3).optional().nullable(),
  retail: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  inventory: z
    .array(
      z.object({
        locationId: z
          .coerce
          .number()
          .int()
          .refine(
            (value): value is ProductLocationId =>
              value === 2 || value === 3 || value === 4,
            "inventory locations must be PIER, PCOP, or PFS",
          ),
        retail: z.number().nonnegative(),
        cost: z.number().nonnegative(),
      }),
    )
    .min(1, "At least one inventory location is required")
    .optional(),
});

/**
 * Create a new General Merchandise item in Prism, then mirror it into the
 * Supabase `products` table for immediate visibility in the read-only catalog.
 *
 * Requires admin role. Requires Prism reachability (returns 503 if not).
 */
export const POST = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawBody = body as RawCreateItemBody;

  const retailResult = parseRequiredNonNegativeNumber(
    rawBody.retail,
    "Retail",
  );
  if (!retailResult.ok) {
    return NextResponse.json({ error: retailResult.error }, { status: 400 });
  }

  const costResult = parseRequiredNonNegativeNumber(
    rawBody.cost,
    "Cost",
  );
  if (!costResult.ok) {
    return NextResponse.json({ error: costResult.error }, { status: 400 });
  }

  let normalizedInventory: Array<{
    locationId: number;
    retail: number;
    cost: number;
  }> | undefined;

  if (Array.isArray(rawBody.inventory)) {
    normalizedInventory = [];
    let hasPierRow = false;

    const hasOutOfScopeLocation = rawBody.inventory.some((row: RawInventoryRow) => {
      const locationId = typeof row?.locationId === "string"
        ? Number(row.locationId)
        : row?.locationId;
      return locationId !== 2 && locationId !== 3 && locationId !== 4;
    });
    if (hasOutOfScopeLocation) {
      return NextResponse.json(
        { error: "inventory locations must be PIER, PCOP, or PFS" },
        { status: 400 },
      );
    }

    for (const row of rawBody.inventory) {
      const locationId = typeof row?.locationId === "string"
        ? Number(row.locationId)
        : row?.locationId;
      if (locationId === 2) {
        hasPierRow = true;
      }

      const rowRetail = parseRequiredNonNegativeNumber(
        row?.retail,
        `inventory retail for location ${locationId ?? "unknown"}`,
      );
      if (!rowRetail.ok) {
        return NextResponse.json({ error: rowRetail.error }, { status: 400 });
      }

      const rowCost = parseRequiredNonNegativeNumber(
        row?.cost,
        `inventory cost for location ${locationId ?? "unknown"}`,
      );
      if (!rowCost.ok) {
        return NextResponse.json({ error: rowCost.error }, { status: 400 });
      }

      normalizedInventory.push({
        locationId: Number(locationId),
        retail: rowRetail.value,
        cost: rowCost.value,
      });
    }

    if (!hasPierRow) {
      return NextResponse.json(
        { error: "inventory must include the canonical PIER row" },
        { status: 400 },
      );
    }
  }

  const parsed = createItemSchema.safeParse({
    ...body,
    retail: retailResult.value,
    cost: costResult.value,
    inventory: normalizedInventory,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  if (parsed.data.inventory) {
    const seen = new Set<number>();
    for (const row of parsed.data.inventory) {
      if (seen.has(row.locationId)) {
        return NextResponse.json(
          { error: `Duplicate inventory location: ${row.locationId}` },
          { status: 400 },
        );
      }
      seen.add(row.locationId);
    }
  }

  try {
    const created = await createGmItem(parsed.data);

    // Mirror into Supabase products table. Failure here doesn't fail the request
    // because the source-of-truth write to Prism has already succeeded — the
    // nightly sync will repair any drift.
    try {
      const supabase = getSupabaseAdminClient();
      const { error: mirrorError } = await supabase
        .from("products")
        .upsert({
          sku: created.sku,
          item_type: "general_merchandise",
          description: created.description,
          barcode: created.barcode,
          retail_price: created.retail,
          cost: created.cost,
          vendor_id: created.vendorId,
          dcc_id: created.dccId,
          synced_at: new Date().toISOString(),
        });
      if (mirrorError) {
        console.warn("[POST /api/products] mirror failed:", mirrorError);
      }

      const inventoryRows =
        created.inventory && created.inventory.length > 0
          ? created.inventory
          : [
              {
                locationId: 2 as const,
                locationAbbrev: "PIER" as const,
                retail: created.retail,
                cost: created.cost,
              },
            ];
      const { error: inventoryMirrorError } = await supabase
        .from("product_inventory")
        .upsert(
          inventoryRows.map((row) => ({
            sku: created.sku,
            location_id: row.locationId,
            location_abbrev:
              row.locationAbbrev ?? LOCATION_ABBREV_BY_ID[row.locationId],
            retail_price: row.retail,
            cost: row.cost,
          })),
          { onConflict: "sku,location_id" },
        );
      if (inventoryMirrorError) {
        console.warn(
          "[POST /api/products] inventory mirror failed:",
          inventoryMirrorError,
        );
      }
    } catch (mirrorErr) {
      console.warn("[POST /api/products] mirror threw:", mirrorErr);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/products failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
