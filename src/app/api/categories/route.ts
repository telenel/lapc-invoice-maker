import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  const categories = await prisma.category.findMany({
    where: all ? undefined : { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, label } = body;

  if (!name || !label) {
    return NextResponse.json({ error: "name and label are required" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: { name, label },
  });

  return NextResponse.json(category, { status: 201 });
}
