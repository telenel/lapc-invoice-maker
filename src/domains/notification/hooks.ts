"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notificationApi } from "./api-client";
import type { NotificationResponse } from "./types";
import { subscribeToSSE } from "@/lib/use-sse";

const FALLBACK_POLL_DELAY_MS = 5_000;
const FALLBACK_POLL_INTERVAL_MS = 30_000;

function isNotificationPayload(data: unknown): data is NotificationResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  return (
    typeof (data as NotificationResponse).id === "string" &&
    typeof (data as NotificationResponse).title === "string" &&
    typeof (data as NotificationResponse).type === "string"
  );
}

function hasEventType(data: unknown): data is { type: string } {
  return typeof data === "object" && data !== null && typeof (data as { type?: unknown }).type === "string";
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const notificationsRef = useRef<NotificationResponse[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const result = await notificationApi.list();
      notificationsRef.current = result.notifications;
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
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let pollingTimer: ReturnType<typeof setInterval> | undefined;

    const stopPolling = () => {
      clearTimeout(fallbackTimer);
      clearInterval(pollingTimer);
      fallbackTimer = undefined;
      pollingTimer = undefined;
    };

    const startPolling = () => {
      if (pollingTimer) return;
      fetchNotifications();
      pollingTimer = setInterval(() => {
        fetchNotifications();
      }, FALLBACK_POLL_INTERVAL_MS);
    };

    fallbackTimer = setTimeout(() => {
      startPolling();
    }, FALLBACK_POLL_DELAY_MS);

    const unsubscribe = subscribeToSSE(
      (data) => {
        stopPolling();

        if (isNotificationPayload(data)) {
          if (notificationsRef.current.some((item) => item.id === data.id)) {
            return;
          }

          notificationsRef.current = [data, ...notificationsRef.current];
          setNotifications(notificationsRef.current);
          if (!data.read) {
            setUnreadCount((prev) => prev + 1);
          }
          return;
        }

        if (hasEventType(data) && data.type === "notification-changed") {
          fetchNotifications();
        }
      },
      {
        onConnectionChange(connected) {
          if (connected) {
            stopPolling();
            return;
          }

          startPolling();
        },
      },
    );

    return () => {
      stopPolling();
      unsubscribe();
    };
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await notificationApi.markRead(id);
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      notificationsRef.current = next;
      return next;
    });
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead();
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      notificationsRef.current = next;
      return next;
    });
    setUnreadCount(0);
  }, []);

  const dismiss = useCallback(async (id: string) => {
    await notificationApi.dismiss(id);
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      const next = prev.filter((n) => n.id !== id);
      notificationsRef.current = next;
      return next;
    });
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, dismiss, refetch: fetchNotifications };
}
