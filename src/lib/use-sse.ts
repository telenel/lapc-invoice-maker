"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseRealtimeContext, invalidateSupabaseRealtimeToken } from "./supabase/browser";
import {
  GLOBAL_REALTIME_TOPIC,
  REALTIME_BROADCAST_EVENT,
  getUserRealtimeTopic,
} from "./realtime-topics";

type Listener = (data: unknown) => void;
type ConnectionListener = (connected: boolean) => void;
type RealtimeStatusListener = (snapshot: RealtimeConnectionSnapshot) => void;

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface RealtimeConnectionSnapshot {
  state: RealtimeConnectionState;
  attempt: number;
  nextRetryAt: number | null;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
}

const listeners = new Set<Listener>();
const connectionListeners = new Set<ConnectionListener>();
const realtimeStatusListeners = new Set<RealtimeStatusListener>();
let setupPromise: Promise<void> | null = null;
let activeCleanup: (() => Promise<void>) | null = null;
let isConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let connectionSnapshot: RealtimeConnectionSnapshot = {
  state: "idle",
  attempt: 0,
  nextRetryAt: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
};

function emitRealtimeStatus(nextSnapshot: RealtimeConnectionSnapshot) {
  const prevSnapshot = connectionSnapshot;
  const changed =
    prevSnapshot.state !== nextSnapshot.state ||
    prevSnapshot.attempt !== nextSnapshot.attempt ||
    prevSnapshot.nextRetryAt !== nextSnapshot.nextRetryAt ||
    prevSnapshot.lastConnectedAt !== nextSnapshot.lastConnectedAt ||
    prevSnapshot.lastDisconnectedAt !== nextSnapshot.lastDisconnectedAt;

  if (!changed) {
    return;
  }

  connectionSnapshot = nextSnapshot;
  realtimeStatusListeners.forEach((listener) => listener(connectionSnapshot));

  if (nextSnapshot.state === "reconnecting") {
    const delayMs = Math.max(0, (nextSnapshot.nextRetryAt ?? Date.now()) - Date.now());
    console.warn(`[realtime] reconnecting in ${delayMs}ms (attempt ${nextSnapshot.attempt})`);
    return;
  }

  if (prevSnapshot.state === nextSnapshot.state) {
    return;
  }

  if (nextSnapshot.state === "connected") {
    console.info("[realtime] connected");
  } else if (nextSnapshot.state === "connecting") {
    console.info("[realtime] connecting");
  } else if (nextSnapshot.state === "disconnected") {
    console.warn("[realtime] disconnected");
  }
}

function updateRealtimeStatus(patch: Partial<RealtimeConnectionSnapshot>) {
  emitRealtimeStatus({
    ...connectionSnapshot,
    ...patch,
  });
}

function notifyConnection(connected: boolean) {
  isConnected = connected;
  connectionListeners.forEach((fn) => fn(connected));
}

function dispatch(data: unknown) {
  listeners.forEach((fn) => fn(data));
}

function resetReconnectState() {
  reconnectAttempt = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function attachPayloadHandler(channel: RealtimeChannel): RealtimeChannel {
  return channel.on(
    "broadcast",
    { event: REALTIME_BROADCAST_EVENT },
    ({ payload }) => {
      dispatch(payload);
    }
  );
}

async function ensureConnection() {
  if (activeCleanup) return;
  if (setupPromise) {
    await setupPromise;
    return;
  }

  updateRealtimeStatus({
    state: reconnectAttempt > 0 ? "reconnecting" : "connecting",
    attempt: reconnectAttempt,
    nextRetryAt: null,
  });

  setupPromise = (async () => {
    let shouldRetry = false;

    try {
      const { client, userId } = await getSupabaseRealtimeContext();
      if (listeners.size === 0) return;

      const channels = [
        attachPayloadHandler(
          client.channel(GLOBAL_REALTIME_TOPIC, { config: { private: true } })
        ),
        attachPayloadHandler(
          client.channel(getUserRealtimeTopic(userId), {
            config: { private: true },
          })
        ),
      ];

      const subscribedTopics = new Set<string>();

      channels.forEach((channel) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            subscribedTopics.add(channel.topic);
            resetReconnectState();
            notifyConnection(true);
            updateRealtimeStatus({
              state: "connected",
              attempt: 0,
              nextRetryAt: null,
              lastConnectedAt: Date.now(),
            });
            return;
          }

          if (
            status === "TIMED_OUT" ||
            status === "CHANNEL_ERROR" ||
            status === "CLOSED"
          ) {
            if (status === "CHANNEL_ERROR") {
              invalidateSupabaseRealtimeToken();
            }
            subscribedTopics.delete(channel.topic);
            const stillConnected = subscribedTopics.size > 0;
            notifyConnection(stillConnected);
            if (!stillConnected) {
              updateRealtimeStatus({
                state: "disconnected",
                nextRetryAt: null,
                lastDisconnectedAt: Date.now(),
              });
            }
            scheduleReconnect();
          }
        });
      });

      activeCleanup = async () => {
        await Promise.all(channels.map((channel) => client.removeChannel(channel)));
        activeCleanup = null;
        notifyConnection(false);
        if (listeners.size === 0) {
          updateRealtimeStatus({
            state: "idle",
            attempt: 0,
            nextRetryAt: null,
          });
        } else {
          updateRealtimeStatus({
            state: "disconnected",
            nextRetryAt: null,
            lastDisconnectedAt: Date.now(),
          });
        }
      };
    } catch {
      notifyConnection(false);
      updateRealtimeStatus({
        state: "disconnected",
        nextRetryAt: null,
        lastDisconnectedAt: Date.now(),
      });
      shouldRetry = listeners.size > 0;
    } finally {
      setupPromise = null;
      if (shouldRetry) {
        scheduleReconnect();
      }
    }
  })();

  await setupPromise;
}

function scheduleReconnect() {
  if (listeners.size === 0 || reconnectTimer || setupPromise) return;

  const delayMs = Math.min(1000 * 2 ** reconnectAttempt, 10_000);
  const nextAttempt = reconnectAttempt + 1;
  reconnectAttempt = nextAttempt;
  updateRealtimeStatus({
    state: "reconnecting",
    attempt: nextAttempt,
    nextRetryAt: Date.now() + delayMs,
    lastDisconnectedAt: connectionSnapshot.lastDisconnectedAt ?? Date.now(),
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    void (async () => {
      const cleanup = activeCleanup;
      activeCleanup = null;
      if (cleanup) {
        await cleanup().catch(() => {});
      } else {
        notifyConnection(false);
      }

      if (listeners.size === 0) return;
      await ensureConnection();
    })();
  }, delayMs);
}

function subscribe(
  listener: Listener,
  options?: { onConnectionChange?: ConnectionListener },
): () => void {
  listeners.add(listener);
  if (options?.onConnectionChange) {
    connectionListeners.add(options.onConnectionChange);
    if (isConnected) {
      options.onConnectionChange(true);
    }
  }
  if (!isConnected && !reconnectTimer && !setupPromise) {
    updateRealtimeStatus({
      state: "connecting",
      attempt: 0,
      nextRetryAt: null,
    });
  }
  void ensureConnection();

  return () => {
    listeners.delete(listener);
    if (options?.onConnectionChange) {
      connectionListeners.delete(options.onConnectionChange);
    }

    if (listeners.size === 0) {
      resetReconnectState();
      const cleanup = activeCleanup;
      activeCleanup = null;
      if (cleanup) {
        void cleanup();
      } else {
        notifyConnection(false);
        updateRealtimeStatus({
          state: "idle",
          attempt: 0,
          nextRetryAt: null,
        });
      }
    }
  };
}

export function getRealtimeConnectionSnapshot(): RealtimeConnectionSnapshot {
  return connectionSnapshot;
}

export function subscribeToRealtimeConnectionStatus(
  listener: RealtimeStatusListener,
): () => void {
  realtimeStatusListeners.add(listener);

  return () => {
    realtimeStatusListeners.delete(listener);
  };
}

export function subscribeToSSE(
  listener: Listener,
  options?: { onConnectionChange?: ConnectionListener },
): () => void {
  return subscribe(listener, options);
}

export function useRealtimeConnectionStatus(): RealtimeConnectionSnapshot {
  return useSyncExternalStore(
    subscribeToRealtimeConnectionStatus,
    getRealtimeConnectionSnapshot,
    getRealtimeConnectionSnapshot,
  );
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
