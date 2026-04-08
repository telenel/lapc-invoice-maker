import { NextRequest, NextResponse } from "next/server";
import { isPublicPaymentLinkAvailable, quoteService } from "@/domains/quote/service";
import { safePublishAll } from "@/lib/sse";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

function normalizePublicToken(token: string): string {
  return token.trim();
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token: rawToken } = await ctx.params;
  const token = normalizePublicToken(rawToken);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

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
    if (!isPublicPaymentLinkAvailable(existing)) {
      return NextResponse.json({ error: "Payment link is no longer available" }, { status: 409 });
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
