"use client";

import { useEffect, useRef, useCallback } from "react";

const SAVE_INTERVAL = 30_000; // 30 seconds
const EXPIRY_DAYS = 7;

function getDraftKey(userId: string, routeKey: string): string {
  return `draft:${userId}:${routeKey}`;
}

export function useAutoSave<T>(formState: T, routeKey: string, userId: string | null) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const formStateRef = useRef(formState);
  const initialStateRef = useRef(formState);
  const isDirtyRef = useRef(false);
  formStateRef.current = formState;

  // Detect dirty state by comparing current to initial
  if (!isDirtyRef.current && JSON.stringify(formState) !== JSON.stringify(initialStateRef.current)) {
    isDirtyRef.current = true;
  }

  const stableUserId = userId && userId !== "anonymous" ? userId : null;
  const key = stableUserId ? getDraftKey(stableUserId, routeKey) : null;

  useEffect(() => {
    if (!key) return;
    timerRef.current = setInterval(() => {
      if (!isDirtyRef.current) return; // Don't save until user actually edits
      try {
        const entry = { data: formStateRef.current, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(entry));
      } catch {
        // localStorage full or unavailable
      }
    }, SAVE_INTERVAL);

    return () => clearInterval(timerRef.current);
  }, [key]);

  const clearDraft = useCallback(() => {
    if (key) localStorage.removeItem(key);
    isDirtyRef.current = false;
  }, [key]);

  return { clearDraft };
}

export function loadDraft<T>(
  routeKey: string,
  userId: string,
): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(getDraftKey(userId, routeKey));
    if (!raw) return null;
    const entry = JSON.parse(raw) as { data: T; savedAt: number };
    if (Date.now() - entry.savedAt > EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getDraftKey(userId, routeKey));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
