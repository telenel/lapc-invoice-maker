import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { quickPickSectionPatchSchema } from "@/domains/quick-pick-sections/schemas";
import {
  QuickPickSectionSlugConflictError,
  deleteQuickPickSection,
  updateQuickPickSection,
} from "@/domains/quick-pick-sections/server";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const PATCH = withAdmin(async (request: NextRequest, _session, ctx?: RouteContext) => {
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
    const updated = await updateQuickPickSection(id, {
      ...parsed.data,
      slug: parsed.data.slug ?? undefined,
      description: parsed.data.description ?? undefined,
      icon: parsed.data.icon ?? undefined,
      descriptionLike: parsed.data.descriptionLike ?? undefined,
      itemType: parsed.data.itemType ?? undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof QuickPickSectionSlugConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
});

export const DELETE = withAdmin(async (_request, _session, ctx?: RouteContext) => {
  const params = await ctx?.params;
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const result = await deleteQuickPickSection(id);
  if (result === "not_found") {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
});
