import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

export const POST = withAuth(async (_req: NextRequest, session, ctx) => {
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
    const invoice = await quoteService.convertToInvoice(id, session.user.id);
    return NextResponse.json(
      { invoice, redirectTo: `/invoices/${invoice.id}/edit` },
      { status: 201 }
    );
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("POST /api/quotes/[id]/convert failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
