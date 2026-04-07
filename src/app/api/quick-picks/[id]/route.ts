import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { quickPickSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withAdmin(async (request: NextRequest, _session, ctx?: RouteContext) => {
  const { id } = await ctx!.params;
  const body = await request.json();
  const parsed = quickPickSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const quickPick = await prisma.quickPickItem.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(quickPick);
  } catch (err) {
    console.error("PUT /api/quick-picks/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const DELETE = withAdmin(async (_request: NextRequest, _session, ctx?: RouteContext) => {
  const { id } = await ctx!.params;
  try {
    await prisma.quickPickItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/quick-picks/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
