"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notificationApi } from "./api-client";
import type { NotificationResponse } from "./types";

const POLL_INTERVAL = 30_000; // 30s fallback polling

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseConnected = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await notificationApi.list();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // SSE for real-time push
    const es = new EventSource("/api/notifications/stream");
    eventSourceRef.current = es;

    es.onopen = () => {
      sseConnected.current = true;
    };

    es.onmessage = (event) => {
      try {
        const notification: NotificationResponse = JSON.parse(event.data);
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      sseConnected.current = false;
      // EventSource auto-reconnects, but fetch on reconnect to catch missed notifications
      fetchNotifications();
    };

    // Polling fallback — catches notifications missed during SSE disconnects
    pollRef.current = setInterval(() => {
      fetchNotifications();
    }, POLL_INTERVAL);

    return () => {
      es.close();
      eventSourceRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications };
}
