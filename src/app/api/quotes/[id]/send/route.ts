import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const POST = withAuth(async (req: NextRequest, session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = rawId.trim();
  if (!id) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const existing = await quoteService.getById(id, { includeArchived: true });
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const { shareToken } = await quoteService.markSent(id);
    const appOrigin = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
    const shareUrl = `${appOrigin.replace(/\/$/, "")}/quotes/review/${shareToken}`;
    return NextResponse.json({ success: true, shareUrl });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("POST /api/quotes/[id]/send failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
