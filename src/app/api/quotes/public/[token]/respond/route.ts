import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const response = body.response;
  if (response !== "ACCEPTED" && response !== "DECLINED") {
    return NextResponse.json({ error: "Invalid response. Must be ACCEPTED or DECLINED" }, { status: 400 });
  }

  try {
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
