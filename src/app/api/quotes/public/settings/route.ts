import { NextRequest, NextResponse } from "next/server";
import { adminService } from "@/domains/admin/service";

const ALLOWED_KEYS = ["quote_contact_catering", "quote_contact_default"];

export async function GET(req: NextRequest) {
  const requestedKeys = req.nextUrl.searchParams.get("keys");
  const keys = requestedKeys
    ? Array.from(new Set(requestedKeys.split(",").map((key) => key.trim()).filter(Boolean)))
    : ALLOWED_KEYS;
  const filtered = keys.filter((k) => ALLOWED_KEYS.includes(k));

  if (filtered.length === 0) {
    return NextResponse.json({});
  }

  const settings = await adminService.listSettingsByKeys(filtered);

  const result: Record<string, unknown> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }

  return NextResponse.json(result);
}
