import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import type { ProductEditDetails } from "@/domains/product/types";
import { isPrismConfigured } from "@/lib/prism";
import { discontinueItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem, updateTextbookPricing, getItemSnapshot } from "@/domains/product/prism-updates";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ sku: string }> };

type ProductEditDetailRow = {
  sku: number;
  item_type: string;
  description: string | null;
  barcode: string | null;
  vendor_id: number | null;
  dcc_id: number | null;
  item_tax_type_id: number | null;
  catalog_number: string | null;
  tx_comment: string | null;
  retail_price: number | null;
  cost: number | null;
  discontinued: boolean | null;
  alt_vendor_id: number | null;
  mfg_id: number | null;
  weight: number | null;
  package_type: string | null;
  units_per_pack: number | null;
  order_increment: number | null;
  image_url: string | null;
  size: string | null;
  size_id: number | null;
  color_id: number | null;
  style_id: number | null;
  item_season_code_id: number | null;
  f_list_price_flag: boolean | null;
  f_perishable: boolean | null;
  f_id_required: boolean | null;
  min_order_qty_item: number | null;
  used_dcc_id: number | null;
};

const PRODUCT_EDIT_DETAIL_SELECT = [
  "sku",
  "item_type",
  "description",
  "barcode",
  "vendor_id",
  "dcc_id",
  "item_tax_type_id",
  "catalog_number",
  "tx_comment",
  "retail_price",
  "cost",
  "discontinued",
  "alt_vendor_id",
  "mfg_id",
  "weight",
  "package_type",
  "units_per_pack",
  "order_increment",
  "image_url",
  "size",
  "size_id",
  "color_id",
  "style_id",
  "item_season_code_id",
  "f_list_price_flag",
  "f_perishable",
  "f_id_required",
  "min_order_qty_item",
  "used_dcc_id",
].join(", ");

function parseSkuParam(rawSku: string): number | null {
  const sku = Number(rawSku);
  if (!Number.isInteger(sku) || sku <= 0) {
    return null;
  }
  return sku;
}

function toProductEditDetails(row: ProductEditDetailRow): ProductEditDetails {
  return {
    sku: row.sku,
    itemType: row.item_type,
    description: row.description,
    barcode: row.barcode,
    vendorId: row.vendor_id,
    dccId: row.dcc_id,
    itemTaxTypeId: row.item_tax_type_id,
    catalogNumber: row.catalog_number,
    comment: row.tx_comment,
    retail: Number(row.retail_price ?? 0),
    cost: Number(row.cost ?? 0),
    fDiscontinue: row.discontinued ? 1 : 0,
    altVendorId: row.alt_vendor_id,
    mfgId: row.mfg_id,
    weight: row.weight,
    packageType: row.package_type,
    unitsPerPack: row.units_per_pack,
    orderIncrement: row.order_increment,
    imageUrl: row.image_url,
    size: row.size,
    sizeId: row.size_id,
    colorId: row.color_id,
    styleId: row.style_id,
    itemSeasonCodeId: row.item_season_code_id,
    fListPriceFlag: row.f_list_price_flag ? 1 : 0,
    fPerishable: row.f_perishable ? 1 : 0,
    fIdRequired: row.f_id_required ? 1 : 0,
    minOrderQtyItem: row.min_order_qty_item,
    usedDccId: row.used_dcc_id,
  };
}

export const GET = withAdmin(async (_request: NextRequest, _session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const sku = parseSkuParam(params?.sku ?? "");
  if (sku === null) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_EDIT_DETAIL_SELECT)
      .eq("sku", sku)
      .maybeSingle<ProductEditDetailRow>();

    if (error) {
      console.error(`GET /api/products/${sku} failed:`, error);
      return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(toProductEditDetails(data));
  } catch (err) {
    console.error(`GET /api/products/${sku} threw:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});

/**
 * Soft-delete an item by setting fDiscontinue=1 (default), or hard-delete if
 * the URL has `?hard=true` AND the item's barcode starts with TEST-CLAUDE-.
 *
 * The hard-delete is restricted to test items because real items have FK
 * dependencies (Inventory, Transaction_Detail, etc.) that would block deletion
 * and could cause data integrity issues if removed.
 */
export const DELETE = withAdmin(async (request: NextRequest, _session, ctx?: RouteCtx) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const params = ctx ? await ctx.params : null;
  const sku = parseSkuParam(params?.sku ?? "");
  if (sku === null) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  const url = new URL(request.url);
  const hard = url.searchParams.get("hard") === "true";

  try {
    const result = hard ? await deleteTestItem(sku) : await discontinueItem(sku);

    if (result.affected === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Mirror to Supabase. For soft delete we just upsert the discontinue flag
    // (the products table doesn't have one — we just delete the row to hide it
    // from the UI; nightly sync will restore it but that's OK since the read
    // page filters on whatever Prism shows).
    try {
      const supabase = getSupabaseAdminClient();
      if (hard) {
        await supabase.from("products").delete().eq("sku", sku);
      }
      // Soft delete: leave the row, the UI shouldn't show discontinued items.
      // (A future migration could add a `discontinued` boolean to products.)
    } catch (mirrorErr) {
      console.warn(`[DELETE /api/products/${sku}] mirror failed:`, mirrorErr);
    }

    return NextResponse.json({ sku, mode: hard ? "hard" : "soft", affected: result.affected });
  } catch (err) {
    console.error(`DELETE /api/products/${sku} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});

const snapshotSchema = z.object({
  sku: z.number().int().positive(),
  barcode: z.string().nullable(),
  retail: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  fDiscontinue: z.union([z.literal(0), z.literal(1)]),
});

const patchSchema = z.object({
  isTextbook: z.boolean().optional(),
  baseline: snapshotSchema.optional(),
  patch: z.object({
    description: z.string().min(1).max(128).optional(),
    vendorId: z.number().int().positive().optional(),
    dccId: z.number().int().positive().optional(),
    itemTaxTypeId: z.number().int().positive().optional(),
    barcode: z.string().max(20).nullable().optional(),
    catalogNumber: z.string().max(30).nullable().optional(),
    comment: z.string().max(25).nullable().optional(),
    weight: z.number().nonnegative().optional(),
    imageUrl: z.string().max(128).nullable().optional(),
    unitsPerPack: z.number().int().positive().optional(),
    packageType: z.string().max(3).nullable().optional(),
    retail: z.number().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
    fDiscontinue: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
});

export const PATCH = withAdmin(async (request: NextRequest, _session, ctx?: RouteCtx) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const params = ctx ? await ctx.params : null;
  const sku = parseSkuParam(params?.sku ?? "");
  if (sku === null) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = parsed.data.isTextbook
      ? await updateTextbookPricing(sku, parsed.data.patch, parsed.data.baseline)
      : await updateGmItem(sku, parsed.data.patch, parsed.data.baseline);

    // Non-blocking Supabase mirror
    try {
      const supabase = getSupabaseAdminClient();
      const snap = await getItemSnapshot(sku);
      if (snap) {
        await supabase.from("products").upsert({
          sku,
          barcode: snap.barcode,
          retail_price: snap.retail,
          cost: snap.cost,
          synced_at: new Date().toISOString(),
        });
      }
    } catch (mirrorErr) {
      console.warn(`[PATCH /api/products/${sku}] mirror failed:`, mirrorErr);
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "CONCURRENT_MODIFICATION") {
      const current = (err as Error & { current?: unknown }).current;
      return NextResponse.json({ error: "CONCURRENT_MODIFICATION", current }, { status: 409 });
    }
    console.error(`PATCH /api/products/${sku} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
