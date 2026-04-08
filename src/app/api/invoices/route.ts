import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";
import { invoiceCreateSchema } from "@/lib/validators";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["DRAFT", "FINAL", "PENDING_CHARGE"]);

function parseStatus(
  value: string | null,
): "DRAFT" | "FINAL" | "PENDING_CHARGE" | undefined | "error" {
  if (value == null) return undefined;
  if (!VALID_STATUSES.has(value)) return "error";
  return value as "DRAFT" | "FINAL" | "PENDING_CHARGE";
}

function parsePositiveInt(value: string | null, fallback: number): number | "error" {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return "error";
  return parsed;
}

function parseAmount(value: string | null): number | undefined | "error" {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "error";
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

    const statsOnly = sp.get("statsOnly") === "true";
    const groupBy = sp.get("groupBy");

    if (statsOnly && groupBy === "creator") {
      const status = parseStatus(sp.get("status"));
      if (status === "error") {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      return jsonNoStore(await invoiceService.getCreatorStats(status));
    }

    const rawSortOrder = sp.get("sortOrder") ?? sp.get("sortDir");
    const sortOrder: "asc" | "desc" =
      rawSortOrder === "asc" || rawSortOrder === "desc" ? rawSortOrder : "desc";

    const status = parseStatus(sp.get("status"));
    if (status === "error") {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const page = parsePositiveInt(sp.get("page"), 1);
    if (page === "error") {
      return NextResponse.json({ error: "Invalid page value" }, { status: 400 });
    }

    const pageSize = parsePositiveInt(sp.get("pageSize"), 20);
    if (pageSize === "error") {
      return NextResponse.json({ error: "Invalid pageSize value" }, { status: 400 });
    }

    const amountMin = parseAmount(sp.get("amountMin"));
    if (amountMin === "error") {
      return NextResponse.json({ error: "Invalid amountMin value" }, { status: 400 });
    }

    const amountMax = parseAmount(sp.get("amountMax"));
    if (amountMax === "error") {
      return NextResponse.json({ error: "Invalid amountMax value" }, { status: 400 });
    }

    if (amountMin !== undefined && amountMax !== undefined && amountMin > amountMax) {
      return NextResponse.json(
        { error: "amountMin must be less than or equal to amountMax" },
        { status: 400 },
      );
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

    const createdFrom = parseDate(sp.get("createdFrom"));
    if (createdFrom === "error") {
      return NextResponse.json({ error: "Invalid createdFrom value" }, { status: 400 });
    }

    const createdTo = parseDate(sp.get("createdTo"));
    if (createdTo === "error") {
      return NextResponse.json({ error: "Invalid createdTo value" }, { status: 400 });
    }

    if (createdFrom && createdTo && new Date(createdFrom) > new Date(createdTo)) {
      return NextResponse.json(
        { error: "createdFrom must be less than or equal to createdTo" },
        { status: 400 },
      );
    }

    const filters = {
      search: sp.get("search") ?? undefined,
      status,
      isRunning: sp.get("isRunning") === "true" ? true : undefined,
      needsAccountNumber: sp.get("needsAccountNumber") === "true" ? true : undefined,
      staffId: sp.get("staffId") ?? undefined,
      department: sp.get("department") ?? undefined,
      dateFrom,
      dateTo,
      createdFrom,
      createdTo,
      category: sp.get("category") ?? undefined,
      amountMin,
      amountMax,
      creatorId: sp.get("creatorId") ?? undefined,
      page,
      pageSize,
      sortBy: sp.get("sortBy") ?? "createdAt",
      sortOrder,
    };

    if (statsOnly) {
      return jsonNoStore(await invoiceService.getStats(filters));
    }

    return jsonNoStore(await invoiceService.list(filters));
  } catch (err) {
    console.error("GET /api/invoices failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = invoiceCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invoice = await invoiceService.create(parsed.data, session.user.id);
    return jsonNoStore(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An invoice with this number already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/invoices failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
