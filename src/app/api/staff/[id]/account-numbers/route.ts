import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/staff/:id/account-numbers — list account numbers for a staff member, most recent first
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const accounts = await prisma.staffAccountNumber.findMany({
      where: { staffId: params.id },
      orderBy: { lastUsedAt: "desc" },
    });

    return NextResponse.json(accounts);
  } catch (err) {
    console.error("GET /api/staff/[id]/account-numbers failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/staff/:id/account-numbers — add or update an account number
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { accountCode, description } = body as {
    accountCode: string;
    description?: string;
  };

  if (!accountCode?.trim()) {
    return NextResponse.json(
      { error: "Account code is required" },
      { status: 400 }
    );
  }

  try {
    // Upsert: create if new, update lastUsedAt + description if exists
    const account = await prisma.staffAccountNumber.upsert({
      where: {
        staffId_accountCode: {
          staffId: params.id,
          accountCode: accountCode.trim(),
        },
      },
      update: {
        lastUsedAt: new Date(),
        ...(description !== undefined ? { description } : {}),
      },
      create: {
        staffId: params.id,
        accountCode: accountCode.trim(),
        description: description?.trim() ?? "",
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    console.error("POST /api/staff/[id]/account-numbers failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
