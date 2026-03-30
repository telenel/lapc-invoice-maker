"use client";

import { useEffect, useRef, useCallback } from "react";

const SAVE_INTERVAL = 30_000; // 30 seconds
const EXPIRY_DAYS = 7;

function getDraftKey(routeKey: string): string {
  return `draft:${routeKey}`;
}

export function useAutoSave<T>(formState: T, routeKey: string) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      try {
        const entry = { data: formState, savedAt: Date.now() };
        localStorage.setItem(getDraftKey(routeKey), JSON.stringify(entry));
      } catch {
        // localStorage full or unavailable
      }
    }, SAVE_INTERVAL);

    return () => clearInterval(timerRef.current);
  }, [formState, routeKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(getDraftKey(routeKey));
  }, [routeKey]);

  return { clearDraft };
}

export function loadDraft<T>(routeKey: string): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(getDraftKey(routeKey));
    if (!raw) return null;
    const entry = JSON.parse(raw) as { data: T; savedAt: number };
    if (Date.now() - entry.savedAt > EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getDraftKey(routeKey));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
