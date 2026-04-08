import { NextRequest, NextResponse } from "next/server";
import { followUpService } from "@/domains/follow-up/service";

type RouteContext = { params: Promise<{ token: string }> };

function normalizePublicToken(token: string): string {
  return token.trim();
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token: rawToken } = await ctx.params;
  const token = normalizePublicToken(rawToken);
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const summary = await followUpService.getPublicSummary(token);
    if (!summary) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(summary);
  } catch (err) {
    console.error("/api/follow-ups/public/[token] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
