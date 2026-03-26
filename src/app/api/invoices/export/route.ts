import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { escapeCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") as "DRAFT" | "FINAL" | null;
    const category = searchParams.get("category") ?? undefined;
    const department = searchParams.get("department") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const amountMin = searchParams.get("amountMin") ?? undefined;
    const amountMax = searchParams.get("amountMax") ?? undefined;

    const where: Prisma.InvoiceWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (department) {
      where.department = { contains: department, mode: "insensitive" };
    }
    if (category) {
      where.category = category as Prisma.InvoiceWhereInput["category"];
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }
    if (amountMin || amountMax) {
      where.totalAmount = {};
      if (amountMin) where.totalAmount.gte = amountMin;
      if (amountMax) where.totalAmount.lte = amountMax;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { staff: { name: { contains: search, mode: "insensitive" } } },
        { items: { some: { description: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        staff: { select: { name: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Invoice Number",
      "Date",
      "Category",
      "Staff",
      "Department",
      "Account Number",
      "Account Code",
      "Total",
      "Status",
      "Items",
      "Notes",
    ];

    const rows = invoices.map((inv) => {
      const itemDescriptions = inv.items.map((item) => item.description).join("; ");
      return [
        inv.invoiceNumber ?? "",
        new Date(inv.date).toISOString().split("T")[0],
        inv.category,
        inv.staff.name,
        inv.department,
        inv.accountNumber,
        inv.accountCode,
        Number(inv.totalAmount).toFixed(2),
        inv.status,
        itemDescriptions,
        inv.notes ?? "",
      ].map(escapeCsv);
    });

    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="invoices-export.csv"',
      },
    });
  } catch (err) {
    console.error("GET /api/invoices/export failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
