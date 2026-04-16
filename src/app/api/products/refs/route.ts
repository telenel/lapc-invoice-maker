import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { listVendors, listDccs, listTaxTypes } from "@/domains/product/prism-server";

export const dynamic = "force-dynamic";

/**
 * Returns the lookup data needed to populate the "Add Item" form:
 *   - vendors (from VendorMaster, filtered to those with Pierce inventory)
 *   - DCCs (department/class/category combinations)
 *   - tax types
 *
 * Cached for 60s on the client since these change rarely.
 */
export const GET = withAuth(async () => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  try {
    const [vendors, dccs, taxTypes] = await Promise.all([
      listVendors(500),
      listDccs(1000),
      listTaxTypes(),
    ]);

    return NextResponse.json(
      { vendors, dccs, taxTypes },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (err) {
    console.error("GET /api/products/refs failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
