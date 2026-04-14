import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { canViewQuoteActivity } from "@/domains/quote/access";
import { quoteService } from "@/domains/quote/service";

function parseId(rawId: string) {
  const id = rawId.trim();
  if (!id) return null;
  return id;
}

export const GET = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const quote = await quoteService.getById(id, { includeArchived: true });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (!canViewQuoteActivity(quote, session.user.id, session.user.role === "admin")) {
      return forbiddenResponse();
    }
    const views = await quoteService.getViews(id);
    return NextResponse.json(views);
  } catch (err) {
    console.error("GET /api/quotes/[id]/views failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
