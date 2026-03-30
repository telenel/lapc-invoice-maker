"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Shared singleton EventSource — all useSSE callers share one connection
// ---------------------------------------------------------------------------

const RECONNECT_DELAY_MS = 3000;

type Listener = (data: unknown) => void;
type ConnectionListener = (connected: boolean) => void;

let sharedES: EventSource | null = null;
const listeners = new Set<Listener>();
const connectionListeners = new Set<ConnectionListener>();
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

function ensureConnection() {
  if (sharedES) return;

  const es = new EventSource("/api/notifications/stream");

  es.onopen = () => {
    connectionListeners.forEach((fn) => fn(true));
  };

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
    connectionListeners.forEach((fn) => fn(false));
    // Reconnect only if there are still active listeners
    if (listeners.size > 0) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(ensureConnection, RECONNECT_DELAY_MS);
    }
  };

  sharedES = es;
}

function subscribe(
  listener: Listener,
  options?: { onConnectionChange?: ConnectionListener },
): () => void {
  listeners.add(listener);
  if (options?.onConnectionChange) {
    connectionListeners.add(options.onConnectionChange);
    if (sharedES?.readyState === EventSource.OPEN) {
      options.onConnectionChange(true);
    }
  }
  ensureConnection();

  return () => {
    listeners.delete(listener);
    if (options?.onConnectionChange) {
      connectionListeners.delete(options.onConnectionChange);
    }
    // Close connection when no listeners remain
    if (listeners.size === 0) {
      clearTimeout(reconnectTimer);
      sharedES?.close();
      sharedES = null;
    }
  };
}

export function subscribeToSSE(
  listener: Listener,
  options?: { onConnectionChange?: ConnectionListener },
): () => void {
  return subscribe(listener, options);
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
      if (
        typeof data === "object" &&
        data !== null &&
        typeof (data as { type?: unknown }).type === "string" &&
        (data as { type: string }).type === eventType
      ) {
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
