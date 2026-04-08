import { NextRequest, NextResponse } from "next/server";
import { followUpService } from "@/domains/follow-up/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const summary = await followUpService.getPublicSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(summary);
}
