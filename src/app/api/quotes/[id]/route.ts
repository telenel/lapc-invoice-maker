import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";
import { quoteUpdateSchema } from "@/lib/validators";

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const quote = await quoteService.getById(id);
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    return NextResponse.json(quote);
  } catch (err) {
    console.error("GET /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json();
  const parsed = quoteUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const quote = await quoteService.update(id, parsed.data);
    return NextResponse.json(quote);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("PUT /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  try {
    await quoteService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    console.error("DELETE /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
