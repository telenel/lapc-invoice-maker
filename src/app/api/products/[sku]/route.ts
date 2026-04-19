import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { discontinueItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem, updateTextbookPricing, getItemSnapshot } from "@/domains/product/prism-updates";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ sku: string }> };

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
  const skuParam = params?.sku ?? "";
  const sku = Number(skuParam);
  if (!Number.isInteger(sku) || sku <= 0) {
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
    // (the products table doesn't have one — remove the row so the UI stops
    // offering actions on an item Prism now considers discontinued).
    try {
      const supabase = getSupabaseAdminClient();
      const { error: mirrorError } = await supabase.from("products").delete().eq("sku", sku);
      if (mirrorError) {
        console.warn(`[DELETE /api/products/${sku}] mirror delete failed:`, mirrorError);
      }
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
  const sku = Number(params?.sku ?? "");
  if (!Number.isInteger(sku) || sku <= 0) {
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
