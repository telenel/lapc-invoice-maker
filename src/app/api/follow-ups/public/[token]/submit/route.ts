import { NextRequest, NextResponse } from "next/server";
import { followUpService } from "@/domains/follow-up/service";
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
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const rateLimitResult = await checkRateLimit(`account-submit:${ip}`, {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";
  if (!accountNumber) {
    return NextResponse.json(
      { error: "accountNumber is required" },
      { status: 400 },
    );
  }
  if (accountNumber.length > 100) {
    return NextResponse.json({ error: "accountNumber is too long" }, { status: 400 });
  }

  try {
    const result = await followUpService.submitAccountNumber(token, accountNumber);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (result.alreadyResolved) {
      return NextResponse.json({ alreadyResolved: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/follow-ups/public/[token]/submit failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
