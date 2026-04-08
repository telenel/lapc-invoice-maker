import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { eventService } from "@/domains/event/service";
import { eventSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(rawId: string) {
  const id = rawId.trim();
  if (!id) return null;
  return id;
}

function isObjectBody(body: unknown) {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id: rawId } = await (ctx as RouteContext).params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const event = await eventService.getById(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const PUT = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id: rawId } = await (ctx as RouteContext).params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const event = await eventService.update(id, parsed.data);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const PATCH = withAuth(async (req: NextRequest, _session, ctx) => {
  const { id: rawId } = await (ctx as RouteContext).params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = eventSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const event = await eventService.update(id, parsed.data);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
});

export const DELETE = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id: rawId } = await (ctx as RouteContext).params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const existing = await eventService.getById(id);
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  await eventService.remove(id);
  return NextResponse.json({ success: true });
});
