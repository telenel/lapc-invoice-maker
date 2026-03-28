import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";

export const POST = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json().catch(() => ({}));

  try {
    const result = await invoiceService.finalize(id, body);
    return NextResponse.json({ success: true, pdfPath: result.pdfPath });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (code === "VALIDATION") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("POST /api/invoices/[id]/finalize failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
