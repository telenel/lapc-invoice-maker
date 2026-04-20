import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import {
  listBindings,
  listColors,
  listDccs,
  listPackageTypes,
  listStatusCodes,
  listTagTypes,
  listTaxTypes,
  listVendors,
} from "@/domains/product/prism-server";
import { loadCommittedProductRefSnapshot } from "@/domains/product/ref-data";

export const dynamic = "force-dynamic";

/**
 * Returns the lookup data needed to populate the "Add Item" form:
 *   - vendors
 *   - DCCs
 *   - tax types
 *   - tag types
 *   - inventory status codes
 *   - package types
 *   - colors
 *   - bindings
 *
 * Cached for 60s on the client since these change rarely.
 */
export const GET = withAuth(async () => {
  const fallback = async () => loadCommittedProductRefSnapshot();

  if (!isPrismConfigured()) {
    const refs = await fallback();
    return NextResponse.json(refs, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  try {
    const [vendors, dccs, taxTypes, tagTypes, statusCodes, packageTypes, colors, bindings] = await Promise.all([
      listVendors(500),
      listDccs(1000),
      listTaxTypes(),
      listTagTypes(),
      listStatusCodes(),
      listPackageTypes(),
      listColors(),
      listBindings(),
    ]);

    return NextResponse.json(
      { vendors, dccs, taxTypes, tagTypes, statusCodes, packageTypes, colors, bindings },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (err) {
    console.error("GET /api/products/refs failed:", err);
    const refs = await fallback();
    return NextResponse.json(refs, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  }
});
