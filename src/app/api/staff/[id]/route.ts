// src/app/api/staff/[id]/route.ts
import { NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

async function parseId(
  ctx?: { params: Promise<{ [key: string]: string | undefined }> } | { params?: Promise<Record<string, string | undefined>> }
): Promise<string | null> {
  if (!ctx?.params) {
    return null;
  }
  const params = await ctx.params;
  const rawId = params.id;
  if (typeof rawId !== "string") {
    return null;
  }
  const id = rawId.trim();
  return id.length > 0 ? id : null;
}

function isObjectBody(body: unknown): body is Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

export const GET = withAuth(async (req, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }
  const staff = await staffService.getById(id);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PUT = withAuth(async (req, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const staff = await staffService.update(id, parsed.data);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PATCH = withAuth(async (req, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = staffSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patchData = Object.fromEntries(
    Object.entries(parsed.data).filter(([key]) => Object.prototype.hasOwnProperty.call(body, key)),
  );
  const staff = await staffService.partialUpdate(id, patchData);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const DELETE = withAdmin(async (req, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }
  await staffService.softDelete(id);
  return NextResponse.json({ success: true });
});
