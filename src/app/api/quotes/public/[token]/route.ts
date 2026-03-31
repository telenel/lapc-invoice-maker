import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";
import type { QuoteResponse } from "@/domains/quote/types";

type RouteContext = { params: Promise<{ token: string }> };

/** Strip internal-only fields before returning to public consumers. */
function sanitizeForPublic(quote: QuoteResponse) {
  const items = quote.items.map((item) => {
    const safeItem: Record<string, unknown> = { ...item };
    delete safeItem.costPrice;
    delete safeItem.marginOverride;
    return safeItem;
  });
  const safe: Record<string, unknown> = { ...quote };
  delete safe.marginEnabled;
  delete safe.marginPercent;
  delete safe.accountCode;
  delete safe.accountNumber;
  delete safe.approvalChain;
  delete safe.creatorId;
  delete safe.creatorName;
  delete safe.paymentMethod;
  delete safe.paymentAccountNumber;

  return {
    ...safe,
    items,
  };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const quote = await quoteService.getByShareToken(token);

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json(sanitizeForPublic(quote));
}
