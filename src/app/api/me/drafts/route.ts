import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { userDraftService } from "@/domains/user-draft/service";

const DraftRouteKeySchema = z.string().min(1).max(255).startsWith("/");
const DraftQuerySchema = z.object({
  routeKey: DraftRouteKeySchema,
});
const DraftBodySchema = z.object({
  routeKey: DraftRouteKeySchema,
  data: z.unknown(),
});

function invalidRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export const GET = withAuth(async (req: NextRequest, session) => {
  const parsed = DraftQuerySchema.safeParse({
    routeKey: req.nextUrl.searchParams.get("routeKey"),
  });

  if (!parsed.success) {
    return invalidRequest("Invalid routeKey");
  }

  const draft = await userDraftService.get(session.user.id, parsed.data.routeKey);
  return NextResponse.json(draft);
});

export const PUT = withAuth(async (req: NextRequest, session) => {
  const body = await req.json().catch(() => null);
  const parsed = DraftBodySchema.safeParse(body);

  if (!parsed.success) {
    return invalidRequest("Invalid draft payload");
  }

  const draft = await userDraftService.save(
    session.user.id,
    parsed.data.routeKey,
    parsed.data.data,
  );

  return NextResponse.json(draft);
});

export const DELETE = withAuth(async (req: NextRequest, session) => {
  const parsed = DraftQuerySchema.safeParse({
    routeKey: req.nextUrl.searchParams.get("routeKey"),
  });

  if (!parsed.success) {
    return invalidRequest("Invalid routeKey");
  }

  await userDraftService.delete(session.user.id, parsed.data.routeKey);
  return NextResponse.json({ ok: true });
});
