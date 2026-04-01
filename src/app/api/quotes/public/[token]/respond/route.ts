import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { quoteService } from "@/domains/quote/service";
import { normalizeQuotePaymentDetails } from "@/domains/quote/payment";
import type { CateringDetails } from "@/domains/quote/types";

const cateringDetailsSchema = z.object({
  eventDate: z.string().trim().min(1, "Event date is required"),
  startTime: z.string().trim().min(1, "Start time is required"),
  endTime: z.string().trim().min(1, "End time is required"),
  location: z.string().trim().min(1, "Location is required"),
  contactName: z.string().trim().min(1, "Contact name is required"),
  contactPhone: z.string().trim().min(1, "Contact phone is required"),
  headcount: z.coerce.number().optional(),
  setupRequired: z.boolean().optional(),
  setupTime: z.string().optional(),
  setupInstructions: z.string().optional(),
  takedownRequired: z.boolean().optional(),
  takedownTime: z.string().optional(),
  takedownInstructions: z.string().optional(),
  specialInstructions: z.string().optional(),
});

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const response = body.response;
  if (response !== "ACCEPTED" && response !== "DECLINED") {
    return NextResponse.json({ error: "Invalid response. Must be ACCEPTED or DECLINED" }, { status: 400 });
  }

  try {
    const quote = await quoteService.getByShareToken(token);
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    if (quote.convertedToInvoice) {
      return NextResponse.json({ error: "This quote is no longer available" }, { status: 400 });
    }
    if (quote.quoteStatus === "EXPIRED") {
      return NextResponse.json({ error: "This quote has expired" }, { status: 400 });
    }
    if (!["SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL"].includes(quote.quoteStatus)) {
      return NextResponse.json(
        {
          error:
            quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED" || quote.quoteStatus === "REVISED"
              ? "This quote has already been responded to"
              : "This quote is no longer available",
        },
        { status: 400 },
      );
    }

    let cateringDetails: CateringDetails | undefined;
    if (response === "ACCEPTED") {
      if (quote.isCateringEvent && !body.cateringDetails) {
        return NextResponse.json(
          { error: "Catering details are required to approve this quote" },
          { status: 400 },
        );
      }
      if (!quote.isCateringEvent && body.cateringDetails) {
        return NextResponse.json(
          { error: "Catering details are only allowed for catering quotes" },
          { status: 400 },
        );
      }
    }
    if (response === "ACCEPTED" && body.cateringDetails) {
      const parsed = cateringDetailsSchema.safeParse(body.cateringDetails);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid catering details", details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }
      if (parsed.data.setupRequired && !parsed.data.setupTime?.trim()) {
        return NextResponse.json(
          { error: "Setup time is required when setup is needed" },
          { status: 400 },
        );
      }
      if (parsed.data.takedownRequired && !parsed.data.takedownTime?.trim()) {
        return NextResponse.json(
          { error: "Takedown time is required when takedown is needed" },
          { status: 400 },
        );
      }
      const existingCateringDetails = quote.cateringDetails as CateringDetails | null;
      cateringDetails = {
        eventDate: parsed.data.eventDate ?? "",
        startTime: parsed.data.startTime ?? "",
        endTime: parsed.data.endTime ?? "",
        location: parsed.data.location,
        contactName: parsed.data.contactName,
        contactPhone: parsed.data.contactPhone,
        setupRequired: parsed.data.setupRequired ?? existingCateringDetails?.setupRequired ?? false,
        setupInstructions: existingCateringDetails?.setupInstructions,
        takedownRequired: parsed.data.takedownRequired ?? existingCateringDetails?.takedownRequired ?? false,
        takedownInstructions: existingCateringDetails?.takedownInstructions,
        ...(parsed.data.headcount !== undefined
          ? { headcount: parsed.data.headcount }
          : existingCateringDetails?.headcount !== undefined
            ? { headcount: existingCateringDetails.headcount }
            : {}),
        ...(parsed.data.setupRequired === false
          ? {}
          : parsed.data.setupTime !== undefined
            ? { setupTime: parsed.data.setupTime }
            : existingCateringDetails?.setupTime !== undefined
              ? { setupTime: existingCateringDetails.setupTime }
              : {}),
        ...(parsed.data.takedownRequired === false
          ? {}
          : parsed.data.takedownTime !== undefined
            ? { takedownTime: parsed.data.takedownTime }
            : existingCateringDetails?.takedownTime !== undefined
              ? { takedownTime: existingCateringDetails.takedownTime }
              : {}),
        ...(parsed.data.specialInstructions !== undefined
          ? { specialInstructions: parsed.data.specialInstructions }
          : existingCateringDetails?.specialInstructions !== undefined
            ? { specialInstructions: existingCateringDetails.specialInstructions }
            : {}),
        ...(existingCateringDetails?.eventName !== undefined ? { eventName: existingCateringDetails.eventName } : {}),
        ...(existingCateringDetails?.contactEmail !== undefined ? { contactEmail: existingCateringDetails.contactEmail } : {}),
      } as CateringDetails;
    }

    const paymentDetailsInput =
      response === "ACCEPTED"
        ? (() => {
            const normalized = normalizeQuotePaymentDetails({
              paymentMethod: body.paymentMethod,
              accountNumber: body.accountNumber,
            });
            return normalized
              ? {
                  paymentMethod: normalized.paymentMethod,
                  accountNumber: normalized.paymentAccountNumber,
                }
              : undefined;
          })()
        : undefined;

    const result = await quoteService.respondToQuote(
      token,
      response,
      body.viewId,
      paymentDetailsInput,
      cateringDetails,
    );
    if (!result) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "INVALID_INPUT") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    if (code === "PAYMENT_ALREADY_RESOLVED") {
      return NextResponse.json({ error: (err as Error).message }, { status: 409 });
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    console.error("POST /api/quotes/public/[token]/respond failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
