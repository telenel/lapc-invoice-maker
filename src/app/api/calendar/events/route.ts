import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { listCalendarEventsForRange } from "@/domains/calendar/service";

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

  return NextResponse.json(await listCalendarEventsForRange(start, end));
});
