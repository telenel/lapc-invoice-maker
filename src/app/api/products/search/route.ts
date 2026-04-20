import { NextRequest, NextResponse } from "next/server";
import { searchProductBrowseRows } from "@/domains/product/search-route";
import { withAuth } from "@/domains/shared/auth";
import { parseFiltersFromSearchParams } from "@/domains/product/view-serializer";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest) => {
  const filters = parseFiltersFromSearchParams(req.nextUrl.searchParams);
  const result = await searchProductBrowseRows(filters);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
});
