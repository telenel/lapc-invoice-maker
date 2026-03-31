import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { adminService } from "@/domains/admin/service";
import { withAdmin } from "@/domains/shared/auth";

export const GET = withAdmin(async () => {
  const settings = await adminService.listSettings();
  return NextResponse.json(settings);
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key || body?.value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const setting = await adminService.saveSetting(
    key,
    body.value as Prisma.InputJsonValue,
  );

  return NextResponse.json(setting);
});
