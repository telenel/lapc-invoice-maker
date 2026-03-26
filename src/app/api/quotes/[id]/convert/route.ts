import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  try {
    const quote = await prisma.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!quote || quote.type !== "QUOTE") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.quoteStatus === "ACCEPTED") {
      return NextResponse.json({ error: "Quote has already been converted" }, { status: 400 });
    }
    if (quote.quoteStatus === "DECLINED" || quote.quoteStatus === "EXPIRED") {
      return NextResponse.json({ error: "Cannot convert a declined or expired quote" }, { status: 400 });
    }

    const createdBy = (session.user as { id: string }).id;
    const now = new Date();

    // Create Invoice DRAFT with data copied from the quote
    const [invoice] = await prisma.$transaction([
      prisma.invoice.create({
        data: {
          type: "INVOICE",
          status: "DRAFT",
          // invoiceNumber left null — user enters PO-XXXXXX from POS
          date: quote.date,
          category: quote.category,
          department: quote.department,
          staffId: quote.staffId,
          accountCode: quote.accountCode,
          accountNumber: quote.accountNumber,
          approvalChain: quote.approvalChain ?? [],
          notes: quote.notes,
          totalAmount: quote.totalAmount,
          createdBy,
          convertedFromQuoteId: quote.id,
          items: {
            create: quote.items.map((item) => ({
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
          items: { orderBy: { sortOrder: "asc" } },
        },
      }),
      // Mark the quote as accepted
      prisma.invoice.update({
        where: { id },
        data: {
          quoteStatus: "ACCEPTED",
          convertedAt: now,
        },
      }),
    ]);

    return NextResponse.json({ invoice, redirectTo: `/invoices/${invoice.id}/edit` }, { status: 201 });
  } catch (err) {
    console.error("POST /api/quotes/[id]/convert failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
