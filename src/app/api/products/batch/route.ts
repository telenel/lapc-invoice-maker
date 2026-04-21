import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    rows: z.array(z.object({
      description: z.string(),
      vendorId: z.number().int(),
      dccId: z.number().int(),
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
      patch: z.record(z.string(), z.any()),
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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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
      const skus = await batchUpdateItems(parsed.data.rows.map((r) => ({
        sku: r.sku,
        patch: r.patch,
        isTextbook: !!r.isTextbook,
      })));
      return NextResponse.json({ action: "update", count: skus.length, skus });
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
