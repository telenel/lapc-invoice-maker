import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CateringDetails } from "@/domains/quote/types";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const response = body.response;
  if (response !== "ACCEPTED" && response !== "DECLINED") {
    return NextResponse.json({ error: "Invalid response. Must be ACCEPTED or DECLINED" }, { status: 400 });
  }

  try {
    // If catering details were submitted, persist them before processing the response
    const cateringDetails = body.cateringDetails as CateringDetails | undefined;
    if (cateringDetails) {
      // Look up the quote to get its id for the update
      const quote = await prisma.invoice.findFirst({
        where: { shareToken: token },
        select: { id: true },
      });
      if (quote) {
        await prisma.invoice.update({
          where: { id: quote.id },
          data: { cateringDetails: cateringDetails as unknown as Prisma.InputJsonValue },
        });
      }
    }

    const result = await quoteService.respondToQuote(token, response, body.viewId);
    if (!result) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    console.error("POST /api/quotes/public/[token]/respond failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
