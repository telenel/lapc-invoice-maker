// src/app/api/staff/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

export const GET = withAuth(async (req) => {
  const params = req.nextUrl.searchParams;
  const search = params.get("search") ?? undefined;
  const paginated = params.get("paginated") === "true";

  if (paginated) {
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 20));
    const result = await staffService.listPaginated({ search, page, pageSize });
    return NextResponse.json(result);
  }

  const staff = await staffService.list({ search });
  return NextResponse.json(staff);
});

export const POST = withAuth(async (req) => {
  const body = staffSchema.parse(await req.json());
  const staff = await staffService.create(body);
  return NextResponse.json(staff, { status: 201 });
});
