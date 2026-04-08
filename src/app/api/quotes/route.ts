import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";
import { quoteCreateSchema } from "@/lib/validators";
import { Prisma } from "@/generated/prisma/client";
import type { QuoteFilters } from "@/domains/quote/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "DRAFT",
  "SENT",
  "SUBMITTED_EMAIL",
  "SUBMITTED_MANUAL",
  "ACCEPTED",
  "DECLINED",
  "REVISED",
  "EXPIRED",
  "all",
]);

function parseStatus(value: string | null): QuoteFilters["quoteStatus"] | "error" {
  if (value == null) return undefined;
  if (!VALID_STATUSES.has(value)) return "error";
  return value as QuoteFilters["quoteStatus"];
}

function parsePositiveInt(value: string | null, fallback: number): number | "error" {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return "error";
  return parsed;
}

function parseDate(value: string | null): string | undefined | "error" {
  if (value == null) return undefined;
  if (Number.isNaN(new Date(value).getTime())) return "error";
  return value;
}

function jsonNoStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(data, { ...init, headers });
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;

    // Validate amountMin
    let amountMin: number | undefined = undefined;
    const amountMinStr = sp.get("amountMin");
    if (amountMinStr) {
      const parsed = Number(amountMinStr);
      if (!Number.isFinite(parsed)) {
        return NextResponse.json({ error: "Invalid amountMin value" }, { status: 400 });
      }
      amountMin = parsed;
    }

    // Validate amountMax
    let amountMax: number | undefined = undefined;
    const amountMaxStr = sp.get("amountMax");
    if (amountMaxStr) {
      const parsed = Number(amountMaxStr);
      if (!Number.isFinite(parsed)) {
        return NextResponse.json({ error: "Invalid amountMax value" }, { status: 400 });
      }
      amountMax = parsed;
    }

    // Validate amountMin <= amountMax
    if (amountMin !== undefined && amountMax !== undefined && amountMin > amountMax) {
      return NextResponse.json({ error: "amountMin must be less than or equal to amountMax" }, { status: 400 });
    }

    const dateFrom = parseDate(sp.get("dateFrom"));
    if (dateFrom === "error") {
      return NextResponse.json({ error: "Invalid dateFrom value" }, { status: 400 });
    }

    const dateTo = parseDate(sp.get("dateTo"));
    if (dateTo === "error") {
      return NextResponse.json({ error: "Invalid dateTo value" }, { status: 400 });
    }

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return NextResponse.json(
        { error: "dateFrom must be less than or equal to dateTo" },
        { status: 400 },
      );
    }

    const page = parsePositiveInt(sp.get("page"), 1);
    if (page === "error") {
      return NextResponse.json({ error: "Invalid page value" }, { status: 400 });
    }

    const pageSize = parsePositiveInt(sp.get("pageSize"), 20);
    if (pageSize === "error") {
      return NextResponse.json({ error: "Invalid pageSize value" }, { status: 400 });
    }

    const quoteStatus = parseStatus(sp.get("quoteStatus"));
    if (quoteStatus === "error") {
      return NextResponse.json({ error: "Invalid quoteStatus value" }, { status: 400 });
    }

    // Validate sortOrder
    const rawSortOrder = sp.get("sortOrder") ?? sp.get("sortDir");
    const sortOrder: "asc" | "desc" =
      rawSortOrder === "asc" || rawSortOrder === "desc" ? rawSortOrder : "desc";

    const filters: QuoteFilters & { sortBy?: string; sortOrder?: "asc" | "desc" } = {
      search: sp.get("search") ?? undefined,
      quoteStatus,
      department: sp.get("department") ?? undefined,
      category: sp.get("category") ?? undefined,
      creatorId: sp.get("creatorId") ?? undefined,
      needsAccountNumber: sp.get("needsAccountNumber") === "true" ? true : undefined,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      page,
      pageSize,
      sortBy: sp.get("sortBy") ?? "createdAt",
      sortOrder,
    };

    return jsonNoStore(await quoteService.list(filters));
  } catch (err) {
    console.error("GET /api/quotes failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = quoteCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const quote = await quoteService.create(parsed.data, session.user.id);
    return jsonNoStore(quote, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A quote with this number already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/quotes failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
