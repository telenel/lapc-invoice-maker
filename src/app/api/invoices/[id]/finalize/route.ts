import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicePDF } from "@/lib/pdf/generate";
import { mergePrismCorePDF } from "@/lib/pdf/merge";

function formatCurrency(value: unknown): string {
  const num = Number(value);
  return `$${num.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      staff: true,
      creator: { select: { id: true, name: true, username: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "FINAL") {
    return NextResponse.json(
      { error: "Invoice is already finalized" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const {
    prismcorePath,
    signatures,
    semesterYearDept,
    contactName,
    contactExtension,
  } = body as {
    prismcorePath?: string;
    signatures?: { name: string; title?: string }[];
    semesterYearDept?: string;
    contactName?: string;
    contactExtension?: string;
  };

  // Build approval chain names for signatures
  const approvalChain = (invoice.approvalChain as string[]) ?? [];
  const resolvedSignatures =
    signatures ??
    approvalChain.map((name) => ({ name }));

  const dateStr = formatDate(new Date(invoice.date));
  const totalStr = formatCurrency(invoice.totalAmount);

  // Generate PDF
  const pdfPath = await generateInvoicePDF({
    coverSheet: {
      date: dateStr,
      semesterYearDept: semesterYearDept ?? invoice.department,
      invoiceNumber: invoice.invoiceNumber,
      chargeAccountNumber: invoice.accountCode,
      accountCode: invoice.accountCode,
      totalAmount: totalStr,
      signatures: resolvedSignatures,
    },
    idp: {
      date: dateStr,
      department: invoice.department,
      documentNumber: invoice.invoiceNumber,
      requestingDept: invoice.department,
      sapAccount: invoice.accountCode,
      estimatedCost: totalStr,
      approverName:
        resolvedSignatures.length > 0 ? resolvedSignatures[0].name : "",
      contactName: contactName ?? invoice.staff.name,
      contactPhone: contactExtension ?? invoice.staff.extension,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity).toString(),
        unitPrice: formatCurrency(item.unitPrice),
        extendedPrice: formatCurrency(item.extendedPrice),
      })),
      totalAmount: totalStr,
    },
  });

  // Merge PrismCore PDF if provided
  if (prismcorePath) {
    await mergePrismCorePDF(pdfPath, prismcorePath);
  }

  // Update invoice status
  await prisma.invoice.update({
    where: { id },
    data: {
      status: "FINAL",
      pdfPath,
      prismcorePath: prismcorePath ?? null,
    },
  });

  // Increment usage count on matching quick-pick items
  const descriptions = invoice.items.map((item) => item.description);
  if (descriptions.length > 0) {
    await prisma.quickPickItem.updateMany({
      where: {
        department: invoice.department,
        description: { in: descriptions },
      },
      data: { usageCount: { increment: 1 } },
    });
  }

  return NextResponse.json({ success: true, pdfPath });
}
