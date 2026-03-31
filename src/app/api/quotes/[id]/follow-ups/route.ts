import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { canViewQuoteDetails } from "@/domains/quote/access";
import { quoteService } from "@/domains/quote/service";

export const GET = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;

  const quote = await quoteService.getById(id);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  if (!canViewQuoteDetails(quote, session.user.id, session.user.role === "admin")) {
    return forbiddenResponse();
  }

  const followUps = await quoteService.getFollowUps(id);
  return NextResponse.json(followUps);
});
