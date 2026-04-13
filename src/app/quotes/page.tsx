import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { staffService } from "@/domains/staff/service";
import { quoteService } from "@/domains/quote/service";
import type { QuoteFilters } from "@/domains/quote/types";
import { followUpService } from "@/domains/follow-up/service";
import { prisma } from "@/lib/prisma";
import { QuoteTable } from "@/components/quotes/quote-table";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

type QuotesPageSearchParams = Record<string, string | string[] | undefined>;

function getSearchParam(
  searchParams: QuotesPageSearchParams,
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

function buildInitialQuoteRequest(
  searchParams: QuotesPageSearchParams,
): QuoteFilters & { sortBy: string; sortOrder: "asc" | "desc" } {
  const rawStatus = getSearchParam(searchParams, "quoteStatus");
  const quoteStatus =
    rawStatus === "DRAFT"
    || rawStatus === "SENT"
    || rawStatus === "SUBMITTED_EMAIL"
    || rawStatus === "SUBMITTED_MANUAL"
    || rawStatus === "ACCEPTED"
    || rawStatus === "DECLINED"
    || rawStatus === "REVISED"
    || rawStatus === "EXPIRED"
    || rawStatus === "all"
      ? rawStatus
      : undefined;
  const rawSortOrder =
    getSearchParam(searchParams, "sortOrder") ?? getSearchParam(searchParams, "sortDir");
  const rawSortBy = getSearchParam(searchParams, "sortBy");
  const sortBy =
    rawSortBy === "quoteNumber"
    || rawSortBy === "date"
    || rawSortBy === "createdAt"
    || rawSortBy === "totalAmount"
    || rawSortBy === "expirationDate"
      ? rawSortBy
      : "createdAt";

  return {
    search: getSearchParam(searchParams, "search") ?? undefined,
    quoteStatus,
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

export default async function QuotesPage({
  searchParams = {},
}: {
  searchParams?: QuotesPageSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const initialRequest = buildInitialQuoteRequest(searchParams);
  const [staffList, categories, initialTableData] = await Promise.all([
    staffService.list({}),
    prisma.category.findMany({
      where: { active: true },
      select: { name: true, label: true },
      orderBy: { sortOrder: "asc" },
    }),
    quoteService.list(initialRequest),
  ]);

  const departmentSet = new Set(staffList.map((s) => s.department).filter(Boolean) as string[]);
  const departments = Array.from(departmentSet).sort();
  const initialBadgeStates =
    initialTableData.quotes.length > 0
      ? await followUpService.getBadgeStatesForInvoices(
          initialTableData.quotes.map((quote) => quote.id),
        )
      : {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Button className="w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto" render={<Link href="/quotes/new" />}>
          New Quote
        </Button>
      </div>
      <QuoteTable
        departments={departments}
        categories={categories}
        initialData={initialTableData}
        initialRequest={initialRequest}
        initialBadgeStates={initialBadgeStates}
      />
    </div>
  );
}
