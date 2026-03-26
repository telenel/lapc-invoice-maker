import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generateAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/admin/users failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, email } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    // Generate a unique 6-digit code
    let accessCode: string;
    let attempts = 0;
    do {
      accessCode = generateAccessCode();
      const existing = await prisma.user.findUnique({ where: { accessCode } });
      if (!existing) break;
      attempts++;
    } while (attempts < 100);

    if (attempts >= 100) {
      return NextResponse.json({ error: "Could not generate unique code" }, { status: 500 });
    }

    // Generate a username from the name
    const username = name.toLowerCase().replace(/\s+/g, ".") + "." + accessCode.slice(-3);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: "", // access-code-only users don't need a password
        name,
        email: email || "",
        accessCode,
        role: "user",
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

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
