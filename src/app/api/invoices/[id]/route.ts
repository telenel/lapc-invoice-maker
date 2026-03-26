import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceUpdateSchema } from "@/lib/validators";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, name: true, title: true, department: true, extension: true, email: true } },
        creator: { select: { id: true, name: true, username: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (err) {
    console.error("GET /api/invoices/[id] failed:", err);
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
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (existing.status === "FINAL") {
      return NextResponse.json({ error: "Cannot update a finalized invoice" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = invoiceUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { items, date, ...invoiceData } = parsed.data;

    const updateData: Record<string, unknown> = { ...invoiceData };
    if (date) {
      updateData.date = new Date(date);
    }

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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, name: true, title: true, department: true, extension: true, email: true } },
        creator: { select: { id: true, name: true, username: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(invoice);
  } catch (err) {
    console.error("PUT /api/invoices/[id] failed:", err);
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
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Delete PDF file from disk if FINAL and has pdfPath
    if (invoice.status === "FINAL" && invoice.pdfPath) {
      try {
        await unlink(invoice.pdfPath);
      } catch {
        // File may not exist on disk — ignore
      }
    }

    // Delete prismcore file if present
    if (invoice.prismcorePath) {
      try {
        const prismcoreFullPath = path.resolve(process.cwd(), "public", invoice.prismcorePath);
        await unlink(prismcoreFullPath);
      } catch {
        // File may not exist on disk — ignore
      }
    }

    // Delete the invoice (Prisma cascade will handle items)
    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/invoices/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
