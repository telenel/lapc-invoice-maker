// src/domains/follow-up/types.ts

export const ACCOUNT_FOLLOWUP = "ACCOUNT_FOLLOWUP" as const;
export const ACCOUNT_FOLLOWUP_CLAIM = "ACCOUNT_FOLLOWUP_CLAIM" as const;
export const ACCOUNT_FOLLOWUP_TYPES = [ACCOUNT_FOLLOWUP, ACCOUNT_FOLLOWUP_CLAIM] as const;

export type FollowUpSeriesStatus = "ACTIVE" | "COMPLETED" | "EXHAUSTED";

export type FollowUpBadgeState = {
  seriesStatus: FollowUpSeriesStatus;
  currentAttempt: number;
  maxAttempts: number;
};

export type FollowUpSeriesResponse = {
  seriesId: string;
  invoiceId: string;
  seriesStatus: FollowUpSeriesStatus;
  shareToken: string | null;
  maxAttempts: number;
  currentAttempt: number;
  recipientEmail: string;
  createdAt: string;
  lastSentAt: string;
};

export type InitiateFollowUpRequest = {
  invoiceIds: string[];
};

export type InitiateFollowUpResult = {
  invoiceId: string;
  status: "success" | "error";
  seriesId?: string;
  error?: string;
};

export type InitiateFollowUpResponse = {
  results: InitiateFollowUpResult[];
  summary: { succeeded: number; failed: number };
};

export type PublicFollowUpSummary = {
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: "INVOICE" | "QUOTE";
  description: string;
  totalAmount: number;
  creatorName: string;
  currentAttempt: number;
  maxAttempts: number;
  seriesStatus: FollowUpSeriesStatus;
};

export type SubmitAccountNumberRequest = {
  accountNumber: string;
};

export const ESCALATING_SUBJECTS: Record<number, (num: string) => string> = {
  1: (num) => `Account number needed — ${num}`,
  2: (num) => `Reminder: Account number still needed — ${num}`,
  3: (num) => `Action required: Account number for ${num}`,
  4: (num) => `Urgent: Account number overdue — ${num}`,
  5: (num) => `Final notice: Account number required — ${num}`,
};

export const ESCALATING_TONES: Record<number, string> = {
  1: "friendly",
  2: "gentle",
  3: "firm",
  4: "urgent",
  5: "final",
};
