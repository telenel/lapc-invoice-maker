// src/domains/notification/types.ts

export type NotificationType = "QUOTE_VIEWED" | "QUOTE_APPROVED" | "QUOTE_DECLINED";

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
