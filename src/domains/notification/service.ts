// src/domains/notification/service.ts
import * as notificationRepository from "./repository";
import { publish } from "@/lib/sse";
import type { NotificationResponse, CreateNotificationInput } from "./types";

function toResponse(n: {
  id: string;
  type: string;
  title: string;
  message: string | null;
  quoteId: string | null;
  read: boolean;
  createdAt: Date;
}): NotificationResponse {
  return {
    id: n.id,
    type: n.type as NotificationResponse["type"],
    title: n.title,
    message: n.message,
    quoteId: n.quoteId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export const notificationService = {
  async createAndPublish(
    input: CreateNotificationInput
  ): Promise<NotificationResponse> {
    const notification = await notificationRepository.create(input);
    const response = toResponse(notification);
    publish(input.userId, response);
    return response;
  },

  async list(userId: string, limit = 20, offset = 0) {
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.findByUserId(userId, limit, offset),
      notificationRepository.countUnread(userId),
    ]);
    return {
      notifications: notifications.map(toResponse),
      unreadCount,
    };
  },

  async markRead(id: string): Promise<void> {
    await notificationRepository.markRead(id);
  },

  async markAllRead(userId: string): Promise<void> {
    await notificationRepository.markAllRead(userId);
  },

  async delete(id: string, userId: string, isAdmin: boolean): Promise<void | "forbidden"> {
    const notification = await notificationRepository.findById(id);
    if (!notification) return;
    if (!isAdmin && notification.userId !== userId) return "forbidden";
    await notificationRepository.deleteById(id);
  },
};
