import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";
import { escapeCsv } from "@/lib/csv";
import { getDateOnlyKey } from "@/lib/date-utils";

const VALID_STATUSES = new Set(["DRAFT", "FINAL", "PENDING_CHARGE"]);

function parseStatus(
  value: string | null,
): "DRAFT" | "FINAL" | undefined | "error" {
  if (value == null) return undefined;
  if (!VALID_STATUSES.has(value)) return "error";
  return (value === "PENDING_CHARGE" ? "DRAFT" : value) as "DRAFT" | "FINAL";
}

function parseAmount(value: string | null): number | undefined | "error" {
  if (value == null) return undefined;
  if (value.trim() === "") return "error";
  if (!/^\d+(\.\d+)?$/.test(value)) return "error";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "error";
  return parsed;
}

function parseDate(value: string | null): string | undefined | "error" {
  if (value == null) return undefined;
  if (Number.isNaN(new Date(value).getTime())) return "error";
  return value;
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;

    const status = parseStatus(sp.get("status"));
    if (status === "error") {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
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
      staffId: sp.get("staffId") ?? undefined,
      category: sp.get("category") ?? undefined,
      department: sp.get("department") ?? undefined,
      dateFrom,
      dateTo,
      createdFrom,
      createdTo,
      amountMin,
      amountMax,
      creatorId: sp.get("creatorId") ?? undefined,
      isRunning: sp.get("isRunning") === "true" ? true : undefined,
      // Fetch all records for export (no pagination)
      page: 1,
      pageSize: 100_000,
      sortBy: sp.get("sortBy") ?? "createdAt",
      sortOrder: (sp.get("sortOrder") ?? sp.get("sortDir") ?? "desc") as "asc" | "desc",
    };

    const { invoices } = await invoiceService.list(filters);

    const headers = [
      "Invoice Number",
      "Date",
      "Category",
      "Staff",
      "Department",
      "Account Number",
      "Account Code",
      "Total",
      "Status",
      "Items",
      "Notes",
    ];

    const rows = invoices.map((inv) => {
      const itemDescriptions = inv.items.map((item) => item.description).join("; ");
      return [
        inv.invoiceNumber ?? "",
        getDateOnlyKey(inv.date) ?? "",
        inv.category,
        inv.staff?.name ?? inv.contact?.name ?? "",
        inv.department,
        inv.accountNumber,
        inv.accountCode,
        Number(inv.totalAmount).toFixed(2),
        inv.status,
        itemDescriptions,
        inv.notes ?? "",
      ].map(escapeCsv);
    });

    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="invoices-export.csv"',
      },
    });
  } catch (err) {
    console.error("GET /api/invoices/export failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
