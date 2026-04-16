import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { requisitionUpdateSchema, requisitionStatusUpdateSchema } from "@/lib/validators";

async function parseId(
  ctx?: { params: Promise<{ [key: string]: string | undefined }> } | { params?: Promise<Record<string, string | undefined>> }
): Promise<string | null> {
  if (!ctx || !ctx.params) {
    return null;
  }
  const params = await ctx.params;
  const rawId = params.id;
  if (typeof rawId !== "string") {
    return null;
  }
  const id = rawId.trim();
  if (!id) {
    return null;
  }
  return id;
}

async function getAccessibleRequisition(id: string) {
  // Requisitions are team-visible — any authenticated user can view/edit/manage.
  // Faculty submissions have createdBy=NULL; ownership scoping would hide them.
  const result = await requisitionService.getById(id);
  if (!result) {
    return { result: null, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { result, response: null };
}

export const GET = withAuth(async (_req: NextRequest, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid requisition id" }, { status: 400 });
  }
  try {
    const access = await getAccessibleRequisition(id);
    if (access.response) {
      return access.response;
    }
    return NextResponse.json(access.result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid requisition id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = requisitionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const access = await getAccessibleRequisition(id);
    if (access.response) {
      return access.response;
    }
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
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid requisition id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = requisitionStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const access = await getAccessibleRequisition(id);
    if (access.response) {
      return access.response;
    }
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
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid requisition id" }, { status: 400 });
  }
  try {
    const access = await getAccessibleRequisition(id);
    if (access.response) {
      return access.response;
    }
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
