import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { requisitionService } from "@/domains/textbook-requisition/service";
import { buildCsv } from "@/lib/csv";
import type { RequisitionFilters, RequisitionResponse } from "@/domains/textbook-requisition/types";

const CSV_HEADERS = [
  "Submitted", "Updated", "Instructor", "Phone", "Email",
  "Department", "Course", "Sections", "Enrollment",
  "Term", "Year", "Status", "Source", "Staff Notes",
  "Book #", "Author", "Title", "ISBN", "Edition", "Publisher", "Binding", "Type", "OER Link",
];

function buildRows(requisitions: RequisitionResponse[]): string[][] {
  const rows: string[][] = [];
  for (const r of requisitions) {
    const base = [
      r.submittedAt, r.updatedAt, r.instructorName, r.phone, r.email,
      r.department, r.course, r.sections, String(r.enrollment),
      r.term, String(r.reqYear), r.status, r.source, r.staffNotes ?? "",
    ];
    if (r.books.length === 0) {
      rows.push([...base, "", "", "", "", "", "", "", "", ""]);
    } else {
      for (const b of r.books) {
        rows.push([
          ...base,
          String(b.bookNumber), b.author, b.title, b.isbn,
          b.edition ?? "", b.publisher ?? "", b.binding ?? "", b.bookType, b.oerLink ?? "",
        ]);
      }
    }
  }
  return rows;
}

const PAGE_SIZE = 500;

export const GET = withAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;

  function safeInt(val: string | null): number | undefined {
    if (!val) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? Math.floor(n) : undefined;
  }

  const VALID_STATUSES = new Set(["PENDING", "ORDERED", "ON_SHELF"]);
  const rawStatus = params.get("status") ?? "";

  const baseFilters: RequisitionFilters = {
    search: params.get("search") ?? undefined,
    status: VALID_STATUSES.has(rawStatus) ? (rawStatus as RequisitionFilters["status"]) : undefined,
    term: params.get("term") ?? undefined,
    year: safeInt(params.get("year")),
  };

  try {
    // Paginate through ALL matching results — no arbitrary cap
    const allRequisitions: RequisitionResponse[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await requisitionService.list({
        ...baseFilters,
        page,
        pageSize: PAGE_SIZE,
      });
      allRequisitions.push(...result.requisitions);
      hasMore = allRequisitions.length < result.total;
      page++;
    }

    const csv = buildCsv(CSV_HEADERS, buildRows(allRequisitions));

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="requisitions_${new Date().toISOString().slice(0, 10)}.csv"`,
        "X-Export-Total": String(allRequisitions.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
