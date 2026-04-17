import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  filter: z.record(z.string(), z.any()).optional(),
});

export const PATCH = withAuth(async (request: NextRequest, session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.savedSearch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isSystem) {
    return NextResponse.json({ error: "System presets are read-only" }, { status: 403 });
  }
  if (existing.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your preset" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.savedSearch.update({
    where: { id },
    data: { ...parsed.data, updatedAt: new Date() },
  });
  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (_request: NextRequest, session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.savedSearch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isSystem) {
    return NextResponse.json({ error: "System presets are read-only" }, { status: 403 });
  }
  if (existing.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your preset" }, { status: 403 });
  }
  await prisma.savedSearch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
