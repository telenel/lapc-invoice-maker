// src/app/api/staff/[id]/account-numbers/route.ts
import { NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffAccountNumberSchema } from "@/lib/validators";

export const GET = withAuth(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const accounts = await staffService.getAccountNumbers(id);
  return NextResponse.json(accounts);
});

export const POST = withAdmin(async (req, session, ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json().catch(() => null);
  if (body === null) {
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
