import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quickPickSectionPatchSchema } from "@/domains/quick-pick-sections/schemas";
import {
  QuickPickSectionForbiddenError,
  QuickPickSectionSlugConflictError,
  deleteQuickPickSection,
  updateQuickPickSection,
} from "@/domains/quick-pick-sections/server";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (request: NextRequest, session, ctx?: RouteContext) => {
  const params = await ctx?.params;
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = quickPickSectionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateQuickPickSection(id, parsed.data, {
      role: (session.user as { role?: string }).role ?? "user",
      userId: (session.user as { id?: string }).id ?? null,
    });

    if (!updated) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof QuickPickSectionSlugConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof QuickPickSectionForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
});

export const DELETE = withAuth(async (_request, session, ctx?: RouteContext) => {
  const params = await ctx?.params;
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const result = await deleteQuickPickSection(id, {
      role: (session.user as { role?: string }).role ?? "user",
      userId: (session.user as { id?: string }).id ?? null,
    });
    if (result === "not_found") {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof QuickPickSectionForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
});
