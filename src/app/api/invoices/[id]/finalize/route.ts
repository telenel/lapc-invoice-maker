import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";

const finalizeBodySchema = z.object({
  signatures: z
    .object({
      line1: z.string().max(200).optional(),
      line2: z.string().max(200).optional(),
      line3: z.string().max(200).optional(),
    })
    .optional(),
  semesterYearDept: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  contactExtension: z.string().max(50).optional(),
  prismcorePath: z
    .string()
    .regex(/^(?!.*\.\.)uploads\/[a-zA-Z0-9_\-/.]+$/)
    .optional(),
}).passthrough();

export const POST = withAuth(async (req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  const rawBody = await req.json().catch(() => ({}));

  const parsed = finalizeBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;

  try {
    const existing = await invoiceService.getById(id, { includeArchived: true });
    if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
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
