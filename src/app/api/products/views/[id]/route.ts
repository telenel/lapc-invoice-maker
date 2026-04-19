import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { deleteProductView } from "@/domains/product/server-views";

export const dynamic = "force-dynamic";

export const DELETE = withAuth(async (_req, session, ctx) => {
  const params = await ctx?.params;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Session missing user id" }, { status: 401 });

  const result = await deleteProductView({ id, userId });
  if (result === "not_found" || result === "forbidden") {
    return NextResponse.json(
      { error: "View not found or not deletable" },
      { status: 404 },
    );
  }
  if (result === "system") {
    return NextResponse.json(
      { error: "System presets are read-only" },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
});
