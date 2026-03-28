import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

export const PATCH = withAuth(async (_req: NextRequest, session) => {
  await notificationService.markAllRead(session.user.id);
  return NextResponse.json({ success: true });
});
