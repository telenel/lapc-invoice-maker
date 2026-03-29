import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

type RouteContext = { params: Promise<{ id: string }> };

const ParamsSchema = z.object({ id: z.string().min(1) });

export const PATCH = withAuth(async (_req: NextRequest, _session, ctx) => {
  const { id } = await (ctx as RouteContext).params;
  await notificationService.markRead(id);
  return NextResponse.json({ success: true });
});

export const DELETE = withAuth(async (_req: NextRequest, session, ctx) => {
  const raw = await (ctx as RouteContext).params;
  const parsed = ParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
  }
  const { id } = parsed.data;
  const result = await notificationService.delete(id, session.user.id, session.user.role === "admin");
  if (result === "forbidden") return forbiddenResponse();
  return NextResponse.json({ success: true });
});
