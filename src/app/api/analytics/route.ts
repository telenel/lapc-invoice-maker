import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;

    const dateFilter =
      dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : undefined;

    // byCategory groupBy
    const categoryGroups = await prisma.invoice.groupBy({
      by: ["category"],
      _count: true,
      _sum: { totalAmount: true },
      where: dateFilter,
    });

    const byCategory = categoryGroups.map((g) => ({
      category: g.category,
      count: g._count,
      total: Number(g._sum.totalAmount ?? 0),
    }));

    // byDepartment groupBy — top 10 by total
    const departmentGroups = await prisma.invoice.groupBy({
      by: ["department"],
      _count: true,
      _sum: { totalAmount: true },
      where: dateFilter,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });

    const byDepartment = departmentGroups.map((g) => ({
      department: g.department,
      count: g._count,
      total: Number(g._sum.totalAmount ?? 0),
    }));

    // byMonth and trend — fetch all invoices in range, aggregate in JS
    const invoices = await prisma.invoice.findMany({
      where: dateFilter,
      select: { date: true, totalAmount: true },
      orderBy: { date: "asc" },
    });

    const monthMap = new Map<string, { count: number; total: number }>();
    for (const inv of invoices) {
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) ?? { count: 0, total: 0 };
      monthMap.set(key, {
        count: existing.count + 1,
        total: existing.total + Number(inv.totalAmount),
      });
    }

    const sortedMonths = Array.from(monthMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    const byMonth = sortedMonths.map(([month, data]) => ({
      month,
      count: data.count,
      total: data.total,
    }));

    const trend = sortedMonths.map(([month, data]) => ({
      month,
      count: data.count,
    }));

    // byUser groupBy
    const userGroups = await prisma.invoice.groupBy({
      by: ["createdBy"],
      _count: true,
      _sum: { totalAmount: true },
      where: dateFilter,
    });

    const userIds = userGroups.map((g) => g.createdBy);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const byUser = userGroups
      .map((g) => {
        const user = users.find((u) => u.id === g.createdBy);
        return {
          user: user?.name ?? "Unknown",
          count: g._count,
          total: Number(g._sum?.totalAmount ?? 0),
        };
      })
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ byCategory, byMonth, byDepartment, trend, byUser });
  } catch (err) {
    console.error("GET /api/analytics failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
