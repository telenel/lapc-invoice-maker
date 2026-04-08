import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { savedLineItemSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

function isObjectBody(body: unknown): body is Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

async function parseId(ctx?: RouteContext): Promise<string | null> {
  if (!ctx?.params) return null;
  const { id: rawId } = await ctx.params;
  const id = rawId.trim();
  return id.length > 0 ? id : null;
}

export const PUT = withAdmin(async (request: NextRequest, _session, ctx?: RouteContext) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid saved item id" }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = savedLineItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await prisma.savedLineItem.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ ...item, unitPrice: Number(item.unitPrice) });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
});

export const DELETE = withAdmin(async (_request: NextRequest, _session, ctx?: RouteContext) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid saved item id" }, { status: 400 });
  }
  try {
    await prisma.savedLineItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
});
