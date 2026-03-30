import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";
import { pdfService } from "@/domains/pdf/service";

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;

  const invoice = await invoiceService.getById(id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (!invoice.pdfPath) {
    return NextResponse.json(
      { error: "PDF has not been generated for this invoice" },
      { status: 404 }
    );
  }

  try {
    const pdfBuffer = await pdfService.readPdf(invoice.pdfPath);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${(invoice.invoiceNumber ?? "invoice").replace(/[\r\n"]/g, "")}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("GET /api/invoices/[id]/pdf failed:", err);
    return NextResponse.json({ error: "PDF file not found on disk" }, { status: 404 });
  }
});
