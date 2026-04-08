import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { quoteService } from "@/domains/quote/service";
import { quoteCreateSchema } from "@/lib/validators";
import { Prisma } from "@/generated/prisma/client";
import type { QuoteFilters } from "@/domains/quote/types";

export const dynamic = "force-dynamic";

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

    // Validate sortOrder
    const rawSortOrder = sp.get("sortOrder") ?? sp.get("sortDir");
    const sortOrder: "asc" | "desc" =
      rawSortOrder === "asc" || rawSortOrder === "desc" ? rawSortOrder : "desc";

    const filters: QuoteFilters & { sortBy?: string; sortOrder?: "asc" | "desc" } = {
      search: sp.get("search") ?? undefined,
      quoteStatus: (sp.get("quoteStatus") ?? undefined) as
        | "DRAFT"
        | "SENT"
        | "SUBMITTED_EMAIL"
        | "SUBMITTED_MANUAL"
        | "ACCEPTED"
        | "DECLINED"
        | "REVISED"
        | "EXPIRED"
        | "all"
        | undefined,
      department: sp.get("department") ?? undefined,
      category: sp.get("category") ?? undefined,
      creatorId: sp.get("creatorId") ?? undefined,
      needsAccountNumber: sp.get("needsAccountNumber") === "true" ? true : undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      amountMin,
      amountMax,
      page: Math.max(1, parseInt(sp.get("page") ?? "1", 10)),
      pageSize: Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10)),
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
  const body = await req.json();
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
