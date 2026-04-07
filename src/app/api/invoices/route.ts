import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";
import { invoiceCreateSchema } from "@/lib/validators";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

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
      const status = sp.get("status") as "DRAFT" | "FINAL" | "PENDING_CHARGE" | undefined ?? undefined;
      return jsonNoStore(await invoiceService.getCreatorStats(status));
    }

    const rawSortOrder = sp.get("sortOrder") ?? sp.get("sortDir");
    const sortOrder: "asc" | "desc" =
      rawSortOrder === "asc" || rawSortOrder === "desc" ? rawSortOrder : "desc";

    const filters = {
      search: sp.get("search") ?? undefined,
      status: (sp.get("status") ?? undefined) as "DRAFT" | "FINAL" | "PENDING_CHARGE" | undefined,
      isRunning: sp.get("isRunning") === "true" ? true : undefined,
      staffId: sp.get("staffId") ?? undefined,
      department: sp.get("department") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      createdFrom: sp.get("createdFrom") ?? undefined,
      createdTo: sp.get("createdTo") ?? undefined,
      category: sp.get("category") ?? undefined,
      amountMin: sp.get("amountMin") ? Number(sp.get("amountMin")) : undefined,
      amountMax: sp.get("amountMax") ? Number(sp.get("amountMax")) : undefined,
      creatorId: sp.get("creatorId") ?? undefined,
      page: Math.max(1, parseInt(sp.get("page") ?? "1", 10)),
      pageSize: Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10)),
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
  const body = await req.json();
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
