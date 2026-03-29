import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { invoiceService } from "@/domains/invoice/service";
import { escapeCsv } from "@/lib/csv";

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const sp = req.nextUrl.searchParams;

    const filters = {
      search: sp.get("search") ?? undefined,
      status: (sp.get("status") ?? undefined) as "DRAFT" | "FINAL" | "PENDING_CHARGE" | undefined,
      category: sp.get("category") ?? undefined,
      department: sp.get("department") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      amountMin: sp.get("amountMin") ? Number(sp.get("amountMin")) : undefined,
      amountMax: sp.get("amountMax") ? Number(sp.get("amountMax")) : undefined,
      // Fetch all records for export (no pagination)
      page: 1,
      pageSize: 100_000,
      sortBy: "createdAt",
      sortOrder: "desc" as const,
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
        new Date(inv.date).toISOString().split("T")[0],
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
