import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quoteUpdateSchema } from "@/lib/validators";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const quote = await prisma.invoice.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, name: true, title: true, department: true, extension: true, email: true } },
        creator: { select: { id: true, name: true, username: true } },
        items: { orderBy: { sortOrder: "asc" } },
        convertedToInvoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    if (!quote || quote.type !== "QUOTE") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Auto-expire if past expiration date
    if (
      quote.expirationDate &&
      new Date(quote.expirationDate) < new Date() &&
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT")
    ) {
      await prisma.invoice.update({
        where: { id },
        data: { quoteStatus: "EXPIRED" },
      });
      quote.quoteStatus = "EXPIRED";
    }

    return NextResponse.json(quote);
  } catch (err) {
    console.error("GET /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing || existing.type !== "QUOTE") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    if (existing.quoteStatus === "ACCEPTED" || existing.quoteStatus === "DECLINED" || existing.quoteStatus === "EXPIRED") {
      return NextResponse.json({ error: "Cannot update a quote that is accepted, declined, or expired" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = quoteUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { items, date, expirationDate, ...quoteData } = parsed.data;

    const updateData: Record<string, unknown> = { ...quoteData };
    if (date) updateData.date = new Date(date);
    if (expirationDate) updateData.expirationDate = new Date(expirationDate);

    if (items) {
      const calculatedItems = items.map((item) => {
        const extendedPrice = Number(item.quantity) * Number(item.unitPrice);
        return { ...item, extendedPrice };
      });
      const totalAmount = calculatedItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
      updateData.totalAmount = totalAmount;

      await prisma.$transaction([
        prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
        prisma.invoice.update({
          where: { id },
          data: {
            ...updateData,
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
        }),
      ]);
    } else {
      await prisma.invoice.update({ where: { id }, data: updateData });
    }

    const quote = await prisma.invoice.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, name: true, title: true, department: true, extension: true, email: true } },
        creator: { select: { id: true, name: true, username: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(quote);
  } catch (err) {
    console.error("PUT /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const quote = await prisma.invoice.findUnique({ where: { id } });
    if (!quote || quote.type !== "QUOTE") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Delete PDF from disk if it exists
    if (quote.pdfPath) {
      const { unlink } = await import("fs/promises");
      try { await unlink(quote.pdfPath); } catch { /* ignore */ }
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/quotes/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
