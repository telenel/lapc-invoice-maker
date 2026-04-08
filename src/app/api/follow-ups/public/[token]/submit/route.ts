import { NextRequest, NextResponse } from "next/server";
import { followUpService } from "@/domains/follow-up/service";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

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
  if (!body || typeof body.accountNumber !== "string") {
    return NextResponse.json(
      { error: "accountNumber is required" },
      { status: 400 },
    );
  }

  const result = await followUpService.submitAccountNumber(token, body.accountNumber);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.alreadyResolved) {
    return NextResponse.json({ alreadyResolved: true });
  }

  return NextResponse.json({ success: true });
}
