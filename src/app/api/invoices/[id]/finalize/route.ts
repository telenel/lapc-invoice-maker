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
    signatures?: { line1?: string; line2?: string; line3?: string };
    semesterYearDept?: string;
    contactName?: string;
    contactExtension?: string;
  };

  // Convert signatures object { line1, line2, line3 } to array of { name }
  const resolvedSignatures: { name: string }[] = [];
  if (signatures) {
    if (signatures.line1) resolvedSignatures.push({ name: signatures.line1 });
    if (signatures.line2) resolvedSignatures.push({ name: signatures.line2 });
    if (signatures.line3) resolvedSignatures.push({ name: signatures.line3 });
  }

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
