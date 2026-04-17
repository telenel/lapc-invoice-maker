import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { hasTransactionHistory } from "@/domains/product/prism-delete";

export const dynamic = "force-dynamic";

/**
 * Returns { [sku]: boolean } — true means the SKU has transaction history
 * and cannot be hard-deleted. Used by the HardDeleteDialog to decide
 * which selected rows are eligible.
 */
export const GET = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const url = new URL(request.url);
  const skusParam = url.searchParams.get("skus") ?? "";
  const skus = skusParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (skus.length === 0) {
    return NextResponse.json({});
  }

  try {
    const hasHistory = await hasTransactionHistory(skus);
    const out: Record<string, boolean> = {};
    for (const sku of skus) {
      out[String(sku)] = hasHistory.has(sku);
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("GET /api/products/history-check failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
