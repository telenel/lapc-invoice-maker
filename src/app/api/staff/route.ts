import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffSchema } from "@/lib/validators";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const staff = await prisma.staff.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        accountNumbers: { orderBy: { lastUsedAt: "desc" } },
      },
    });

    return NextResponse.json(staff);
  } catch (err) {
    console.error("GET /api/staff failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = staffSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const staff = await prisma.staff.create({ data: parsed.data });
    return NextResponse.json(staff, { status: 201 });
  } catch (err) {
    console.error("POST /api/staff failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
