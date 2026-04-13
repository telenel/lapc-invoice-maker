import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { staffService } from "@/domains/staff/service";
import { invoiceService } from "@/domains/invoice/service";
import type { InvoiceFilters } from "@/domains/invoice/types";
import { followUpService } from "@/domains/follow-up/service";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { UserActivityStrip } from "@/components/invoices/user-activity-strip";
import { redirect } from "next/navigation";

type InvoicesPageSearchParams = Record<string, string | string[] | undefined>;

function getSearchParam(
  searchParams: InvoicesPageSearchParams,
  key: string,
): string | null {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAmount(value: string | null): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(value: string | null): string | undefined {
  if (!value) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

function buildInitialInvoiceRequest(
  searchParams: InvoicesPageSearchParams,
): InvoiceFilters & { sortBy: string; sortOrder: "asc" | "desc" } {
  const rawStatus = getSearchParam(searchParams, "status");
  const status =
    rawStatus === "DRAFT" || rawStatus === "FINAL" || rawStatus === "PENDING_CHARGE"
      ? rawStatus
      : undefined;
  const rawSortOrder =
    getSearchParam(searchParams, "sortOrder") ?? getSearchParam(searchParams, "sortDir");
  const rawSortBy = getSearchParam(searchParams, "sortBy");
  const sortBy =
    rawSortBy === "invoiceNumber" || rawSortBy === "date" || rawSortBy === "totalAmount"
      ? rawSortBy
      : "date";

  return {
    search: getSearchParam(searchParams, "search") ?? undefined,
    status,
    category: getSearchParam(searchParams, "category") ?? undefined,
    department: getSearchParam(searchParams, "department") ?? undefined,
    dateFrom: parseDate(getSearchParam(searchParams, "dateFrom")),
    dateTo: parseDate(getSearchParam(searchParams, "dateTo")),
    amountMin: parseAmount(getSearchParam(searchParams, "amountMin")),
    amountMax: parseAmount(getSearchParam(searchParams, "amountMax")),
    needsAccountNumber:
      getSearchParam(searchParams, "needsAccountNumber") === "true" ? true : undefined,
    creatorId: getSearchParam(searchParams, "creatorId") ?? undefined,
    page: parsePositiveInt(getSearchParam(searchParams, "page"), 1),
    pageSize: 20,
    sortBy,
    sortOrder: rawSortOrder === "asc" ? "asc" : "desc",
  };
}

export default async function InvoicesPage({
  searchParams = {},
}: {
  searchParams?: InvoicesPageSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const initialRequest = buildInitialInvoiceRequest(searchParams);
  const [staffList, categories, initialTableData, initialUsers] = await Promise.all([
    staffService.list({}),
    prisma.category.findMany({
      where: { active: true },
      select: { name: true, label: true },
      orderBy: { sortOrder: "asc" },
    }),
    invoiceService.list(initialRequest),
    invoiceService.getCreatorStats(),
  ]);

  const departments = Array.from(
    new Set(staffList.map((s) => s.department).filter(Boolean) as string[])
  ).sort();
  const initialBadgeStates =
    initialTableData.invoices.length > 0
      ? await followUpService.getBadgeStatesForInvoices(
          initialTableData.invoices.map((invoice) => invoice.id),
        )
      : {};

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-balance">Invoices</h1>
      <UserActivityStrip initialUsers={initialUsers.users} />
      <InvoiceTable
        departments={departments}
        categories={categories}
        initialData={initialTableData}
        initialRequest={initialRequest}
        initialBadgeStates={initialBadgeStates}
      />
    </div>
  );
}
