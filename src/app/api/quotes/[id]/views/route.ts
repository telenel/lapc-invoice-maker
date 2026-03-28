import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const GET = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const quote = await quoteService.getById(id);
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && quote.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const views = await quoteService.getViews(id);
    return NextResponse.json(views);
  } catch (err) {
    console.error("GET /api/quotes/[id]/views failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
