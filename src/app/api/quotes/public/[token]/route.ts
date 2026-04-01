import { NextRequest, NextResponse } from "next/server";
import { isPublicPaymentLinkAvailable, quoteService } from "@/domains/quote/service";
import type { PublicQuoteResponse, QuoteResponse } from "@/domains/quote/types";

type RouteContext = { params: Promise<{ token: string }> };

/** Strip internal-only fields before returning to public consumers. */
function sanitizeForPublic(quote: QuoteResponse): Omit<PublicQuoteResponse, "paymentLinkAvailable"> {
  const cateringDetails = quote.cateringDetails
    ? {
        eventDate: quote.cateringDetails.eventDate,
        startTime: quote.cateringDetails.startTime,
        endTime: quote.cateringDetails.endTime,
        location: quote.cateringDetails.location,
        contactName: quote.cateringDetails.contactName,
        contactPhone: quote.cateringDetails.contactPhone,
        ...(quote.cateringDetails.headcount !== undefined ? { headcount: quote.cateringDetails.headcount } : {}),
        setupRequired: quote.cateringDetails.setupRequired ?? false,
        ...(quote.cateringDetails.setupTime !== undefined ? { setupTime: quote.cateringDetails.setupTime } : {}),
        takedownRequired: quote.cateringDetails.takedownRequired ?? false,
        ...(quote.cateringDetails.takedownTime !== undefined ? { takedownTime: quote.cateringDetails.takedownTime } : {}),
        ...(quote.cateringDetails.specialInstructions !== undefined ? { specialInstructions: quote.cateringDetails.specialInstructions } : {}),
      }
    : null;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    quoteStatus: quote.quoteStatus,
    date: quote.date,
    expirationDate: quote.expirationDate,
    department: quote.department,
    category: quote.category,
    notes: quote.notes,
    totalAmount: quote.totalAmount,
    recipientName: quote.recipientName,
    recipientEmail: quote.recipientEmail,
    recipientOrg: quote.recipientOrg,
    staff: quote.staff
      ? {
          name: quote.staff.name,
          title: quote.staff.title,
          department: quote.staff.department,
          extension: null,
          email: null,
        }
      : null,
    contact: quote.contact
      ? {
          name: quote.contact.name,
          email: quote.contact.email,
          phone: quote.contact.phone,
          org: quote.contact.org,
          department: quote.contact.department,
          title: quote.contact.title,
        }
      : null,
    items: quote.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      extendedPrice: item.extendedPrice,
      sortOrder: item.sortOrder,
      isTaxable: item.isTaxable,
    })),
    isCateringEvent: quote.isCateringEvent,
    cateringDetails,
    paymentDetailsResolved: quote.paymentDetailsResolved,
  };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const quote = await quoteService.getByShareToken(token);

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...sanitizeForPublic(quote),
    paymentLinkAvailable: isPublicPaymentLinkAvailable(quote),
  });
}
