import { NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";

export const GET = withAdmin(async () => {
  const health = await adminService.getDbHealth();
  return NextResponse.json(health);
});
