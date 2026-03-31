// src/domains/notification/types.ts

export type NotificationType = "QUOTE_VIEWED" | "QUOTE_APPROVED" | "QUOTE_DECLINED" | "EVENT_REMINDER" | "PAYMENT_FOLLOWUP_SENT" | "PAYMENT_DETAILS_RECEIVED";

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  quoteId: string | null;
  /** Future: requires Prisma schema migration to add invoiceId column */
  invoiceId: string | null;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  quoteId?: string;
  /** Future: requires Prisma schema migration to add invoiceId column */
  invoiceId?: string;
}
