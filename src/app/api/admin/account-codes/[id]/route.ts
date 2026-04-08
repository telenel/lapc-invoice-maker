import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";

export const DELETE = withAdmin(async (_req: NextRequest, _session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = rawId.trim();
  if (!id) {
    return NextResponse.json({ error: "Invalid account code id" }, { status: 400 });
  }

  await adminService.deleteAccountCode(id);
  return NextResponse.json({ success: true });
});
