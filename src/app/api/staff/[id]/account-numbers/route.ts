// src/app/api/staff/[id]/account-numbers/route.ts
import { NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffAccountNumberSchema } from "@/lib/validators";

async function parseId(
  ctx?: { params: Promise<{ [key: string]: string | undefined }> } | { params?: Promise<Record<string, string | undefined>> }
): Promise<string | null> {
  if (!ctx?.params) {
    return null;
  }
  const params = await ctx.params;
  const rawId = params.id;
  if (typeof rawId !== "string") {
    return null;
  }
  const id = rawId.trim();
  return id.length > 0 ? id : null;
}

function isObjectBody(body: unknown): body is Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

export const GET = withAuth(async (req, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }
  const accounts = await staffService.getAccountNumbers(id);
  return NextResponse.json(accounts);
});

export const POST = withAdmin(async (req, session, ctx) => {
  const id = await parseId(ctx);
  if (!id) {
    return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  if (!isObjectBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = staffAccountNumberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await staffService.upsertAccountNumber({
    staffId: id,
    accountCode: parsed.data.accountCode.trim(),
    description: parsed.data.description?.trim(),
  });
  return NextResponse.json({ success: true }, { status: 201 });
});
