"use client";

import { useEffect, useRef } from "react";

function getEventTypesKey(eventTypes: readonly string[]) {
  return JSON.stringify(Array.from(new Set(eventTypes)).sort());
}

export function useDeferredDashboardRealtime(
  eventTypes: readonly string[],
  callback: () => void,
  {
    delayMs = 5000,
    debounceMs = 500,
    enabled = true,
  }: {
    delayMs?: number;
    debounceMs?: number;
    enabled?: boolean;
  } = {},
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const eventTypesKey = getEventTypesKey(eventTypes);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const eventTypeSet = new Set<string>(JSON.parse(eventTypesKey) as string[]);
    let cancelled = false;
    let initialized = false;
    let unsubscribe: (() => void) | null = null;
    let timer: number | undefined;

    function scheduleRefresh() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        callbackRef.current();
      }, debounceMs);
    }

    function setupRealtime() {
      if (cancelled || initialized) {
        return;
      }

      initialized = true;

      void import("@/lib/use-sse").then(({ subscribeToSSE }) => {
        if (cancelled) {
          return;
        }

        const listener = (data: unknown) => {
          if (
            typeof data !== "object" ||
            data === null ||
            typeof (data as { type?: unknown }).type !== "string"
          ) {
            return;
          }

          if (!eventTypeSet.has((data as { type: string }).type)) {
            return;
          }

          scheduleRefresh();
        };

        unsubscribe = subscribeToSSE(listener, {
          onConnectionChange(connected) {
            if (connected) {
              scheduleRefresh();
            }
          },
        });
      });
    }

    const fallbackTimer = window.setTimeout(setupRealtime, delayMs);
    window.addEventListener("pointerdown", setupRealtime, { once: true, passive: true });
    window.addEventListener("keydown", setupRealtime, { once: true });
    window.addEventListener("focusin", setupRealtime, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(timer);
      unsubscribe?.();
      window.removeEventListener("pointerdown", setupRealtime);
      window.removeEventListener("keydown", setupRealtime);
      window.removeEventListener("focusin", setupRealtime);
    };
  }, [debounceMs, delayMs, enabled, eventTypesKey]);
}
