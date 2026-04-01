import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string; viewId: string }> };

async function updateDuration(req: NextRequest, ctx: RouteContext) {
  const { token, viewId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const duration = Number(body.durationSeconds);

  try {
    if (!isNaN(duration) && duration > 0) {
      await quoteService.updateViewDurationForToken(token, viewId, Math.round(duration));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: (err as Error).message }, { status: 404 });
    }
    if (code === "INVALID_INPUT") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    console.error(`${req.method} /api/quotes/public/[token]/view/[viewId] failed:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return updateDuration(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return updateDuration(req, ctx);
}
