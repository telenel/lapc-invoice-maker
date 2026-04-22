import { NextRequest, NextResponse } from "next/server";
import { searchProductBrowseRows } from "@/domains/product/search-route";
import { withAuth } from "@/domains/shared/auth";
import { parseFiltersFromSearchParams } from "@/domains/product/view-serializer";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest, session) => {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const countOnly = params.get("countOnly") === "true";
  params.delete("countOnly");

  const filters = parseFiltersFromSearchParams(params);
  const role = (session.user as { role?: string }).role ?? "user";
  const userId = (session.user as { id?: string }).id ?? null;
  const result = await searchProductBrowseRows(filters, { countOnly, role, userId });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
});
