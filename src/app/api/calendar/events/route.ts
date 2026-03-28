import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const GET = withAuth(async (req: NextRequest, _session) => {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query parameters are required" },
      { status: 400 },
    );
  }

  const quotes = await prisma.invoice.findMany({
    where: {
      type: "QUOTE",
      isCateringEvent: true,
      quoteStatus: { in: ["SENT", "ACCEPTED"] },
      cateringDetails: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      quoteNumber: true,
      quoteStatus: true,
      recipientName: true,
      cateringDetails: true,
    },
  });

  const events = quotes
    .map((q) => {
      const details = q.cateringDetails as Record<string, unknown> | null;
      if (!details?.eventDate) return null;

      const eventDate = details.eventDate as string;
      if (eventDate < start || eventDate >= end) return null;

      const startTime = (details.startTime as string) || "09:00";
      const endTime = (details.endTime as string) || "10:00";

      return {
        id: q.id,
        title:
          (details.eventName as string) ||
          q.recipientName ||
          q.quoteNumber ||
          "Catering Event",
        start: `${eventDate}T${startTime}:00`,
        end: `${eventDate}T${endTime}:00`,
        location: (details.location as string) || "",
        headcount: (details.headcount as number) || null,
        quoteId: q.id,
        quoteNumber: q.quoteNumber,
        quoteStatus: q.quoteStatus,
        setupTime: (details.setupTime as string) || null,
        takedownTime: (details.takedownTime as string) || null,
      };
    })
    .filter(Boolean);

  return NextResponse.json(events);
});
