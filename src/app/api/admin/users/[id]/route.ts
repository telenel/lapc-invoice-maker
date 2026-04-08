import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { adminService } from "@/domains/admin/service";
import { adminUserUpdateSchema } from "@/lib/validators";

function parseId(rawId: string | undefined) {
  if (rawId == null) return null;
  const id = rawId.trim();
  if (!id) return null;
  return id;
}

function isObjectBody(body: unknown) {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

export const PUT = withAdmin(async (req: NextRequest, _session, ctx) => {
  const { id: rawId } = await ctx!.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (Object.hasOwn(body, "resetPassword")) {
    if (body.resetPassword !== true) {
      return NextResponse.json(
        { error: "resetPassword must be true to trigger a reset" },
        { status: 400 },
      );
    }
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
  const { id: rawId } = await ctx!.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  await adminService.deleteUser(id);
  return NextResponse.json({ success: true });
});