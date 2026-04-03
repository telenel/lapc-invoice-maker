"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { subscribeToSSE } from "@/lib/use-sse";
import { userPreferenceApi } from "./api-client";

type DeserializePreference<T> = (value: unknown) => T;

interface UseUserPreferenceOptions<T> {
  key: string;
  defaultValue: T;
  deserialize?: DeserializePreference<T>;
}

function hasPreferenceEvent(
  data: unknown,
  key: string,
): data is { type: "user-preference-changed"; key: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "user-preference-changed" &&
    (data as { key?: unknown }).key === key
  );
}

export function useUserPreference<T>({
  key,
  defaultValue,
  deserialize,
}: UseUserPreferenceOptions<T>) {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const parse = useMemo<DeserializePreference<T>>(
    () => deserialize ?? ((value) => value as T),
    [deserialize],
  );
  const [value, setValueState] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const fetchPreferenceRef = useRef<(() => Promise<void>) | null>(null);

  const fetchPreference = useCallback(async () => {
    if (!userId) {
      setValueState(defaultValue);
      setLoaded(status !== "loading");
      return;
    }

    try {
      const stored = await userPreferenceApi.get<T>(key);
      if (stored) {
        setValueState(parse(stored.value));
      } else {
        setValueState(defaultValue);
      }
    } catch {
      setValueState(defaultValue);
    } finally {
      setLoaded(true);
    }
  }, [defaultValue, key, parse, status, userId]);

  fetchPreferenceRef.current = fetchPreference;

  useEffect(() => {
    void fetchPreference();
  }, [fetchPreference]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = subscribeToSSE(
      (data) => {
        if (hasPreferenceEvent(data, key)) {
          void fetchPreferenceRef.current?.();
        }
      },
      {
        onConnectionChange(connected) {
          if (connected) {
            void fetchPreferenceRef.current?.();
          }
        },
      },
    );

    return () => {
      unsubscribe();
    };
  }, [key, userId]);

  const setValue = useCallback(
    (nextValue: T) => {
      setValueState(nextValue);
      if (!userId) {
        return;
      }

      void userPreferenceApi.save(key, nextValue).catch(() => {
        void fetchPreferenceRef.current?.();
      });
    },
    [key, userId],
  );

  const clear = useCallback(() => {
    setValueState(defaultValue);
    if (!userId) {
      return;
    }

    void userPreferenceApi.clear(key).catch(() => {
      void fetchPreferenceRef.current?.();
    });
  }, [defaultValue, key, userId]);

  return { value, setValue, clear, loaded };
}
