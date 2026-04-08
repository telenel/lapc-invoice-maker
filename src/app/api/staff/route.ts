// src/app/api/staff/route.ts
import { NextResponse } from "next/server";
import { withAdmin, withAuth } from "@/domains/shared/auth";
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

export const POST = withAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const staff = await staffService.create(parsed.data);
  return NextResponse.json(staff, { status: 201 });
});
