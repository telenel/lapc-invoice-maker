import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserUpdateSchema } from "@/lib/validators";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();

    // Handle reset code request separately (bypasses normal schema validation)
    if (body.resetCode) {
      let newCode: string;
      do {
        newCode = String(Math.floor(100000 + Math.random() * 900000));
      } while (await prisma.user.findUnique({ where: { accessCode: newCode } }));

      const updated = await prisma.user.update({
        where: { id: params.id },
        data: { accessCode: newCode, needsSetup: true },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          accessCode: true,
          role: true,
          active: true,
          createdAt: true,
        },
      });
      return NextResponse.json(updated);
    }

    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, email, role: newRole } = parsed.data;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(newRole !== undefined && { role: newRole }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        accessCode: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("PUT /api/admin/users/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.user.update({
      where: { id: params.id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/users/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
