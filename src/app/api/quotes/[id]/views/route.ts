import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const views = await quoteService.getViews(id);
    return NextResponse.json(views);
  } catch (err) {
    console.error("GET /api/quotes/[id]/views failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
