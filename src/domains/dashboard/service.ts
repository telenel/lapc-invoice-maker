import "server-only";

import { prisma } from "@/lib/prisma";
import { LOS_ANGELES_TIME_ZONE } from "@/lib/date-utils";
import { listCalendarEventsForRange } from "@/domains/calendar/service";
import { followUpRepository } from "@/domains/follow-up/repository";
import { followUpService } from "@/domains/follow-up/service";
import { invoiceService } from "@/domains/invoice/service";
import { getQuotePaymentFollowUpBadgeState } from "@/domains/quote/payment-follow-up";
import { countPaymentReminderAttemptsByInvoiceIds } from "@/domains/quote/repository";
import type {
  DashboardActivityItem,
  DashboardBootstrapData,
  DashboardFocusData,
  DashboardPendingAccountItem,
  DashboardRecentActivityData,
  DashboardRunningInvoiceItem,
  DashboardStatsData,
} from "./types";

function isLegacyPendingCharge(status: string | null | undefined): boolean {
  return status === "PENDING_CHARGE";
}

function normalizeInvoiceActivityStatus(status: string | null | undefined): string {
  return isLegacyPendingCharge(status) ? "DRAFT" : (status ?? "DRAFT");
}

function buildRunningInvoiceDetail(invoice: {
  runningTitle: string | null;
  items: { description: string }[];
}): string {
  const firstItemDescription = invoice.items[0]?.description?.trim();
  return invoice.runningTitle?.trim() || firstItemDescription || "Untitled Running Invoice";
}

function getDateKeyInLosAngeles(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LOS_ANGELES_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to derive Los Angeles date key");
  }

  return `${year}-${month}-${day}`;
}

function getTodaysEventsWindow(now = new Date()) {
  return {
    startDateKey: getDateKeyInLosAngeles(now),
    endDateKey: getDateKeyInLosAngeles(
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
    ),
  };
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getFocusDateRanges(now = new Date()) {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    dateFrom: formatDateKey(firstOfMonth),
    dateTo: formatDateKey(now),
    lastMonthFrom: formatDateKey(firstOfLastMonth),
    lastMonthTo: formatDateKey(lastOfLastMonth),
  };
}

async function getDashboardStatsData(now = new Date()): Promise<DashboardStatsData> {
  const { dateFrom, dateTo, lastMonthFrom, lastMonthTo } = getFocusDateRanges(now);

  const [monthData, lastMonthData, teamUsers] = await Promise.all([
    invoiceService.getStats({ status: "FINAL", dateFrom, dateTo }),
    invoiceService.getStats({
      status: "FINAL",
      dateFrom: lastMonthFrom,
      dateTo: lastMonthTo,
    }),
    invoiceService.getCreatorStats(),
  ]);

  return {
    summary: {
      invoicesThisMonth: monthData.total,
      totalThisMonth: monthData.sumTotalAmount,
      invoicesLastMonth: lastMonthData.total,
      totalLastMonth: lastMonthData.sumTotalAmount,
    },
    teamUsers: teamUsers.users,
  };
}

async function getDashboardFocusData(
  currentUserId: string | null,
  now = new Date(),
): Promise<DashboardFocusData | null> {
  if (!currentUserId) {
    return null;
  }

  const { dateFrom, dateTo, lastMonthFrom, lastMonthTo } = getFocusDateRanges(now);

  const [
    myDrafts,
    myRunning,
    thisMonthFinal,
    lastMonthFinal,
    myQuotesAwaitingResponse,
  ] = await Promise.all([
    prisma.invoice.count({
      where: {
        type: "INVOICE",
        status: { in: ["DRAFT", "PENDING_CHARGE"] },
        createdBy: currentUserId,
      },
    }),
    prisma.invoice.count({
      where: {
        type: "INVOICE",
        OR: [
          { status: "PENDING_CHARGE" },
          { status: "DRAFT", isRunning: true },
        ],
        createdBy: currentUserId,
      },
    }),
    prisma.invoice.aggregate({
      where: {
        type: "INVOICE",
        status: "FINAL",
        createdBy: currentUserId,
        date: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: {
        type: "INVOICE",
        status: "FINAL",
        createdBy: currentUserId,
        date: {
          gte: new Date(lastMonthFrom),
          lte: new Date(lastMonthTo),
        },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.invoice.count({
      where: {
        type: "QUOTE",
        quoteStatus: "SENT",
        createdBy: currentUserId,
      },
    }),
  ]);

  return {
    myDrafts,
    myRunning,
    myFinalThisMonth: thisMonthFinal._count._all,
    myTotalThisMonth: Number(thisMonthFinal._sum.totalAmount ?? 0),
    myFinalLastMonth: lastMonthFinal._count._all,
    myQuotesAwaitingResponse,
  };
}

async function getPendingAccounts(): Promise<DashboardPendingAccountItem[]> {
  const rows = await followUpRepository.getPendingAccountsSummary();
  return rows.map((row) => {
    const attempt =
      ((row.metadata as Record<string, unknown>)?.attempt as number) ?? 1;

    return {
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      quoteNumber: row.invoice.quoteNumber,
      type: row.invoice.type,
      staffName: row.invoice.staff?.name ?? "Unknown",
      creatorName: row.invoice.creator?.name ?? "Unknown",
      creatorId: row.invoice.createdBy,
      currentAttempt: attempt,
      maxAttempts: row.maxAttempts ?? 5,
      seriesStatus: row.seriesStatus ?? "ACTIVE",
    };
  });
}

async function getRunningInvoices(): Promise<DashboardRunningInvoiceItem[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      type: "INVOICE",
      OR: [
        { status: "PENDING_CHARGE" },
        { status: "DRAFT", isRunning: true },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdBy: true,
      department: true,
      totalAmount: true,
      runningTitle: true,
      status: true,
      creator: { select: { name: true } },
      staff: { select: { name: true } },
      contact: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { description: true },
      },
      _count: { select: { items: true } },
    },
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
    creatorId: invoice.createdBy,
    creatorName: invoice.creator.name,
    requestorName: invoice.staff?.name ?? invoice.contact?.name ?? "Unknown Requestor",
    department: invoice.department,
    detail: buildRunningInvoiceDetail(invoice),
    totalAmount: Number(invoice.totalAmount),
    runningTitle: invoice.runningTitle ?? (isLegacyPendingCharge(invoice.status) ? "Legacy POS Invoice" : null),
    itemCount: invoice._count.items,
  }));
}

async function getRecentActivity(): Promise<DashboardRecentActivityData> {
  const rows = await prisma.invoice.findMany({
    where: {
      type: { in: ["INVOICE", "QUOTE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      invoiceNumber: true,
      quoteNumber: true,
      recipientName: true,
      department: true,
      date: true,
      totalAmount: true,
      status: true,
      quoteStatus: true,
      recipientEmail: true,
      shareToken: true,
      paymentMethod: true,
      createdBy: true,
      createdAt: true,
      creator: { select: { name: true } },
      staff: { select: { name: true } },
      contact: { select: { name: true } },
      convertedToInvoice: {
        select: {
          id: true,
          paymentMethod: true,
        },
      },
    },
  });

  const quoteIds = rows
    .filter((row) => row.type === "QUOTE")
    .map((row) => row.id);
  const paymentReminderAttempts = await countPaymentReminderAttemptsByInvoiceIds(quoteIds);

  const items: DashboardActivityItem[] = rows.map((row) => ({
    type: row.type === "QUOTE" ? "quote" : "invoice",
    id: row.id,
    number: row.type === "QUOTE" ? row.quoteNumber : row.invoiceNumber,
    name:
      row.staff?.name ??
      row.contact?.name ??
      row.recipientName ??
      "Unknown",
    department: row.department,
    date: row.date.toISOString(),
    amount: Number(row.totalAmount),
    status: row.type === "QUOTE"
      ? row.quoteStatus ?? "DRAFT"
      : normalizeInvoiceActivityStatus(row.status),
    creatorId: row.createdBy,
    creatorName: row.creator.name,
    createdAt: row.createdAt.toISOString(),
    paymentFollowUpBadge: row.type === "QUOTE"
      ? getQuotePaymentFollowUpBadgeState({
          quoteStatus: row.quoteStatus ?? "DRAFT",
          paymentDetailsResolved: Boolean(row.paymentMethod || row.convertedToInvoice?.paymentMethod),
          hasShareToken: Boolean(row.shareToken),
          hasRecipientEmail: Boolean(row.recipientEmail),
          hasConvertedInvoice: Boolean(row.convertedToInvoice),
          sentAttempts: paymentReminderAttempts[row.id] ?? 0,
        })
      : null,
  }));

  const invoiceIds = items
    .filter((item) => item.type === "invoice")
    .map((item) => item.id);

  const badgeStates =
    invoiceIds.length > 0
      ? await followUpService.getBadgeStatesForInvoices(invoiceIds)
      : {};

  return {
    items,
    badgeStates,
  };
}

export async function getDashboardBootstrapData(
  currentUserId: string | null,
): Promise<DashboardBootstrapData> {
  const { startDateKey, endDateKey } = getTodaysEventsWindow();

  const [
    todaysEvents,
    yourFocus,
    stats,
    pendingAccounts,
    runningInvoices,
    recentActivity,
  ] = await Promise.all([
    listCalendarEventsForRange(startDateKey, endDateKey),
    getDashboardFocusData(currentUserId),
    getDashboardStatsData(),
    getPendingAccounts(),
    getRunningInvoices(),
    getRecentActivity(),
  ]);

  return {
    todaysEvents,
    yourFocus,
    stats,
    pendingAccounts,
    runningInvoices,
    recentActivity,
  };
}
