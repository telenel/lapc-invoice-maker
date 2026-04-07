import { NextRequest, NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { categoryCreateSchema } from "@/lib/validators";

export const GET = withAuth(async (request: NextRequest) => {
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
});

export const POST = withAdmin(async (request: NextRequest) => {
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
});
