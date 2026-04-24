import { prisma } from "@/lib/prisma";
import { eventService } from "@/domains/event/service";
import { Prisma, type QuoteStatus } from "@/generated/prisma/client";
import { BIRTHDAY_COLOR, CATERING_COLOR, type CalendarEventItem } from "@/domains/event/types";
import { addDaysToDateKey, fromDateKey, getDateKeyInLosAngeles } from "@/lib/date-utils";

export interface CalendarBootstrapRange {
  start: string;
  end: string;
  events: CalendarEventItem[];
}

export interface CalendarBootstrapData {
  desktop: CalendarBootstrapRange;
  mobile: CalendarBootstrapRange;
}

function getWeekStartDateKey(date = new Date()): string {
  const currentDateKey = getDateKeyInLosAngeles(date);
  const dayOfWeek = fromDateKey(currentDateKey).getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addDaysToDateKey(currentDateKey, mondayOffset);
}

type CateringQuoteRow = {
  id: string;
  quoteNumber: string | null;
  quoteStatus: QuoteStatus | null;
  recipientName: string | null;
  totalAmount: Prisma.Decimal | number | string | null;
  cateringDetails: Prisma.JsonValue | null;
};

function eventStartDateKey(event: CalendarEventItem): string | null {
  const start = event.start;
  if (typeof start !== "string" || start.length < 10) {
    return null;
  }
  return start.slice(0, 10);
}

function filterEventsForRange(
  events: CalendarEventItem[],
  start: string,
  end: string,
): CalendarEventItem[] {
  return events.filter((event) => {
    const dateKey = eventStartDateKey(event);
    return dateKey != null && dateKey >= start && dateKey < end;
  });
}

async function findCateringQuotesForRange(
  start: string,
  end: string,
): Promise<CateringQuoteRow[]> {
  if (typeof prisma.$queryRaw === "function") {
    return prisma.$queryRaw<CateringQuoteRow[]>`
      SELECT
        id,
        quote_number AS "quoteNumber",
        quote_status AS "quoteStatus",
        recipient_name AS "recipientName",
        total_amount AS "totalAmount",
        catering_details AS "cateringDetails"
      FROM invoices
      WHERE type = 'QUOTE'
        AND is_catering_event = true
        AND archived_at IS NULL
        AND quote_status IN ('SENT', 'ACCEPTED')
        AND catering_details IS NOT NULL
        AND catering_details <> 'null'::jsonb
        AND catering_details->>'eventDate' >= ${start}
        AND catering_details->>'eventDate' < ${end}
    `;
  }

  return prisma.invoice.findMany({
    where: {
      type: "QUOTE",
      isCateringEvent: true,
      archivedAt: null,
      quoteStatus: { in: ["SENT", "ACCEPTED"] },
      cateringDetails: { not: Prisma.JsonNull },
    },
    select: {
      id: true,
      quoteNumber: true,
      quoteStatus: true,
      recipientName: true,
      totalAmount: true,
      cateringDetails: true,
    },
  });
}

export async function listCalendarEventsForRange(
  start: string,
  end: string,
): Promise<CalendarEventItem[]> {
  const rangeStart = fromDateKey(start);
  const rangeEnd = fromDateKey(end);

  const [quotes, manualEvents, staffWithBirthdays] = await Promise.all([
    findCateringQuotesForRange(start, end),
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
  for (const quote of quotes) {
    const details = quote.cateringDetails as Record<string, unknown> | null;
    if (!details?.eventDate) {
      continue;
    }

    const eventDate = details.eventDate as string;
    if (eventDate < start || eventDate >= end) {
      continue;
    }

    const startTime = (details.startTime as string) || "09:00";
    const endTime = (details.endTime as string) || "10:00";

    cateringEvents.push({
      id: quote.id,
      title:
        (details.eventName as string) ||
        quote.recipientName ||
        quote.quoteNumber ||
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
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        quoteStatus: quote.quoteStatus,
        totalAmount: Number(quote.totalAmount ?? 0),
        setupTime: (details.setupTime as string) || null,
        takedownTime: (details.takedownTime as string) || null,
      },
    });
  }

  const birthdayEvents: CalendarEventItem[] = [];
  for (const staff of staffWithBirthdays) {
    if (staff.birthMonth === null || staff.birthDay === null) {
      continue;
    }

    const startYear = Number(start.slice(0, 4));
    const endYear = Number(end.slice(0, 4));

    for (let year = startYear; year <= endYear; year += 1) {
      const birthMonth: string = `${staff.birthMonth}`.padStart(2, "0");
      const birthDay: string = `${staff.birthDay}`.padStart(2, "0");
      const birthdayKey = `${year}-${birthMonth}-${birthDay}`;
      const birthdayDate = fromDateKey(birthdayKey);

      if (
        Number.isNaN(birthdayDate.getTime()) ||
        birthdayDate.getUTCMonth() + 1 !== staff.birthMonth
      ) {
        continue;
      }

      if (birthdayKey >= start && birthdayKey < end) {
        birthdayEvents.push({
          id: `birthday-${staff.id}-${year}`,
          title: `🎂 ${staff.name}'s Birthday`,
          start: birthdayKey,
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

  return [...cateringEvents, ...manualEvents, ...birthdayEvents];
}

export async function getCalendarBootstrapData(
  now = new Date(),
): Promise<CalendarBootstrapData> {
  const mobileRange = {
    start: getDateKeyInLosAngeles(now),
    end: addDaysToDateKey(getDateKeyInLosAngeles(now), 1),
  };
  const desktopStart = getWeekStartDateKey(now);
  const desktopRange = {
    start: desktopStart,
    end: addDaysToDateKey(desktopStart, 7),
  };
  const desktopEvents = await listCalendarEventsForRange(desktopRange.start, desktopRange.end);
  const mobileEvents = filterEventsForRange(desktopEvents, mobileRange.start, mobileRange.end);

  return {
    desktop: {
      ...desktopRange,
      events: desktopEvents,
    },
    mobile: {
      ...mobileRange,
      events: mobileEvents,
    },
  };
}
