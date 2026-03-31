import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safePublishAll } from "@/lib/sse";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const { paymentMethod, accountNumber } = body;
  if (!paymentMethod) {
    return NextResponse.json({ error: "paymentMethod is required" }, { status: 400 });
  }

  const quote = await prisma.invoice.findFirst({
    where: { shareToken: token, type: "QUOTE", quoteStatus: "ACCEPTED" },
    select: { id: true, quoteNumber: true, recipientEmail: true, createdBy: true },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found or not accepted" }, { status: 404 });
  }

  // Update payment info
  await prisma.invoice.update({
    where: { id: quote.id },
    data: {
      paymentMethod: String(paymentMethod),
      ...(accountNumber ? { accountNumber: String(accountNumber) } : {}),
    },
  });

  // Record the resolution as a follow-up event
  await prisma.quoteFollowUp.create({
    data: {
      invoiceId: quote.id,
      type: "PAYMENT_RESOLVED",
      recipientEmail: quote.recipientEmail ?? "",
      subject: `Payment details provided for ${quote.quoteNumber ?? "quote"}`,
      metadata: { paymentMethod, accountNumber: accountNumber ?? null },
    },
  });

  // Notify quote creator
  try {
    const { notificationService } = await import("@/domains/notification/service");
    await notificationService.createAndPublish({
      userId: quote.createdBy,
      type: "PAYMENT_DETAILS_RECEIVED",
      title: `Payment details received for ${quote.quoteNumber ?? "Quote"}`,
      message: `Payment method: ${paymentMethod}${accountNumber ? ` (Account: ${accountNumber})` : ""}`,
      quoteId: quote.id,
    });
  } catch {
    // Non-critical
  }

  safePublishAll({ type: "quote-changed" });
  return NextResponse.json({ success: true });
}
