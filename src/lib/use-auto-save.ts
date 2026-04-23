"use client";

import { useEffect, useRef, useCallback } from "react";
import { userDraftApi } from "@/domains/user-draft/api-client";

const SAVE_INTERVAL = 30_000; // 30 seconds
export const CREATE_PAGE_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function getStableUserId(userId: string | null | undefined): string | null {
  if (!userId || userId === "anonymous") {
    return null;
  }

  return userId;
}

export function useAutoSave<T>(formState: T, routeKey: string, userId: string | null) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const formStateRef = useRef(formState);
  const initialStateRef = useRef(formState);
  const isDirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  formStateRef.current = formState;

  // Detect dirty state by comparing current to initial
  if (!isDirtyRef.current && JSON.stringify(formState) !== JSON.stringify(initialStateRef.current)) {
    isDirtyRef.current = true;
  }

  const stableUserId = getStableUserId(userId);

  useEffect(() => {
    if (!stableUserId) return;

    timerRef.current = setInterval(() => {
      if (!isDirtyRef.current || saveInFlightRef.current) return;

      saveInFlightRef.current = true;
      void userDraftApi.save(routeKey, formStateRef.current).finally(() => {
        saveInFlightRef.current = false;
      });
    }, SAVE_INTERVAL);

    return () => {
      clearInterval(timerRef.current);
      saveInFlightRef.current = false;
    };
  }, [routeKey, stableUserId]);

  const clearDraft = useCallback(async () => {
    initialStateRef.current = formStateRef.current;
    isDirtyRef.current = false;
    if (!stableUserId) {
      return;
    }

    await userDraftApi.clear(routeKey).catch(() => {
      // Draft clearing is non-critical after a successful save/discard.
    });
  }, [routeKey, stableUserId]);

  return { clearDraft };
}

export async function loadDraft<T>(
  routeKey: string,
  userId: string,
  options: { maxAgeMs?: number | null } = {},
): Promise<{ data: T; savedAt: number } | null> {
  if (!getStableUserId(userId)) {
    return null;
  }

  try {
    const entry = await userDraftApi.get<T>(routeKey);
    if (!entry) {
      return null;
    }

    const savedAt = new Date(entry.savedAt).getTime();
    const maxAgeMs = options.maxAgeMs ?? null;
    if (maxAgeMs != null && Date.now() - savedAt > maxAgeMs) {
      await userDraftApi.clear(routeKey).catch(() => {});
      return null;
    }

    return {
      data: entry.data,
      savedAt,
    };
  } catch {
    return null;
  }
}
