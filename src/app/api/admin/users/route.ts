import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserCreateSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "password123";

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
        role: true,
        active: true,
        setupComplete: true,
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
  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name } = parsed.data;

  try {
    const firstName = name.trim().split(/\s+/)[0].toLowerCase();
    let username = firstName;
    let suffix = 2;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${firstName}${suffix}`;
      suffix++;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        name: name.trim(),
        role: "user",
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        active: true,
        setupComplete: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
