import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const paginated = searchParams.has("page");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

    const where = {
      active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { department: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    // If no ?page param, return flat array for backward compatibility
    if (!paginated) {
      const staff = await prisma.staff.findMany({
        where,
        orderBy: { name: "asc" },
        include: { accountNumbers: { orderBy: { lastUsedAt: "desc" } } },
      });
      return NextResponse.json(staff);
    }

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        orderBy: { name: "asc" },
        include: { accountNumbers: { orderBy: { lastUsedAt: "desc" } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.staff.count({ where }),
    ]);

    return NextResponse.json({ staff, total, page, pageSize });
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
