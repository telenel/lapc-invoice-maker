import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/domains/quote/service";

type RouteContext = { params: Promise<{ token: string; viewId: string }> };

async function updateDuration(req: NextRequest, ctx: RouteContext) {
  const { token: rawToken, viewId: rawViewId } = await ctx.params;
  const token = rawToken.trim();
  const viewId = rawViewId.trim();

  if (!token || !viewId) {
    return NextResponse.json({ error: "Invalid token or view identifier" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const duration = Number(body.durationSeconds);
  if (!Number.isFinite(duration)) {
    return NextResponse.json({ error: "durationSeconds must be a finite number" }, { status: 400 });
  }

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
