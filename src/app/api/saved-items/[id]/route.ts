import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { savedLineItemSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withAdmin(async (request: NextRequest, _session, ctx?: RouteContext) => {
  const { id } = await ctx!.params;
  const body = await request.json().catch(() => null);
  if (body === null) {
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
  const { id } = await ctx!.params;
  try {
    await prisma.savedLineItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
});
