import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";

export const POST = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const existing = await invoiceService.getById(id);
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
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
    console.error("POST /api/invoices/[id]/duplicate failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
