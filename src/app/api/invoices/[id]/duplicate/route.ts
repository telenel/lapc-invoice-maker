import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { getInvoiceViewerAccess } from "@/domains/invoice/access";
import { invoiceService } from "@/domains/invoice/service";

export const POST = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const existing = await invoiceService.getById(id, { includeArchived: true });
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    const access = getInvoiceViewerAccess(existing, session.user.id, session.user.role === "admin");
    if (!access.canDuplicateInvoice) {
      return forbiddenResponse();
    }
    const invoice = await invoiceService.duplicate(id, session.user.id);
    return NextResponse.json(
      { invoice, redirectTo: `/invoices/${invoice.id}/edit` },
      { status: 201 }
    );
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    console.error("POST /api/invoices/[id]/duplicate failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
