import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { notificationService } from "@/domains/notification/service";

type RouteContext = { params: Promise<{ id: string }> };

const ParamsSchema = z.object({ id: z.string().trim().min(1) });

function parseId(rawId: string) {
  const id = rawId.trim();
  if (!id) return null;
  return id;
}

function invalidIdResponse() {
  return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
}

export const PATCH = withAuth(async (_req: NextRequest, session, ctx) => {
  const rawParams = await (ctx as RouteContext).params;
  const parsedParams = ParamsSchema.safeParse(rawParams);
  if (!parsedParams.success) {
    return invalidIdResponse();
  }
  const id = parseId(parsedParams.data.id);
  if (!id) {
    return invalidIdResponse();
  }

  const result = await notificationService.markRead(
    id,
    session.user.id,
    session.user.role === "admin"
  );
  if (result === "forbidden") return forbiddenResponse();
  return NextResponse.json({ success: true });
});

export const DELETE = withAuth(async (_req: NextRequest, session, ctx) => {
  const raw = await (ctx as RouteContext).params;
  const parsed = ParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidIdResponse();
  }
  const id = parseId(parsed.data.id);
  if (!id) {
    return invalidIdResponse();
  }

  const result = await notificationService.delete(id, session.user.id, session.user.role === "admin");
  if (result === "forbidden") return forbiddenResponse();
  return NextResponse.json({ success: true });
});
