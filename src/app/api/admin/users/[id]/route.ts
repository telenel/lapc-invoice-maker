import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";
import { adminUserUpdateSchema } from "@/lib/validators";

export const PUT = withAdmin(async (req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json();

  if (body.resetPassword) {
    const user = await adminService.resetPassword(id);
    return NextResponse.json(user);
  }

  const parsed = adminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await adminService.updateUser(id, parsed.data);
  return NextResponse.json(user);
});

export const DELETE = withAdmin(async (_req: NextRequest, _session, ctx) => {
  const { id } = await ctx!.params;
  await adminService.deleteUser(id);
  return NextResponse.json({ success: true });
});
