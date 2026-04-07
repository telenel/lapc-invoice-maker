import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";
import { safePublishAll } from "@/lib/sse";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || "anonymous";
  const rateResult = await checkRateLimit(`quote-public-payment:${token}:${ip}`, {
    maxAttempts: ip === "anonymous" ? 3 : 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateResult.retryAfterMs ?? 0) / 1000)) },
      }
    );
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const existing = await quoteService.getByShareToken(token);
    if (!existing) {
      return NextResponse.json({ error: "Quote not found or not accepted" }, { status: 404 });
    }

    const quote = await quoteService.submitPublicPaymentDetails(token, {
      paymentMethod: (body as { paymentMethod?: string }).paymentMethod,
      accountNumber: (body as { accountNumber?: string | null }).accountNumber,
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
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Quote not found or not accepted" }, { status: 404 });
    }
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
