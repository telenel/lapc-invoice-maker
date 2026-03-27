import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { accessCode } = body;

  if (!accessCode || !/^\d{6}$/.test(accessCode)) {
    return NextResponse.json({ error: "Access code must be exactly 6 digits" }, { status: 400 });
  }

  // Check if code is already taken by another user
  const existing = await prisma.user.findUnique({ where: { accessCode } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "This access code is already in use" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { accessCode, needsSetup: false },
  });

  return NextResponse.json({ success: true });
}
