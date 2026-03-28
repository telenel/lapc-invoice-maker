// src/app/api/staff/[id]/route.ts
import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const staff = await staffService.getById(id);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PUT = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = staffSchema.parse(await req.json());
  const staff = await staffService.update(id, body);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const PATCH = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = staffSchema.partial().parse(await req.json());
  const staff = await staffService.partialUpdate(id, body);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
});

export const DELETE = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  await staffService.softDelete(id);
  return NextResponse.json({ success: true });
});
