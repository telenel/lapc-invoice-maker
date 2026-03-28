import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";

export const DELETE = withAdmin(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  await adminService.deleteAccountCode(id);
  return NextResponse.json({ success: true });
});
