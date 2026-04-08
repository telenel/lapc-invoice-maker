import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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