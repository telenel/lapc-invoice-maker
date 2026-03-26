import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { pdfPath: true, invoiceNumber: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!invoice.pdfPath) {
    return NextResponse.json(
      { error: "PDF has not been generated for this invoice" },
      { status: 404 }
    );
  }

  try {
    const pdfBuffer = await readFile(invoice.pdfPath);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "PDF file not found on disk" },
      { status: 404 }
    );
  }
}
