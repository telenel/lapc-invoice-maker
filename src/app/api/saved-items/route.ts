import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savedLineItemSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");

  const items = await prisma.savedLineItem.findMany({
    where: department ? { department } : undefined,
    orderBy: { usageCount: "desc" },
  });

  return NextResponse.json(
    items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = savedLineItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { department, description, unitPrice } = parsed.data;

  const item = await prisma.savedLineItem.upsert({
    where: { department_description: { department, description } },
    update: { unitPrice },
    create: { department, description, unitPrice },
  });

  return NextResponse.json({ ...item, unitPrice: Number(item.unitPrice) }, { status: 201 });
}
