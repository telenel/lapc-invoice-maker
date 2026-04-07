import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || "anonymous";
  const rateResult = await checkRateLimit(`quote-public-view:${token}:${ip}`, {
    maxAttempts: ip === "anonymous" ? 20 : 60,
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
  const body = await req.json().catch(() => ({}));

  const result = await quoteService.recordView(token, {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    referrer: req.headers.get("referer") ?? undefined,
    viewport: body.viewport ?? undefined,
  });

  if (!result) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ viewId: result.viewId });
}
