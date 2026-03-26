import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceCreateSchema } from "@/lib/validators";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") as "DRAFT" | "FINAL" | null;
    const staffId = searchParams.get("staffId") ?? undefined;
    const department = searchParams.get("department") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const amountMin = searchParams.get("amountMin") ?? undefined;
    const amountMax = searchParams.get("amountMax") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10));
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortDir = (searchParams.get("sortDir") ?? "desc") as "asc" | "desc";

    const allowedSortFields = ["createdAt", "updatedAt", "date", "invoiceNumber", "totalAmount", "department", "status"];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

    const where: Prisma.InvoiceWhereInput = {};
    where.type = "INVOICE";

    if (status) {
      where.status = status;
    }
    if (staffId) {
      where.staffId = staffId;
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

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        include: {
          staff: { select: { id: true, name: true, title: true, department: true } },
          creator: { select: { id: true, name: true, username: true } },
        },
        orderBy: { [orderByField]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ invoices, total, page, pageSize });
  } catch (err) {
    console.error("GET /api/invoices failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = invoiceCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, date, ...invoiceData } = parsed.data;
  const createdBy = (session.user as { id: string }).id;

  const calculatedItems = items.map((item) => {
    const extendedPrice = Number(item.quantity) * Number(item.unitPrice);
    return { ...item, extendedPrice };
  });

  const totalAmount = calculatedItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);

  try {
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        date: new Date(date),
        createdBy,
        totalAmount,
        items: {
          create: calculatedItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            extendedPrice: item.extendedPrice,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        staff: { select: { id: true, name: true, title: true, department: true } },
        creator: { select: { id: true, name: true, username: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    // Save/update the account number for this staff member
    if (invoiceData.accountNumber && invoiceData.staffId) {
      await prisma.staffAccountNumber.upsert({
        where: {
          staffId_accountCode: {
            staffId: invoiceData.staffId,
            accountCode: invoiceData.accountNumber,
          },
        },
        update: { lastUsedAt: new Date() },
        create: {
          staffId: invoiceData.staffId,
          accountCode: invoiceData.accountNumber,
        },
      }).catch(() => {}); // Non-critical, don't fail the invoice
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An invoice with this number already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/invoices failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
