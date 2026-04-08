import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await request.json().catch(() => null);
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, password } = body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check email uniqueness (excluding self)
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { username: normalizedEmail } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "This email is already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Atomic: first user to complete setup becomes admin.
  // Serializable isolation prevents two concurrent requests from both seeing count=0.
  await prisma.$transaction(
    async (tx) => {
      const userCount = await tx.user.count({ where: { setupComplete: true } });
      const isFirstUser = userCount === 0;

      await tx.user.update({
        where: { id: userId },
        data: {
          name: name.trim(),
          email: normalizedEmail,
          username: normalizedEmail,
          passwordHash,
          setupComplete: true,
          ...(isFirstUser && { role: "admin" }),
        },
      });
    },
    { isolationLevel: "Serializable" }
  );

  return NextResponse.json({ success: true });
}
