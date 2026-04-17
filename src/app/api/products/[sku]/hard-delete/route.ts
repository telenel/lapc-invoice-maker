import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { hardDeleteItem } from "@/domains/product/prism-delete";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ sku: string }> };

/**
 * Hard-delete a real (non-test) item. Fails with 409 HAS_HISTORY if the
 * SKU has any transaction history. This is a separate route from the
 * test-item hard-delete path (which uses ?hard=true on the main DELETE
 * handler and requires a TEST-CLAUDE- barcode).
 */
export const DELETE = withAdmin(async (_request: NextRequest, _session, ctx?: RouteCtx) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const params = ctx ? await ctx.params : null;
  const sku = Number(params?.sku ?? "");
  if (!Number.isInteger(sku) || sku <= 0) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  try {
    const result = await hardDeleteItem(sku);
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from("products").delete().eq("sku", sku);
    } catch (mirrorErr) {
      console.warn(`[hard-delete /api/products/${sku}] mirror failed:`, mirrorErr);
    }
    return NextResponse.json({ sku: result.sku, mode: "hard", affected: result.affected });
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === "HAS_HISTORY") {
      return NextResponse.json({ error: "HAS_HISTORY", message: (err as Error).message }, { status: 409 });
    }
    console.error(`hard-delete /api/products/${sku} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
