import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const POST = withAuth(async (req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const existing = await quoteService.getById(id);
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { method } = body as { method?: string };
    if (method !== "email" && method !== "manual") {
      return NextResponse.json({ error: "Invalid method — must be 'email' or 'manual'" }, { status: 400 });
    }
    if (method === "email") {
      await quoteService.markSubmittedEmail(id);
    } else {
      await quoteService.markSubmittedManual(id);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    console.error("POST /api/quotes/[id]/mark-submitted failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
