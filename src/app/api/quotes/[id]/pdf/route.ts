import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotePDF } from "@/lib/pdf/generate-quote";

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
        staff: { select: { name: true, department: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!quote || quote.type !== "QUOTE") {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const pdfPath = await generateQuotePDF({
      quoteNumber: quote.quoteNumber ?? "DRAFT",
      date: quote.date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
      expirationDate: quote.expirationDate
        ? quote.expirationDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })
        : "",
      recipientName: quote.recipientName ?? "",
      recipientEmail: quote.recipientEmail ?? "",
      recipientOrg: quote.recipientOrg ?? "",
      department: quote.department,
      category: quote.category,
      accountCode: quote.accountCode,
      notes: quote.notes ?? "",
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        extendedPrice: Number(item.extendedPrice),
      })),
      totalAmount: Number(quote.totalAmount),
    });

    const { readFile } = await import("fs/promises");
    const pdfBuffer = await readFile(pdfPath);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${quote.quoteNumber ?? "quote"}.pdf"`,
      },
    });
  } catch (err) {
    console.error("GET /api/quotes/[id]/pdf failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
