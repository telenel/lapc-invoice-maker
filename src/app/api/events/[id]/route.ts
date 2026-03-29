import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { eventService } from "@/domains/event/service";
import { eventSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  const event = await eventService.getById(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const PUT = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  const body = eventSchema.parse(await req.json());
  const event = await eventService.update(id, body);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const PATCH = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  const body = eventSchema.partial().parse(await req.json());
  const event = await eventService.update(id, body);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const DELETE = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  await eventService.remove(id);
  return NextResponse.json({ success: true });
});
