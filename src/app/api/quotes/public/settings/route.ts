import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = ["quote_contact_catering", "quote_contact_default"];

export async function GET(req: NextRequest) {
  const keys = req.nextUrl.searchParams.get("keys")?.split(",").filter(Boolean) ?? ALLOWED_KEYS;
  const filtered = keys.filter((k) => ALLOWED_KEYS.includes(k));

  if (filtered.length === 0) {
    return NextResponse.json({});
  }

  const settings = await prisma.appSetting.findMany({
    where: { key: { in: filtered } },
  });

  const result: Record<string, unknown> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }

  return NextResponse.json(result);
}
