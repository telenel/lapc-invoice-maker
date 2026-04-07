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
  const body = staffAccountNumberSchema.parse(await req.json());
  await staffService.upsertAccountNumber({
    staffId: id,
    accountCode: body.accountCode.trim(),
    description: body.description?.trim(),
  });
  return NextResponse.json({ success: true }, { status: 201 });
});
