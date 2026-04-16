import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { requisitionCreateSchema } from "@/lib/validators";
import type { AuthSession } from "@/domains/shared/types";
import type { RequisitionFilters } from "@/domains/textbook-requisition/types";

function parsePositiveInt(param: string | null): number | "error" | undefined {
  if (param == null) return undefined;
  const trimmed = param.trim();
  if (!/^\d+$/.test(trimmed)) return "error";
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return "error";
  return parsed;
}

function parseNonNegativeInt(param: string | null): number | "error" | undefined {
  if (param == null) return undefined;
  const trimmed = param.trim();
  if (!/^\d+$/.test(trimmed)) return "error";
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return "error";
  return parsed;
}

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

  const VALID_STATUSES = new Set(["PENDING", "ORDERED", "ON_SHELF"]);
  const VALID_SORT_ORDERS = new Set(["asc", "desc"]);
  const rawStatus = params.get("status")?.trim() ?? "";
  const rawSortOrder = params.get("sortOrder")?.trim() ?? "";
  const page = parsePositiveInt(params.get("page"));
  if (page === "error") {
    return NextResponse.json({ error: "Invalid page value" }, { status: 400 });
  }
  const pageSize = parsePositiveInt(params.get("pageSize"));
  if (pageSize === "error") {
    return NextResponse.json({ error: "Invalid pageSize value" }, { status: 400 });
  }
  const year = parseNonNegativeInt(params.get("year"));
  if (year === "error") {
    return NextResponse.json({ error: "Invalid year value" }, { status: 400 });
  }

  const filters: RequisitionFilters = {
    search: params.get("search")?.trim() || undefined,
    status: VALID_STATUSES.has(rawStatus) ? (rawStatus as RequisitionFilters["status"]) : undefined,
    term: params.get("term")?.trim() || undefined,
    year,
    // Requisitions are team-visible (like invoices/quotes) — no ownership scoping.
    // Faculty submissions have createdBy=NULL; restricting by user would hide them.
    page,
    pageSize,
    sortBy: params.get("sortBy")?.trim() || undefined,
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
    const body = await req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
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
