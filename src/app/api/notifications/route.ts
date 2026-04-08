import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

function parseNonNegativeInt(value: string | null, fallback: number): number | "error" {
  if (value == null) return fallback;
  if (value === "") return "error";
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return "error";
  return parsed;
}

export const GET = withAuth(async (req: NextRequest, session) => {
  const url = new URL(req.url);
  const limit = parseNonNegativeInt(url.searchParams.get("limit"), 20);
  if (limit === "error") {
    return NextResponse.json({ error: "Invalid limit value" }, { status: 400 });
  }

  const offset = parseNonNegativeInt(url.searchParams.get("offset"), 0);
  if (offset === "error") {
    return NextResponse.json({ error: "Invalid offset value" }, { status: 400 });
  }

  const result = await notificationService.list(session.user.id, limit, offset);
  return NextResponse.json(result);
});