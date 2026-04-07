import { NextRequest, NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { savedLineItemSchema } from "@/lib/validators";

export const GET = withAuth(async (request: NextRequest) => {
  try {
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
  } catch (err) {
    console.error("GET /api/saved-items failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = savedLineItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { department, description, unitPrice } = parsed.data;

  try {
    const item = await prisma.savedLineItem.upsert({
      where: { department_description: { department, description } },
      update: { unitPrice },
      create: { department, description, unitPrice },
    });

    return NextResponse.json({ ...item, unitPrice: Number(item.unitPrice) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/saved-items failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
