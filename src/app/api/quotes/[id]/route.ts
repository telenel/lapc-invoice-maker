import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { getQuoteViewerAccess, canViewQuoteDetails, redactQuoteForViewer } from "@/domains/quote/access";
import { quoteService } from "@/domains/quote/service";
import { quoteUpdateSchema } from "@/lib/validators";

function parseId(rawId: string) {
  const id = rawId.trim();
  if (!id) return null;
  return id;
}

function isObjectBody(body: unknown) {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

export const GET = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const quote = await quoteService.getById(id, { includeArchived: true });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    const access = getQuoteViewerAccess(quote, session.user.id, session.user.role === "admin");
    if (!canViewQuoteDetails(quote, session.user.id, session.user.role === "admin")) {
      return forbiddenResponse();
    }
    return NextResponse.json(redactQuoteForViewer(quote, access));
  } catch (err) {
    console.error("GET /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = quoteUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (
    parsed.data.quoteStatus !== undefined
    || parsed.data.paymentMethod !== undefined
    || parsed.data.paymentAccountNumber !== undefined
  ) {
    return NextResponse.json(
      { error: "Use the dedicated quote workflow actions for status or payment changes" },
      { status: 400 }
    );
  }

  try {
    const existing = await quoteService.getById(id, { includeArchived: true });
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const quote = await quoteService.update(id, parsed.data);
    return NextResponse.json(quote);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "INVALID_INPUT") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    if (code === "PAYMENT_ALREADY_RESOLVED") {
      return NextResponse.json({ error: (err as Error).message }, { status: 409 });
    }
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("PUT /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  try {
    const existing = await quoteService.getById(id, { includeArchived: true });
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    await quoteService.archive(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    console.error("DELETE /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
