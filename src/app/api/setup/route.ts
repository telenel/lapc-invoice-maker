import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { name, email, password } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check email uniqueness (excluding self)
  const existing = await prisma.user.findUnique({ where: { username: email.toLowerCase() } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "This email is already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // First user to complete setup becomes admin
  const userCount = await prisma.user.count({ where: { setupComplete: true } });
  const isFirstUser = userCount === 0;

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name.trim(),
      email: email.toLowerCase(),
      username: email.toLowerCase(),
      passwordHash,
      setupComplete: true,
      ...(isFirstUser && { role: "admin" }),
    },
  });

  return NextResponse.json({ success: true });
}
