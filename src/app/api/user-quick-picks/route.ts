import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department") ?? undefined;

  const picks = await prisma.userQuickPick.findMany({
    where: { userId },
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
  });

  const result = picks.map((p) => ({
    id: p.id,
    description: p.description,
    unitPrice: Number(p.unitPrice),
    department: p.department,
    usageCount: p.usageCount,
    isCurrentDept: department ? p.department === department : false,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { description, unitPrice, department } = body;

  if (!description || unitPrice == null || !department) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pick = await prisma.userQuickPick.upsert({
    where: {
      userId_department_description: { userId, department, description },
    },
    update: { unitPrice },
    create: { userId, description, unitPrice, department },
  });

  return NextResponse.json({
    id: pick.id,
    description: pick.description,
    unitPrice: Number(pick.unitPrice),
    department: pick.department,
    usageCount: pick.usageCount,
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.userQuickPick.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ success: true });
}
