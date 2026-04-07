import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { requisitionCreateSchema } from "@/lib/validators";
import type { AuthSession } from "@/domains/shared/types";
import type { RequisitionFilters } from "@/domains/textbook-requisition/types";

export const GET = withAuth(async (req: NextRequest, session) => {
  const params = req.nextUrl.searchParams;

  if (params.get("statsOnly") === "true") {
    const stats = await requisitionService.getStats();
    return NextResponse.json(stats);
  }

  if (params.get("yearsOnly") === "true") {
    const years = await requisitionService.getDistinctYears();
    return NextResponse.json(years);
  }

  function safeInt(val: string | null): number | undefined {
    if (!val) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? Math.floor(n) : undefined;
  }

  const VALID_STATUSES = new Set(["PENDING", "ORDERED", "ON_SHELF"]);
  const VALID_SORT_ORDERS = new Set(["asc", "desc"]);
  const rawStatus = params.get("status") ?? "";
  const rawSortOrder = params.get("sortOrder") ?? "";

  const filters: RequisitionFilters = {
    search: params.get("search") ?? undefined,
    status: VALID_STATUSES.has(rawStatus) ? (rawStatus as RequisitionFilters["status"]) : undefined,
    term: params.get("term") ?? undefined,
    year: safeInt(params.get("year")),
    createdBy: session.user.role === "admin" ? undefined : session.user.id,
    page: safeInt(params.get("page")),
    pageSize: safeInt(params.get("pageSize")),
    sortBy: params.get("sortBy") ?? undefined,
    sortOrder: VALID_SORT_ORDERS.has(rawSortOrder) ? (rawSortOrder as "asc" | "desc") : undefined,
  };

  try {
    const result = await requisitionService.list(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[textbook-requisitions] list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, session: AuthSession) => {
  try {
    const body = await req.json();
    const parsed = requisitionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    // Force PENDING + STAFF_CREATED — new requisitions always enter the workflow at the start
    const { status: _, source: __, ...safeData } = parsed.data; // eslint-disable-line @typescript-eslint/no-unused-vars
    const input = {
      ...safeData,
      status: "PENDING" as const,
      source: "STAFF_CREATED" as const,
    };
    const result = await requisitionService.create(input, session.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[textbook-requisitions] create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
