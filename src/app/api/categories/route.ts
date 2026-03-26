import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const categories = await prisma.category.findMany({
      where: all ? undefined : { active: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(categories);
  } catch (err) {
    console.error("GET /api/categories failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await prisma.category.create({
      data: parsed.data,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error("POST /api/categories failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
