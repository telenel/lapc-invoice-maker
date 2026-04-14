import type { CalendarEventItem } from "@/domains/event/types";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";
import type { CreatorStatEntry } from "@/domains/invoice/types";

export type DashboardEvent = CalendarEventItem;

export interface DashboardFocusData {
  myDrafts: number;
  myRunning: number;
  myFinalThisMonth: number;
  myTotalThisMonth: number;
  myFinalLastMonth: number;
  myQuotesAwaitingResponse: number;
}

export interface DashboardStatsSummary {
  invoicesThisMonth: number;
  totalThisMonth: number;
  invoicesLastMonth: number;
  totalLastMonth: number;
  expectedCount: number;
  expectedTotal: number;
}

export interface DashboardStatsData {
  summary: DashboardStatsSummary;
  teamUsers: CreatorStatEntry[];
}

export interface DashboardPendingAccountItem {
  invoiceId: string;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: string;
  staffName: string;
  creatorName: string;
  creatorId: string;
  currentAttempt: number;
  maxAttempts: number;
  seriesStatus: string;
}

export interface DashboardRunningInvoiceItem {
  id: string;
  creatorId: string;
  creatorName: string;
  requestorName: string;
  department: string;
  detail: string;
  totalAmount: number;
  runningTitle: string | null;
  itemCount: number;
}

export interface DashboardActivityItem {
  type: "invoice" | "quote";
  id: string;
  number: string | null;
  name: string;
  department: string;
  date: string;
  amount: number;
  status: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  paymentFollowUpBadge?: FollowUpBadgeState | null;
}

export interface DashboardRecentActivityData {
  items: DashboardActivityItem[];
  badgeStates: Record<string, FollowUpBadgeState>;
}

export interface DashboardBootstrapData {
  todaysEvents: DashboardEvent[];
  yourFocus: DashboardFocusData | null;
  stats: DashboardStatsData;
  pendingAccounts: DashboardPendingAccountItem[];
  runningInvoices: DashboardRunningInvoiceItem[];
  recentActivity: DashboardRecentActivityData;
}
