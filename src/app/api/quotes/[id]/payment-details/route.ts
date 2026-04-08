import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";

const paymentDetailsSchema = z.object({
  paymentMethod: z.string().optional(),
  accountNumber: z.string().nullable().optional(),
});

export const POST = withAuth(async (req: NextRequest, session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = rawId.trim();
  if (!id) {
    return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    const rawBody = await req.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = paymentDetailsSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const existing = await quoteService.getById(id);
    if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (session.user.role !== "admin" && existing.creatorId !== session.user.id) {
      return forbiddenResponse();
    }
    const result = await quoteService.updateAcceptedPaymentDetails(id, parsedBody.data);
    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (code === "INVALID_INPUT") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    if (code === "PAYMENT_ALREADY_RESOLVED") {
      return NextResponse.json({ error: (err as Error).message }, { status: 409 });
    }
    if (code === "FORBIDDEN") return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    console.error("POST /api/quotes/[id]/payment-details failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
