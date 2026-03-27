import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffAccountNumberSchema } from "@/lib/validators";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized", status: 401 } as const;
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return { error: "Forbidden", status: 403 } as const;
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  try {
    const codes = await prisma.staffAccountNumber.findMany({
      include: { staff: { select: { id: true, name: true, department: true } } },
      orderBy: [{ accountCode: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(codes);
  } catch {
    return NextResponse.json({ error: "Failed to fetch account codes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  try {
    const body = await request.json();
    const { staffId, ...rest } = body;

    if (!staffId) {
      return NextResponse.json({ error: "Staff member is required" }, { status: 400 });
    }

    const parsed = staffAccountNumberSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const created = await prisma.staffAccountNumber.create({
      data: {
        staffId,
        accountCode: parsed.data.accountCode.trim(),
        description: parsed.data.description.trim(),
      },
      include: { staff: { select: { id: true, name: true, department: true } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "This account code already exists for that staff member" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create account code" }, { status: 500 });
  }
}
