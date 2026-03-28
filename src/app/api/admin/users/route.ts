import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";
import { adminUserCreateSchema } from "@/lib/validators";

export const GET = withAdmin(async () => {
  const users = await adminService.listUsers();
  return NextResponse.json(users);
});

export const POST = withAdmin(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const user = await adminService.createUser({ name: parsed.data.name });
  return NextResponse.json(user, { status: 201 });
});
