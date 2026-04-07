import { NextRequest, NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { quickPickSchema } from "@/lib/validators";

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");

    const quickPicks = await prisma.quickPickItem.findMany({
      where: department ? { OR: [{ department }, { department: "__ALL__" }] } : undefined,
      orderBy: { usageCount: "desc" },
    });

    return NextResponse.json(quickPicks);
  } catch (err) {
    console.error("GET /api/quick-picks failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = quickPickSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const quickPick = await prisma.quickPickItem.create({ data: parsed.data });
    return NextResponse.json(quickPick, { status: 201 });
  } catch (err) {
    console.error("POST /api/quick-picks failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
