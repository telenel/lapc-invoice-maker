"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { formatAmount, formatDateCompact, getInitials } from "@/lib/formatters";
import { addDaysToDateKey, getDateKeyInLosAngeles } from "@/lib/date-utils";
import { useDashboardBootstrapData } from "./dashboard-bootstrap-provider";
import { useDeferredDashboardRealtime } from "./use-deferred-dashboard-realtime";
import { invoiceApi } from "@/domains/invoice/api-client";
import { quoteApi } from "@/domains/quote/api-client";
import { followUpApi } from "@/domains/follow-up/api-client";
import { calendarApi } from "@/domains/calendar/api-client";
import type {
  DashboardActivityItem,
  DashboardEvent,
  DashboardPendingAccountItem,
  DashboardRunningInvoiceItem,
  DashboardStatsData,
} from "@/domains/dashboard/types";
import type { InvoiceListItemResponse } from "@/domains/invoice/types";
import type { QuoteListItemResponse } from "@/domains/quote/types";
import { cn } from "@/lib/utils";

type QueueTab = "drafts" | "running" | "awaiting" | "finalized";

type QueueItem = {
  id: string;
  type: "invoice" | "quote";
  number: string;
  name: string;
  department: string;
  date: string;
  amount: number;
  status: string;
  href: string;
};

function formatHeaderDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function formatEventTime(value: string, allDay: boolean) {
  if (allDay) {
    return "All day";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

function formatQueueNumber(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function getItemDisplayName(item: { staff?: { name: string } | null; contact?: { name: string } | null; recipientName?: string | null }) {
  return item.staff?.name ?? item.contact?.name ?? item.recipientName ?? "Unknown";
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "FINAL":
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-700";
    case "RUNNING":
      return "bg-cyan-100 text-cyan-700";
    case "SENT":
    case "SUBMITTED_EMAIL":
    case "SUBMITTED_MANUAL":
      return "bg-sky-100 text-sky-700";
    case "DECLINED":
      return "bg-[var(--primary)]/10 text-[var(--primary)]";
    case "FOLLOW_UP":
      return "bg-amber-500 text-white";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "FINAL":
      return "Final";
    case "RUNNING":
      return "Running";
    case "SENT":
      return "Sent";
    case "SUBMITTED_EMAIL":
      return "Submitted";
    case "SUBMITTED_MANUAL":
      return "Submitted";
    case "ACCEPTED":
      return "Accepted";
    case "DECLINED":
      return "Declined";
    case "FOLLOW_UP":
      return "Follow up";
    default:
      return "Draft";
  }
}

function QueueStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.01em]",
        getStatusBadgeClasses(status),
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function PendingAttemptBadge({
  currentAttempt,
  maxAttempts,
  exhausted,
}: {
  currentAttempt: number;
  maxAttempts: number;
  exhausted: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.01em]",
        exhausted
          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
          : "bg-amber-500 text-white",
      )}
    >
      {exhausted ? "No response" : `${currentAttempt}/${maxAttempts}`}
    </span>
  );
}

function Bars({ values }: { values: number[] }) {
  const safeValues = values.length === 12 ? values : Array(12).fill(0);
  const maxValue = Math.max(...safeValues, 1);

  return (
    <div className="mt-3 flex h-14 items-end gap-1">
      {safeValues.map((value, index) => (
        <div
          key={`${index}-${value}`}
          className="flex-1 rounded-t-full bg-[var(--primary)]/14"
        >
          <div
            className="w-full rounded-t-full bg-[var(--primary)]"
            style={{
              height: `${Math.max(6, Math.round((value / maxValue) * 56))}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function PaneTitle({
  eyebrow,
  pill,
  subtitle,
  accent = false,
}: {
  eyebrow: string;
  pill: string;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]",
            accent ? "text-[var(--primary)]" : "text-foreground",
          )}
        >
          {eyebrow}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            accent
              ? "bg-[var(--primary)]/10 text-[var(--primary)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {pill}
        </span>
      </div>
      {subtitle ? (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

function QueueItemRow({ item }: { item: QueueItem }) {
  return (
    <Link
      href={item.href}
      className="grid gap-4 bg-card px-4 py-3 transition-colors duration-150 hover:bg-accent sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
    >
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-medium text-muted-foreground">
          {item.number}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold tracking-[-0.01em]">
          {item.name}
        </p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          {item.department} · {formatDateCompact(item.date)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-sm font-bold tabular-nums">
          {formatAmount(item.amount)}
        </span>
        <QueueStatusBadge status={item.status} />
      </div>
      <div className="sm:justify-self-end">
        <span className="inline-flex items-center rounded-[7px] bg-foreground px-3 py-1.5 text-[11.5px] font-semibold text-background transition-colors duration-150 hover:bg-[var(--primary)]">
          Open
        </span>
      </div>
    </Link>
  );
}

function RunningInvoicesCard({
  items,
}: {
  items: DashboardRunningInvoiceItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Running invoices · you
        </span>
        <Link href="/invoices?status=DRAFT" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/invoices/${item.id}/edit`}
            className={cn(
              "grid gap-2 py-1 text-[12.5px] transition-colors hover:text-[var(--primary)] sm:grid-cols-[72px_minmax(0,1fr)_auto_auto] sm:items-baseline sm:gap-3",
              index > 0 && "border-t border-dashed border-border pt-3",
            )}
          >
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatQueueNumber(item.invoiceNumber, "Running")}
            </span>
            <span className="truncate font-semibold">{item.detail}</span>
            <span className="text-muted-foreground">
              {item.itemCount} charge{item.itemCount === 1 ? "" : "s"}
            </span>
            <span className="text-right font-semibold tabular-nums">
              {formatAmount(item.totalAmount)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PendingAccountsCard({
  items,
}: {
  items: DashboardPendingAccountItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Pending account numbers
        </span>
        <span className="text-xs text-muted-foreground">{items.length} open</span>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <Link
            key={item.invoiceId}
            href={item.type === "QUOTE" ? `/quotes/${item.invoiceId}` : `/invoices/${item.invoiceId}`}
            className={cn(
              "grid gap-2 py-1 text-[12.5px] transition-colors hover:text-[var(--primary)] sm:grid-cols-[90px_minmax(0,1fr)_auto] sm:items-center sm:gap-3",
              index > 0 && "border-t border-dashed border-border pt-3",
            )}
          >
            <span className="font-mono text-[11px] text-muted-foreground">
              {item.type === "QUOTE"
                ? formatQueueNumber(item.quoteNumber, "Quote")
                : formatQueueNumber(item.invoiceNumber, "Invoice")}
            </span>
            <span className="truncate font-semibold">{item.staffName}</span>
            <PendingAttemptBadge
              currentAttempt={item.currentAttempt}
              maxAttempts={item.maxAttempts}
              exhausted={item.seriesStatus === "EXHAUSTED"}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatsBlock({ stats }: { stats: DashboardStatsData["summary"] }) {
  const pipeline = stats.pipeline ?? Array(12).fill(0);
  const delta =
    stats.totalLastMonth > 0
      ? Math.round(((stats.totalThisMonth / stats.totalLastMonth) - 1) * 100)
      : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="rounded-[var(--radius)] border border-border bg-card px-4 py-3.5">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Finalized
        </p>
        <p className="mt-1 text-[22px] font-extrabold tracking-[-0.015em] tabular-nums">
          {formatAmount(stats.totalThisMonth)}
        </p>
        <p className="mt-1 text-[11px] font-bold text-emerald-600">
          {delta >= 0 ? "+" : ""}
          {delta}% vs last mo
        </p>
        <Bars values={pipeline} />
      </section>

      <section className="rounded-[var(--radius)] border border-border bg-card px-4 py-3.5">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Expected pipeline
        </p>
        <p className="mt-1 text-[22px] font-extrabold tracking-[-0.015em] tabular-nums">
          {formatAmount(stats.expectedTotal)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {stats.expectedCount} drafts + open quotes
        </p>
        <div className="mt-4 h-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-amber-500"
            style={{ width: `${Math.min(100, stats.expectedCount * 6)}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Projected close rate · 72%
        </p>
      </section>
    </div>
  );
}

function TopContributors({
  currentUserId,
  users,
}: {
  currentUserId: string | null;
  users: DashboardStatsData["teamUsers"];
}) {
  if (users.length === 0) {
    return null;
  }

  const topAmount = Math.max(...users.map((user) => user.totalAmount), 1);

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Top contributors
        </span>
        <Link href="/analytics" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          All users
        </Link>
      </div>
      <div className="space-y-2">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const width = Math.max(8, Math.round((user.totalAmount / topAmount) * 100));

          return (
            <div
              key={user.id}
              className={cn(
                "grid items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent sm:grid-cols-[24px_minmax(0,1fr)_80px_80px]",
                isCurrentUser && "bg-[var(--primary)]/5",
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                  isCurrentUser
                    ? "border border-[var(--primary)] text-[var(--primary)]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {getInitials(user.name)}
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="truncate text-[12.5px] font-semibold">{user.name}</span>
                {isCurrentUser ? (
                  <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--primary)]">
                    You
                  </span>
                ) : null}
              </div>
              <div className="h-1 rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    isCurrentUser ? "bg-[var(--primary)]" : "bg-[var(--primary)]/35",
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="text-right text-xs font-bold tabular-nums">
                {formatAmount(user.totalAmount)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TodaysEventsCard({ events }: { events: DashboardEvent[] }) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Today
        </span>
        <Link href="/calendar" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Calendar
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events today.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href="/calendar"
              className="grid gap-3 rounded-md py-1 transition-colors hover:bg-accent sm:grid-cols-[60px_3px_minmax(0,1fr)] sm:items-center"
            >
              <span className="font-mono text-[11.5px] text-muted-foreground">
                {formatEventTime(event.start, event.allDay)}
              </span>
              <span
                className="block h-6 w-[3px] rounded-full"
                style={{ backgroundColor: event.borderColor ?? event.color }}
              />
              <span className="block min-w-0">
                <span className="block truncate text-[12.5px] font-semibold">
                  {event.title}
                </span>
                {event.extendedProps.location ? (
                  <span className="block text-[11px] text-muted-foreground">
                    {event.extendedProps.location}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamActivityCard({
  items,
}: {
  items: DashboardActivityItem[];
}) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Team activity
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Live
        </span>
      </div>
      <div className="-mx-4 max-h-[340px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.type === "quote" ? `/quotes/${item.id}` : `/invoices/${item.id}`}
              className="grid gap-3 px-4 py-3 transition-colors hover:bg-accent sm:grid-cols-[24px_minmax(0,1fr)_110px_auto] sm:items-center"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {getInitials(item.creatorName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold">
                  {formatQueueNumber(item.number, item.type === "quote" ? "Quote" : "Invoice")} · {item.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {item.department} · {formatDateCompact(item.date)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-bold tabular-nums">
                  {formatAmount(item.amount)}
                </p>
              </div>
              <div className="sm:justify-self-end">
                <QueueStatusBadge status={item.status} />
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function buildQueueItemFromInvoice(
  invoice: InvoiceListItemResponse,
  href: string,
  status: string,
): QueueItem {
  return {
    id: invoice.id,
    type: "invoice",
    number: formatQueueNumber(invoice.invoiceNumber, "Draft invoice"),
    name: getItemDisplayName(invoice),
    department: invoice.department,
    date: invoice.date,
    amount: Number(invoice.totalAmount),
    status,
    href,
  };
}

function buildQueueItemFromQuote(quote: QuoteListItemResponse): QueueItem {
  return {
    id: quote.id,
    type: "quote",
    number: formatQueueNumber(quote.quoteNumber, "Open quote"),
    name: getItemDisplayName(quote),
    department: quote.department,
    date: quote.date,
    amount: Number(quote.totalAmount),
    status: quote.quoteStatus,
    href: `/quotes/${quote.id}`,
  };
}

function mapRunningInvoicesToQueue(items: DashboardRunningInvoiceItem[]): QueueItem[] {
  return items.slice(0, 5).map((item) => ({
    id: item.id,
    type: "invoice",
    number: formatQueueNumber(item.invoiceNumber, "Running invoice"),
    name: item.requestorName,
    department: item.department,
    date: item.openedAt ?? new Date().toISOString(),
    amount: item.totalAmount,
    status: "RUNNING",
    href: `/invoices/${item.id}/edit`,
  }));
}

export function DashboardOperatorView({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string | null;
  currentUserName: string;
}) {
  const dashboardBootstrap = useDashboardBootstrapData();
  const [activeQueueTab, setActiveQueueTab] = useState<QueueTab>("drafts");
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStatsData>(
    dashboardBootstrap?.stats ?? {
      summary: {
        invoicesThisMonth: 0,
        totalThisMonth: 0,
        invoicesLastMonth: 0,
        totalLastMonth: 0,
        expectedCount: 0,
        expectedTotal: 0,
        pipeline: Array(12).fill(0),
      },
      teamUsers: [],
    },
  );
  const [recentActivity, setRecentActivity] = useState<DashboardActivityItem[]>(
    dashboardBootstrap?.recentActivity.items ?? [],
  );
  const [runningInvoices, setRunningInvoices] = useState<DashboardRunningInvoiceItem[]>(
    dashboardBootstrap?.runningInvoices ?? [],
  );
  const [pendingAccounts, setPendingAccounts] = useState<DashboardPendingAccountItem[]>(
    dashboardBootstrap?.pendingAccounts ?? [],
  );
  const [todaysEvents, setTodaysEvents] = useState<DashboardEvent[]>(
    dashboardBootstrap?.todaysEvents ?? [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadQueue() {
      if (!currentUserId) {
        setQueueItems([]);
        setQueueLoading(false);
        return;
      }

      if (activeQueueTab === "running") {
        setQueueLoading(false);
        return;
      }

      setQueueLoading(true);

      try {
        if (activeQueueTab === "drafts") {
          const data = await invoiceApi.list({
            creatorId: currentUserId,
            status: "DRAFT",
            isRunning: false,
            pageSize: 5,
            sortBy: "createdAt",
            sortOrder: "desc",
          });

          if (!cancelled) {
            startTransition(() => {
              setQueueItems(
                data.invoices.map((invoice) =>
                  buildQueueItemFromInvoice(invoice, `/invoices/${invoice.id}/edit`, invoice.status),
                ),
              );
            });
          }
        }

        if (activeQueueTab === "awaiting") {
          const data = await quoteApi.list({
            creatorId: currentUserId,
            quoteStatus: "SENT",
            pageSize: 5,
            sortBy: "createdAt",
            sortOrder: "desc",
          });

          if (!cancelled) {
            startTransition(() => {
              setQueueItems(data.quotes.map((quote) => buildQueueItemFromQuote(quote)));
            });
          }
        }

        if (activeQueueTab === "finalized") {
          const dateTo = getDateKeyInLosAngeles();
          const dateFrom = `${dateTo.slice(0, 7)}-01`;
          const data = await invoiceApi.list({
            creatorId: currentUserId,
            status: "FINAL",
            dateFrom,
            dateTo,
            pageSize: 5,
            sortBy: "createdAt",
            sortOrder: "desc",
          });

          if (!cancelled) {
            startTransition(() => {
              setQueueItems(
                data.invoices.map((invoice) =>
                  buildQueueItemFromInvoice(invoice, `/invoices/${invoice.id}`, "FINAL"),
                ),
              );
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load dashboard queue:", error);
          setQueueItems([]);
        }
      } finally {
        if (!cancelled) {
          setQueueLoading(false);
        }
      }
    }

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, [activeQueueTab, currentUserId]);

  useEffect(() => {
    if (dashboardBootstrap?.todaysEvents?.length) {
      return;
    }

    let cancelled = false;

    async function loadEvents() {
      try {
        const startDateKey = getDateKeyInLosAngeles();
        const data = await calendarApi.getEvents(
          startDateKey,
          addDaysToDateKey(startDateKey, 1),
        );
        if (!cancelled) {
          setTodaysEvents(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load today's events:", error);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [dashboardBootstrap?.todaysEvents]);

  async function refreshStats() {
    try {
      const response = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to refresh dashboard stats");
      }

      const data = (await response.json()) as DashboardStatsData;
      startTransition(() => {
        setStats(data);
      });
    } catch (error) {
      console.error("Failed to refresh dashboard stats:", error);
    }
  }

  async function refreshActivity() {
    try {
      const [invoiceData, quoteData] = await Promise.all([
        invoiceApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }),
        quoteApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }),
      ]);

      const invoiceItems = invoiceData.invoices.map((invoice) => ({
        type: "invoice" as const,
        id: invoice.id,
        number: invoice.invoiceNumber,
        name: getItemDisplayName(invoice),
        department: invoice.department,
        date: invoice.date,
        amount: Number(invoice.totalAmount),
        status: invoice.status,
        creatorId: invoice.creatorId,
        creatorName: invoice.creatorName,
        createdAt: invoice.createdAt,
      }));

      const quoteItems = quoteData.quotes.map((quote) => ({
        type: "quote" as const,
        id: quote.id,
        number: quote.quoteNumber,
        name: getItemDisplayName(quote),
        department: quote.department,
        date: quote.date,
        amount: Number(quote.totalAmount),
        status: quote.quoteStatus,
        creatorId: quote.creatorId,
        creatorName: quote.creatorName,
        createdAt: quote.createdAt,
      }));

      startTransition(() => {
        setRecentActivity(
          [...invoiceItems, ...quoteItems]
            .sort((left, right) => (
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            ))
            .slice(0, 10),
        );
      });
    } catch (error) {
      console.error("Failed to refresh dashboard activity:", error);
    }
  }

  async function refreshRunningInvoices() {
    if (!currentUserId) {
      setRunningInvoices([]);
      return;
    }

    try {
      const data = await invoiceApi.list({
        creatorId: currentUserId,
        status: "DRAFT",
        isRunning: true,
        pageSize: 50,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      startTransition(() => {
        setRunningInvoices(
          data.invoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            creatorId: invoice.creatorId,
            creatorName: invoice.creatorName,
            openedAt: invoice.createdAt,
            requestorName: getItemDisplayName(invoice),
            department: invoice.department,
            detail: invoice.runningTitle || invoice.firstItemDescription || "Untitled Running Invoice",
            totalAmount: Number(invoice.totalAmount),
            runningTitle: invoice.runningTitle,
            itemCount: invoice.itemCount,
          })),
        );
      });
    } catch (error) {
      console.error("Failed to refresh running invoices:", error);
    }
  }

  async function refreshPendingAccounts() {
    try {
      const data = await followUpApi.getPendingAccounts();
      startTransition(() => {
        setPendingAccounts(data.items);
      });
    } catch (error) {
      console.error("Failed to refresh pending accounts:", error);
    }
  }

  useDeferredDashboardRealtime(["invoice-changed", "quote-changed"], refreshStats);
  useDeferredDashboardRealtime(["invoice-changed", "quote-changed"], refreshActivity);
  useDeferredDashboardRealtime(["invoice-changed"], refreshRunningInvoices);
  useDeferredDashboardRealtime(["invoice-changed", "quote-changed"], refreshPendingAccounts);

  const firstName = currentUserName.trim().split(" ")[0] ?? "";
  const focus = dashboardBootstrap?.yourFocus;
  const openQueueCount = (focus?.myDrafts ?? 0) + (focus?.myQuotesAwaitingResponse ?? 0);
  const visibleQueueItems = activeQueueTab === "running"
    ? mapRunningInvoicesToQueue(runningInvoices)
    : queueItems;
  const now = new Date();

  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-4 px-4 pb-24 pt-5 sm:px-7">
      <section className="dashboard-enter dashboard-enter-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {formatHeaderDate(now)}
          </p>
          <h1 className="text-3xl font-bold tracking-[-0.02em]">
            Hi{firstName ? `, ${firstName}` : ""}.
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/invoices/new"
            className="inline-flex items-center rounded-[8px] bg-[var(--primary)] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary)]/90"
          >
            + New Invoice
          </Link>
          <Link
            href="/quotes/new"
            className="inline-flex items-center rounded-[8px] border border-border bg-card px-3.5 py-2.5 text-[13px] font-semibold transition-colors hover:bg-accent"
          >
            + New Quote
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center rounded-[8px] border border-border bg-card px-3.5 py-2.5 text-[13px] font-semibold transition-colors hover:bg-accent"
          >
            + Event
          </Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
        <section className="dashboard-enter dashboard-enter-2 relative pl-5">
          <span className="absolute left-0 top-1 hidden h-[calc(100%-8px)] w-[3px] rounded-full bg-[var(--primary)] xl:block" />
          <div className="space-y-3">
            <PaneTitle
              eyebrow="Your queue"
              pill={`${openQueueCount} open`}
              subtitle="Drafts you own and quotes awaiting recipient response."
              accent
            />

            <div className="rounded-[10px] bg-muted p-1">
              <div className="flex flex-wrap gap-1">
                {[
                  { key: "drafts", label: `Drafts · ${focus?.myDrafts ?? 0}` },
                  { key: "running", label: `Running · ${focus?.myRunning ?? 0}` },
                  { key: "awaiting", label: `Awaiting · ${focus?.myQuotesAwaitingResponse ?? 0}` },
                  { key: "finalized", label: `Finalized · ${focus?.myFinalThisMonth ?? 0}` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={activeQueueTab === tab.key}
                    onClick={() => setActiveQueueTab(tab.key as QueueTab)}
                    className={cn(
                      "flex-1 rounded-[7px] px-3 py-2 text-[12px] font-semibold transition-all",
                      activeQueueTab === tab.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-card/60",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-border">
              {queueLoading ? (
                <div className="space-y-px">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-2 bg-card px-4 py-3">
                      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : visibleQueueItems.length > 0 ? (
                <div className="space-y-px">
                  {visibleQueueItems.map((item) => (
                    <QueueItemRow key={`${item.type}-${item.id}`} item={item} />
                  ))}
                </div>
              ) : (
                <div className="bg-card px-4 py-8 text-sm text-muted-foreground">
                  Nothing is waiting in this queue right now.
                </div>
              )}
            </div>

            <RunningInvoicesCard items={runningInvoices} />
            <PendingAccountsCard items={pendingAccounts} />
          </div>
        </section>

        <section className="dashboard-enter dashboard-enter-3">
          <div className="space-y-3">
            <PaneTitle
              eyebrow={`Team · ${formatMonthLabel(now)}`}
              pill={`${stats.summary.invoicesThisMonth} invoices`}
            />

            <StatsBlock stats={stats.summary} />
            <TopContributors currentUserId={currentUserId} users={stats.teamUsers} />
            <TodaysEventsCard events={todaysEvents} />
            <TeamActivityCard items={recentActivity} />
          </div>
        </section>
      </div>

      <p className="sr-only">{formatShortDate(now)}</p>
    </main>
  );
}
