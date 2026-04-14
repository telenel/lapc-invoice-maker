import { NextRequest, NextResponse } from "next/server";
import { forbiddenResponse, withAuth } from "@/domains/shared/auth";
import { archiveService } from "@/domains/archive/service";

function parseId(rawId: string) {
  const id = rawId.trim();
  if (!id) return null;
  return id;
}

export const POST = withAuth(async (_req: NextRequest, session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid archive id" }, { status: 400 });
  }

  try {
    const restored = await archiveService.restore(id, session.user.id, session.user.role === "admin");
    return NextResponse.json({ success: true, document: restored });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Archived document not found" }, { status: 404 });
    }
    if (code === "FORBIDDEN") {
      return forbiddenResponse();
    }
    console.error("POST /api/archive/[id]/restore failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
