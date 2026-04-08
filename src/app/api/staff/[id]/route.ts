// src/app/api/staff/[id]/route.ts
import { NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const staff = await staffService.getById(id);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PUT = withAdmin(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json().catch(() => null);
  if (body === null) {
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

export const PATCH = withAdmin(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = staffSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const staff = await staffService.partialUpdate(id, parsed.data);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const DELETE = withAdmin(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  await staffService.softDelete(id);
  return NextResponse.json({ success: true });
});
