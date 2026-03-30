import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { templateService } from "@/domains/template/service";

export const DELETE = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id } = await ctx!.params;
  try {
    const existing = await templateService.getById(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await templateService.delete(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/templates/[id] failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
