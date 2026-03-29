import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { eventService } from "@/domains/event/service";
import { eventSchema } from "@/lib/validators";

export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params required" }, { status: 400 });
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format for start or end" }, { status: 400 });
  }
  if (startDate >= endDate) {
    return NextResponse.json({ error: "start must be before end" }, { status: 400 });
  }
  const events = await eventService.listForDateRange(startDate, endDate);
  return NextResponse.json(events);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = eventSchema.parse(await req.json());
  const event = await eventService.create(body, session.user.id);
  return NextResponse.json(event, { status: 201 });
});
