import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const POST = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const body = await _req.json().catch(() => ({}));
    const existing = await quoteService.getById(id);
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const result = await quoteService.approveManually(id, body);
    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "INVALID_INPUT") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("POST /api/quotes/[id]/approve failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
