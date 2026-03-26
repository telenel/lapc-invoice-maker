import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { quoteCreateSchema } from "@/lib/validators";
import { generateQuoteNumber } from "@/lib/quote-number";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") ?? undefined;
    const quoteStatus = searchParams.get("quoteStatus") ?? undefined;
    const department = searchParams.get("department") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10));
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortDir = (searchParams.get("sortDir") ?? "desc") as "asc" | "desc";

    const allowedSortFields = ["createdAt", "updatedAt", "date", "quoteNumber", "totalAmount", "department", "expirationDate"];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

    const where: Prisma.InvoiceWhereInput = { type: "QUOTE" };

    // Auto-expire: update any DRAFT or SENT quotes past expiration
    await prisma.invoice.updateMany({
      where: {
        type: "QUOTE",
        quoteStatus: { in: ["DRAFT", "SENT"] },
        expirationDate: { lt: new Date() },
      },
      data: { quoteStatus: "EXPIRED" },
    });

    if (quoteStatus && quoteStatus !== "all") {
      where.quoteStatus = quoteStatus as Prisma.InvoiceWhereInput["quoteStatus"];
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
    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { recipientName: { contains: search, mode: "insensitive" } },
        { recipientOrg: { contains: search, mode: "insensitive" } },
        { staff: { name: { contains: search, mode: "insensitive" } } },
        { items: { some: { description: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [quotes, total] = await prisma.$transaction([
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

    return NextResponse.json({ quotes, total, page, pageSize });
  } catch (err) {
    console.error("GET /api/quotes failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = quoteCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, date, expirationDate, ...quoteData } = parsed.data;
  const createdBy = (session.user as { id: string }).id;

  const calculatedItems = items.map((item) => {
    const extendedPrice = Number(item.quantity) * Number(item.unitPrice);
    return { ...item, extendedPrice };
  });

  const totalAmount = calculatedItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
  const quoteNumber = await generateQuoteNumber();

  try {
    const quote = await prisma.invoice.create({
      data: {
        ...quoteData,
        type: "QUOTE",
        quoteStatus: "DRAFT",
        quoteNumber,
        date: new Date(date),
        expirationDate: new Date(expirationDate),
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

    return NextResponse.json(quote, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A quote with this number already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/quotes failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
