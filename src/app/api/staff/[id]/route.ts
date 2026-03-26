import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffSchema } from "@/lib/validators";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
      include: {
        accountNumbers: {
          orderBy: { lastUsedAt: "desc" },
        },
        signerHistories: {
          include: {
            signer: { select: { id: true, name: true, title: true } },
          },
          orderBy: { lastUsedAt: "desc" },
        },
      },
    });
    if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(staff);
  } catch (err) {
    console.error("GET /api/staff/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = staffSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const staff = await prisma.staff.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json(staff);
  } catch (err) {
    console.error("PUT /api/staff/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = staffSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const staff = await prisma.staff.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json(staff);
  } catch (err) {
    console.error("PATCH /api/staff/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.staff.update({
      where: { id: params.id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/staff/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
