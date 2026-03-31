import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string; viewId: string }> };

async function updateDuration(req: NextRequest, ctx: RouteContext) {
  const { viewId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const duration = Number(body.durationSeconds);

  if (!isNaN(duration) && duration > 0) {
    await quoteService.updateViewDuration(viewId, Math.round(duration));
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return updateDuration(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return updateDuration(req, ctx);
}
