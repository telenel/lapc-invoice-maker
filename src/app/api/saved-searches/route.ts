import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  filter: z.record(z.string(), z.any()),
});

export const GET = withAuth(async (_request: NextRequest, session) => {
  const userId = session.user.id;
  const rows = await prisma.savedSearch.findMany({
    where: { OR: [{ ownerUserId: userId }, { isSystem: true }] },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ items: rows });
});

export const POST = withAuth(async (request: NextRequest, session) => {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.savedSearch.create({
    data: {
      name: parsed.data.name,
      filter: parsed.data.filter,
      ownerUserId: session.user.id,
      isSystem: false,
    },
  });
  return NextResponse.json(created, { status: 201 });
});
