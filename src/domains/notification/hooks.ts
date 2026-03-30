"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notificationApi } from "./api-client";
import type { NotificationResponse } from "./types";
import { subscribeToSSE } from "@/lib/use-sse";

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const result = await notificationApi.list();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    return subscribeToSSE((data) => {
      if ("id" in data && "title" in data) {
        const notification = data as NotificationResponse;
        setNotifications((prev) => {
          if (prev.some((item) => item.id === notification.id)) {
            return prev;
          }
          return [notification, ...prev];
        });
        setUnreadCount((prev) => prev + 1);
        return;
      }

      if (data.type === "notification-changed") {
        fetchNotifications();
      }
    });
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismiss = useCallback(async (id: string) => {
    await notificationApi.dismiss(id);
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, dismiss, refetch: fetchNotifications };
}
