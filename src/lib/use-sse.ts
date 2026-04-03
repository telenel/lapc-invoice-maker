"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseRealtimeContext, invalidateSupabaseRealtimeToken } from "./supabase/browser";
import {
  GLOBAL_REALTIME_TOPIC,
  REALTIME_BROADCAST_EVENT,
  getUserRealtimeTopic,
} from "./realtime-topics";

type Listener = (data: unknown) => void;
type ConnectionListener = (connected: boolean) => void;

const listeners = new Set<Listener>();
const connectionListeners = new Set<ConnectionListener>();
let setupPromise: Promise<void> | null = null;
let activeCleanup: (() => Promise<void>) | null = null;
let isConnected = false;

function notifyConnection(connected: boolean) {
  isConnected = connected;
  connectionListeners.forEach((fn) => fn(connected));
}

function dispatch(data: unknown) {
  listeners.forEach((fn) => fn(data));
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

  setupPromise = (async () => {
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
            notifyConnection(true);
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
            if (subscribedTopics.size === 0) {
              notifyConnection(false);
            }
          }
        });
      });

      activeCleanup = async () => {
        await Promise.all(channels.map((channel) => client.removeChannel(channel)));
        activeCleanup = null;
        notifyConnection(false);
      };
    } catch {
      notifyConnection(false);
    } finally {
      setupPromise = null;
    }
  })();

  await setupPromise;
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
  void ensureConnection();

  return () => {
    listeners.delete(listener);
    if (options?.onConnectionChange) {
      connectionListeners.delete(options.onConnectionChange);
    }

    if (listeners.size === 0) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      if (cleanup) {
        void cleanup();
      } else {
        notifyConnection(false);
      }
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
