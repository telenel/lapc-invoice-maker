import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quickPickSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
}
