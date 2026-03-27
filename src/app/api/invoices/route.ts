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
    const createdFrom = searchParams.get("createdFrom") ?? undefined;
    const createdTo = searchParams.get("createdTo") ?? undefined;
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
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt.gte = new Date(createdFrom);
      if (createdTo) where.createdAt.lte = new Date(createdTo + "T23:59:59.999Z");
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

    // Stats-only mode: return count + sum without fetching records
    const statsOnly = searchParams.get("statsOnly") === "true";
    const groupBy = searchParams.get("groupBy");

    if (statsOnly && groupBy === "creator") {
      // Get current month boundaries
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const invoices = await prisma.invoice.findMany({
        where: {
          type: "INVOICE",
          status: "FINAL",
          createdAt: { gte: firstOfMonth },
        },
        select: {
          totalAmount: true,
          creator: { select: { id: true, name: true } },
        },
      });

      // Aggregate by creator
      const userMap = new Map<string, { id: string; name: string; invoiceCount: number; totalAmount: number }>();
      for (const inv of invoices) {
        const key = inv.creator.id;
        const existing = userMap.get(key);
        if (existing) {
          existing.invoiceCount++;
          existing.totalAmount += Number(inv.totalAmount);
        } else {
          userMap.set(key, {
            id: inv.creator.id,
            name: inv.creator.name,
            invoiceCount: 1,
            totalAmount: Number(inv.totalAmount),
          });
        }
      }

      const users = Array.from(userMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
      return NextResponse.json({ users });
    }

    if (statsOnly) {
      const [agg, total] = await prisma.$transaction([
        prisma.invoice.aggregate({ where, _sum: { totalAmount: true } }),
        prisma.invoice.count({ where }),
      ]);
      return NextResponse.json({
        total,
        sumTotalAmount: Number(agg._sum.totalAmount ?? 0),
      });
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

  const { items, date, status, invoiceNumber, ...invoiceData } = parsed.data;
  const createdBy = (session.user as { id: string }).id;
  // Convert empty/null invoice number to null (avoids unique constraint on empty strings)
  const normalizedInvoiceNumber = invoiceNumber || null;

  const calculatedItems = items.map((item) => {
    const extendedPrice = Number(item.quantity) * Number(item.unitPrice);
    return { ...item, extendedPrice };
  });

  const totalAmount = calculatedItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);

  try {
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        invoiceNumber: normalizedInvoiceNumber,
        ...(status ? { status } : {}),
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
