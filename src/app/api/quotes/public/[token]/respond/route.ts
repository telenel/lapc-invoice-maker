import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { quoteService } from "@/domains/quote/service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CateringDetails } from "@/domains/quote/types";

const cateringDetailsSchema = z.object({
  eventDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  location: z.string().min(1, "Location is required"),
  contactName: z.string().min(1, "Contact name is required"),
  contactPhone: z.string().min(1, "Contact phone is required"),
  contactEmail: z.string().optional(),
  headcount: z.number().optional(),
  eventName: z.string().optional(),
  setupRequired: z.boolean(),
  setupTime: z.string().optional(),
  setupInstructions: z.string().optional(),
  takedownRequired: z.boolean(),
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

    if (cateringDetails) {
      // Look up the quote to get its id for the update
      const quote = await prisma.invoice.findFirst({
        where: { shareToken: token },
        select: { id: true },
      });
      if (quote) {
        await prisma.invoice.update({
          where: { id: quote.id },
          data: { cateringDetails: cateringDetails as unknown as Prisma.InputJsonValue },
        });
      } else {
        console.error(`POST /api/quotes/public/${token}/respond: catering details provided but no quote found for token`);
      }
    }

    const result = await quoteService.respondToQuote(token, response, body.viewId);
    if (!result) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    console.error("POST /api/quotes/public/[token]/respond failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
