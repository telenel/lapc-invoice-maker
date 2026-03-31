import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const GET = withAdmin(async () => {
  const settings = await prisma.appSetting.findMany({
    orderBy: { key: "asc" },
  });
  return NextResponse.json(settings);
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body?.key || body.value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const setting = await prisma.appSetting.upsert({
    where: { key: String(body.key) },
    update: { value: body.value },
    create: { key: String(body.key), value: body.value },
  });

  return NextResponse.json(setting);
});
