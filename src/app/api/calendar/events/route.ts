import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { eventService } from "@/domains/event/service";
import { BIRTHDAY_COLOR, CATERING_COLOR } from "@/domains/event/types";
import type { CalendarEventItem } from "@/domains/event/types";

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

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);
  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime()) ||
    rangeStart >= rangeEnd
  ) {
    return NextResponse.json(
      { error: "Invalid date range. Use valid ISO dates and ensure start < end." },
      { status: 400 },
    );
  }

  // Fetch all three data sources in parallel
  const [quotes, manualEvents, staffWithBirthdays] = await Promise.all([
    prisma.invoice.findMany({
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
    }),
    eventService.listForDateRange(rangeStart, rangeEnd),
    prisma.staff.findMany({
      where: {
        birthMonth: { not: null },
        birthDay: { not: null },
        active: true,
      },
      select: {
        id: true,
        name: true,
        birthMonth: true,
        birthDay: true,
      },
    }),
  ]);

  const cateringEvents: CalendarEventItem[] = [];
  for (const q of quotes) {
    const details = q.cateringDetails as Record<string, unknown> | null;
    if (!details?.eventDate) continue;

    const eventDate = details.eventDate as string;
    if (eventDate < start || eventDate >= end) continue;

    const startTime = (details.startTime as string) || "09:00";
    const endTime = (details.endTime as string) || "10:00";

    cateringEvents.push({
      id: q.id,
      title:
        (details.eventName as string) ||
        q.recipientName ||
        q.quoteNumber ||
        "Catering Event",
      start: `${eventDate}T${startTime}:00`,
      end: `${eventDate}T${endTime}:00`,
      allDay: false,
      color: `${CATERING_COLOR}80`,
      borderColor: CATERING_COLOR,
      textColor: CATERING_COLOR,
      source: "catering",
      extendedProps: {
        location: (details.location as string) || null,
        headcount: (details.headcount as number) || null,
        quoteId: q.id,
        quoteNumber: q.quoteNumber,
        quoteStatus: q.quoteStatus,
        setupTime: (details.setupTime as string) || null,
        takedownTime: (details.takedownTime as string) || null,
      },
    });
  }

  const birthdayEvents: CalendarEventItem[] = [];

  for (const staff of staffWithBirthdays) {
    if (staff.birthMonth === null || staff.birthDay === null) continue;

    // Check each year in the range (handles ranges spanning year boundaries)
    const startYear = rangeStart.getFullYear();
    const endYear = rangeEnd.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      const bMonth: string = String(staff.birthMonth).padStart(2, "0");
      const bDay: string = String(staff.birthDay).padStart(2, "0");
      const bDateStr: string = `${year}-${bMonth}-${bDay}`;
      const bDate: Date = new Date(bDateStr);

      // Skip invalid dates (e.g., Feb 29 on non-leap years)
      if (isNaN(bDate.getTime()) || bDate.getMonth() + 1 !== staff.birthMonth) continue;

      if (bDate >= rangeStart && bDate < rangeEnd) {
        birthdayEvents.push({
          id: `birthday-${staff.id}-${year}`,
          title: `🎂 ${staff.name}'s Birthday`,
          start: bDateStr,
          end: null,
          allDay: true,
          color: `${BIRTHDAY_COLOR}80`,
          borderColor: BIRTHDAY_COLOR,
          textColor: BIRTHDAY_COLOR,
          source: "birthday",
          extendedProps: {
            staffId: staff.id,
          },
        });
      }
    }
  }


  return NextResponse.json([
    ...cateringEvents,
    ...manualEvents,
    ...birthdayEvents,
  ]);
});
