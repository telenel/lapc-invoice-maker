import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { discontinueItem, deleteTestItem } from "@/domains/product/prism-server";
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
