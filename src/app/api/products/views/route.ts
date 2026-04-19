import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PresetGroup, SavedView } from "@/domains/product/types";
import { PRODUCTS_PAGE_GROUPS } from "@/domains/product/view-groups";

export const dynamic = "force-dynamic";

const postBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  filter: z.record(z.string(), z.unknown()),
  columnPreferences: z
    .object({ visible: z.array(z.string()).max(24) })
    .optional()
    .nullable(),
});

function rowToView(row: Record<string, unknown>): SavedView {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    filter: (row.filter as SavedView["filter"]) ?? {},
    columnPreferences:
      (row.column_preferences as SavedView["columnPreferences"]) ?? null,
    isSystem: (row.is_system as boolean) ?? false,
    slug: (row.slug as string) ?? null,
    presetGroup: (row.preset_group as PresetGroup) ?? null,
    sortOrder: (row.sort_order as number) ?? null,
  };
}

export const GET = withAuth(async (_req, session) => {
  const supabase = getSupabaseAdminClient();
  const userId = (session.user as { id?: string }).id;

  const [systemRes, mineRes] = await Promise.all([
    supabase
      .from("saved_searches")
      .select(
        "id, name, description, filter, column_preferences, is_system, slug, preset_group, sort_order",
      )
      .eq("is_system", true)
      .in("preset_group", PRODUCTS_PAGE_GROUPS)
      .order("preset_group", { ascending: true })
      .order("sort_order", { ascending: true }),
    userId
      ? supabase
          .from("saved_searches")
          .select(
            "id, name, description, filter, column_preferences, is_system, slug, preset_group, sort_order",
          )
          .eq("is_system", false)
          .eq("owner_user_id", userId)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (systemRes.error) {
    return NextResponse.json({ error: systemRes.error.message }, { status: 500 });
  }
  if (mineRes.error) {
    return NextResponse.json({ error: mineRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    system: (systemRes.data ?? []).map(rowToView),
    mine: (mineRes.data ?? []).map(rowToView),
  });
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json(
      { error: "Session missing user id" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      owner_user_id: userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      filter: parsed.data.filter,
      column_preferences: parsed.data.columnPreferences ?? null,
      is_system: false,
    })
    .select(
      "id, name, description, filter, column_preferences, is_system, slug, preset_group, sort_order",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `A view named "${parsed.data.name}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rowToView(data), { status: 201 });
});
