// src/app/api/staff/route.ts
import { NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { staffService } from "@/domains/staff/service";
import { staffSchema } from "@/lib/validators";

function parsePositiveInt(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

export const GET = withAuth(async (req) => {
  const params = req.nextUrl.searchParams;
  const search = params.get("search") ?? undefined;
  const paginated = params.get("paginated") === "true";

  if (paginated) {
    const page = parsePositiveInt(params.get("page"), 1);
    if (page === null) {
      return NextResponse.json({ error: "Invalid page value" }, { status: 400 });
    }

    const pageSizeParsed = parsePositiveInt(params.get("pageSize"), 20);
    if (pageSizeParsed === null) {
      return NextResponse.json({ error: "Invalid pageSize value" }, { status: 400 });
    }

    const pageSize = Math.min(100, pageSizeParsed);
    const result = await staffService.listPaginated({ search, page, pageSize });
    return NextResponse.json(result);
  }

  const staff = await staffService.list({ search });
  return NextResponse.json(staff);
});

export const POST = withAuth(async (req) => {
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
