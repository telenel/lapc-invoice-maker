"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Shared singleton EventSource — all useSSE callers share one connection
// ---------------------------------------------------------------------------

const RECONNECT_DELAY_MS = 3000;

type Listener = (data: { type: string }) => void;

let sharedES: EventSource | null = null;
const listeners = new Set<Listener>();
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

function ensureConnection() {
  if (sharedES) return;

  const es = new EventSource("/api/notifications/stream");

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      listeners.forEach((fn) => fn(data));
    } catch {
      // Ignore parse errors
    }
  };

  es.onerror = () => {
    es.close();
    sharedES = null;
    // Reconnect only if there are still active listeners
    if (listeners.size > 0) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(ensureConnection, RECONNECT_DELAY_MS);
    }
  };

  sharedES = es;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  ensureConnection();

  return () => {
    listeners.delete(listener);
    // Close connection when no listeners remain
    if (listeners.size === 0) {
      clearTimeout(reconnectTimer);
      sharedES?.close();
      sharedES = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSSE(eventType: string, callback: () => void, debounceMs = 500) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const listener: Listener = (data) => {
      if (data.type === eventType) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => cbRef.current(), debounceMs);
      }
    };

    const unsubscribe = subscribe(listener);

    return () => {
      unsubscribe();
      clearTimeout(timerRef.current);
    };
  }, [eventType, debounceMs]);
}
