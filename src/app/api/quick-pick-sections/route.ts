import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quickPickSectionCreateSchema } from "@/domains/quick-pick-sections/schemas";
import {
  QuickPickSectionSlugConflictError,
  createQuickPickSection,
  listQuickPickSections,
} from "@/domains/quick-pick-sections/server";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, session) => {
  const role = (session.user as { role?: string }).role ?? "user";
  const userId = (session.user as { id?: string }).id ?? null;

  const items = await listQuickPickSections({ role, userId });
  return NextResponse.json({ items });
});

export const POST = withAuth(async (request: NextRequest, session) => {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = quickPickSectionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const role = (session.user as { role?: string }).role ?? "user";
    const userId = (session.user as { id?: string }).id ?? null;
    const created = await createQuickPickSection({
      ...parsed.data,
      slug: parsed.data.slug ?? "",
      description: parsed.data.description ?? "",
      icon: parsed.data.icon ?? "",
      descriptionLike: parsed.data.descriptionLike ?? "",
      itemType: parsed.data.itemType ?? "",
      isGlobal: role === "admin" ? parsed.data.isGlobal : false,
      createdByUserId: userId,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof QuickPickSectionSlugConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
});
