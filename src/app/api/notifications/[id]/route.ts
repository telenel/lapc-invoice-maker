import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  await notificationService.markRead(id);
  return NextResponse.json({ success: true });
});
