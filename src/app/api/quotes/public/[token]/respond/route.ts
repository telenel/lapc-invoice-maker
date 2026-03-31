import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { quoteService } from "@/domains/quote/service";
import { normalizeQuotePaymentDetails } from "@/domains/quote/payment";
import type { Prisma } from "@/generated/prisma/client";
import type { CateringDetails } from "@/domains/quote/types";

const cateringDetailsSchema = z.object({
  eventDate: z.string().optional().default(""),
  startTime: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
  location: z.string().min(1, "Location is required"),
  contactName: z.string().min(1, "Contact name is required"),
  contactPhone: z.string().min(1, "Contact phone is required"),
  contactEmail: z.string().optional().default(""),
  headcount: z.coerce.number().optional(),
  eventName: z.string().optional().default(""),
  setupRequired: z.boolean().optional().default(false),
  setupTime: z.string().optional().default(""),
  setupInstructions: z.string().optional().default(""),
  takedownRequired: z.boolean().optional().default(false),
  takedownTime: z.string().optional().default(""),
  takedownInstructions: z.string().optional().default(""),
  specialInstructions: z.string().optional().default(""),
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

    // If catering details were submitted, validate and persist them before processing the response
    let cateringDetails: CateringDetails | undefined;
    if (body.cateringDetails) {
      const parsed = cateringDetailsSchema.safeParse(body.cateringDetails);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid catering details", details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }
      cateringDetails = parsed.data as CateringDetails;
    }

    // Extract payment details from the body
    const paymentDetails = normalizeQuotePaymentDetails({
      paymentMethod: body.paymentMethod,
      accountNumber: body.accountNumber,
    });

    const result = await quoteService.respondToQuote(token, response, body.viewId, paymentDetails);
    if (!result) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    if (response === "ACCEPTED" && cateringDetails) {
      await quoteService.update(result.id, {
        cateringDetails: cateringDetails as Prisma.InputJsonValue,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "INVALID_INPUT") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    console.error("POST /api/quotes/public/[token]/respond failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
