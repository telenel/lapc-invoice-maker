import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [
      users,
      staff,
      invoices,
      invoiceItems,
      categories,
      quickPickItems,
      staffAccountNumbers,
      staffSignerHistory,
      savedLineItems,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.staff.count(),
      prisma.invoice.count(),
      prisma.invoiceItem.count(),
      prisma.category.count(),
      prisma.quickPickItem.count(),
      prisma.staffAccountNumber.count(),
      prisma.staffSignerHistory.count(),
      prisma.savedLineItem.count(),
    ]);

    // Try to get database size (PostgreSQL specific)
    let dbSize: string | null = null;
    try {
      const result = await prisma.$queryRaw<{ size: string }[]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      dbSize = result[0]?.size ?? null;
    } catch {
      // Not critical if this fails
    }

    return NextResponse.json({
      status: "connected",
      timestamp: new Date().toISOString(),
      dbSize,
      tables: {
        users,
        staff,
        invoices,
        invoiceItems,
        categories,
        quickPickItems,
        staffAccountNumbers,
        staffSignerHistory,
        savedLineItems,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    return NextResponse.json(
      { status: "error", message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
