import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";
import { safePublishAll } from "@/lib/sse";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  try {
    const existing = await quoteService.getByShareToken(token);
    if (!existing) {
      return NextResponse.json({ error: "Quote not found or not accepted" }, { status: 404 });
    }

    const quote = await quoteService.submitPublicPaymentDetails(token, {
      paymentMethod: body.paymentMethod,
      accountNumber: body.accountNumber,
    });
    if (!quote) {
      return NextResponse.json({ error: "Quote not found or not accepted" }, { status: 404 });
    }

    safePublishAll({ type: "quote-changed" });
    if (quote.updatedConvertedInvoice) {
      safePublishAll({ type: "invoice-changed" });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "INVALID_INPUT") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 409 });
    }
    if (code === "PAYMENT_ALREADY_RESOLVED") {
      return NextResponse.json({ error: (err as Error).message }, { status: 409 });
    }
    console.error("POST /api/quotes/public/[token]/payment failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
