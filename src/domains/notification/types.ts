// src/domains/notification/types.ts

export type NotificationType = "QUOTE_VIEWED" | "QUOTE_APPROVED" | "QUOTE_DECLINED" | "EVENT_REMINDER" | "PAYMENT_FOLLOWUP_SENT" | "PAYMENT_DETAILS_RECEIVED";

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  quoteId: string | null;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  quoteId?: string;
}
