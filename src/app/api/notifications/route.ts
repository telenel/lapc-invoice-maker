import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

export const GET = withAuth(async (req: NextRequest, session) => {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const result = await notificationService.list(session.user.id, limit, offset);
  return NextResponse.json(result);
});
