import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { userPreferenceService } from "@/domains/user-preference/service";

const ParamsSchema = z.object({
  key: z.string().min(1).max(120).regex(/^[a-z0-9._:-]+$/i),
});
const PreferenceBodySchema = z.object({
  value: z.unknown(),
});

function invalidRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export const GET = withAuth(async (_req: NextRequest, session, ctx) => {
  const raw = await ctx?.params;
  const parsed = ParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidRequest("Invalid preference key");
  }

  const preference = await userPreferenceService.get(session.user.id, parsed.data.key);
  return NextResponse.json(preference);
});

export const PUT = withAuth(async (req: NextRequest, session, ctx) => {
  const raw = await ctx?.params;
  const parsedParams = ParamsSchema.safeParse(raw);
  if (!parsedParams.success) {
    return invalidRequest("Invalid preference key");
  }

  const body = await req.json().catch(() => null);
  const parsedBody = PreferenceBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return invalidRequest("Invalid preference payload");
  }

  const preference = await userPreferenceService.save(
    session.user.id,
    parsedParams.data.key,
    parsedBody.data.value,
  );

  return NextResponse.json(preference);
});

export const DELETE = withAuth(async (_req: NextRequest, session, ctx) => {
  const raw = await ctx?.params;
  const parsed = ParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidRequest("Invalid preference key");
  }

  await userPreferenceService.delete(session.user.id, parsed.data.key);
  return NextResponse.json({ ok: true });
});
