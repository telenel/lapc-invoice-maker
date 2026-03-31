import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeQuotePaymentDetails } from "@/domains/quote/payment";
import { prisma } from "@/lib/prisma";
import { safePublishAll } from "@/lib/sse";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  let paymentDetails;
  try {
    paymentDetails = normalizeQuotePaymentDetails({
      paymentMethod: body.paymentMethod,
      accountNumber: body.accountNumber,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  if (!paymentDetails) {
    return NextResponse.json({ error: "paymentMethod is required" }, { status: 400 });
  }

  const quote = await prisma.invoice.findFirst({
    where: { shareToken: token, type: "QUOTE", quoteStatus: "ACCEPTED" },
    select: {
      id: true,
      quoteNumber: true,
      recipientEmail: true,
      createdBy: true,
      paymentMethod: true,
      convertedToInvoice: { select: { id: true } },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found or not accepted" }, { status: 404 });
  }
  if (quote.paymentMethod) {
    return NextResponse.json({ error: "Payment details have already been provided" }, { status: 409 });
  }

  // Update payment info on the quote and any converted invoice that now carries the live accounting state.
  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: quote.id },
      data: {
        paymentMethod: paymentDetails.paymentMethod,
        paymentAccountNumber: paymentDetails.paymentAccountNumber,
      },
    }),
    ...(quote.convertedToInvoice
      ? [
          prisma.invoice.update({
            where: { id: quote.convertedToInvoice.id },
            data: {
              paymentMethod: paymentDetails.paymentMethod,
              paymentAccountNumber: paymentDetails.paymentAccountNumber,
            },
          }),
        ]
      : []),
  ]);

  // Record the resolution as a follow-up event
  await prisma.quoteFollowUp.create({
    data: {
      invoiceId: quote.id,
      type: "PAYMENT_RESOLVED",
      recipientEmail: quote.recipientEmail ?? "",
      subject: `Payment details provided for ${quote.quoteNumber ?? "quote"}`,
      metadata: {
        paymentMethod: paymentDetails.paymentMethod,
        paymentAccountNumber: paymentDetails.paymentAccountNumber,
      } as Prisma.InputJsonValue,
    },
  });

  // Notify quote creator
  try {
    const { notificationService } = await import("@/domains/notification/service");
    await notificationService.createAndPublish({
      userId: quote.createdBy,
      type: "PAYMENT_DETAILS_RECEIVED",
      title: `Payment details received for ${quote.quoteNumber ?? "Quote"}`,
      message: `Payment method: ${paymentDetails.paymentMethod}${paymentDetails.paymentAccountNumber ? ` (Account: ${paymentDetails.paymentAccountNumber})` : ""}`,
      quoteId: quote.id,
    });
  } catch {
    // Non-critical
  }

  safePublishAll({ type: "quote-changed" });
  if (quote.convertedToInvoice) {
    safePublishAll({ type: "invoice-changed" });
  }
  return NextResponse.json({ success: true });
}
