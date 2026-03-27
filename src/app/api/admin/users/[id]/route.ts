import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserUpdateSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "password123";

const userSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  active: true,
  setupComplete: true,
  createdAt: true,
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();

    if (body.resetPassword) {
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      const firstName = (await prisma.user.findUnique({ where: { id }, select: { name: true } }))
        ?.name.split(/\s+/)[0].toLowerCase() || "user";

      let username = firstName;
      let suffix = 2;
      while (true) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (!existing || existing.id === id) break;
        username = `${firstName}${suffix}`;
        suffix++;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { passwordHash, setupComplete: false, username },
        select: userSelect,
      });
      return NextResponse.json(updated);
    }

    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, email, role: newRole } = parsed.data;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(newRole !== undefined && { role: newRole }),
      },
      select: userSelect,
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("PUT /api/admin/users/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/users/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
