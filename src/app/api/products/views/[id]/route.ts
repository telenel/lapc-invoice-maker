import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const DELETE = withAuth(async (_req, session, ctx) => {
  const params = await ctx?.params;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Session missing user id" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", userId)
    .eq("is_system", false)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "View not found or not deletable" }, { status: 404 });

  return NextResponse.json({ ok: true });
});
