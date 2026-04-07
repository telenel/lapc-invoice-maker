import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { requisitionUpdateSchema, requisitionStatusUpdateSchema } from "@/lib/validators";

export const GET = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const result = await requisitionService.getById(id);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json();
  const parsed = requisitionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    // Strip status from general updates — force transitions through PATCH/notify
    const { status: _, ...updateData } = parsed.data; // eslint-disable-line @typescript-eslint/no-unused-vars
    const result = await requisitionService.update(id, updateData, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2025" || code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json();
  const parsed = requisitionStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const result = await requisitionService.updateStatus(id, parsed.data.status, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2025" || code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    await requisitionService.archive(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2025" || code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
