"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "laportal-dashboard-order";

function areOrdersEqual(left: string[], right: string[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseStoredOrder(
  value: unknown,
  defaultOrder: string[],
): string[] {
  if (!Array.isArray(value)) {
    return defaultOrder;
  }

  const parsed = value.filter((item): item is string => typeof item === "string");
  const defaultSet = new Set(defaultOrder);
  const storedSet = new Set(parsed);

  if (
    parsed.length !== defaultOrder.length ||
    !parsed.every((id) => defaultSet.has(id))
  ) {
    const valid = parsed.filter((id) => defaultSet.has(id));
    const missing = defaultOrder.filter((id) => !storedSet.has(id));
    return [...valid, ...missing];
  }

  return parsed;
}

function readLocalOrder(defaultOrder: string[]) {
  if (typeof window === "undefined") {
    return defaultOrder;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultOrder;
    }

    return parseStoredOrder(JSON.parse(raw), defaultOrder);
  } catch {
    return defaultOrder;
  }
}

export function useDashboardOrder(defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(() => readLocalOrder(defaultOrder));
  const [loaded, setLoaded] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const clientOrderVersionRef = useRef(0);

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      if (!event.newValue) {
        clientOrderVersionRef.current += 1;
        setOrder(defaultOrder);
        return;
      }

      try {
        const nextOrder = parseStoredOrder(JSON.parse(event.newValue), defaultOrder);
        clientOrderVersionRef.current += 1;
        setOrder((currentOrder) =>
          areOrdersEqual(currentOrder, nextOrder) ? currentOrder : nextOrder,
        );
      } catch {
        setOrder(defaultOrder);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [defaultOrder]);

  useEffect(() => {
    let cancelled = false;
    const requestVersion = clientOrderVersionRef.current;

    void import("@/domains/user-preference/api-client")
      .then(({ userPreferenceApi }) => userPreferenceApi.get<string[]>(STORAGE_KEY))
      .then((stored) => {
        if (cancelled || !stored || clientOrderVersionRef.current !== requestVersion) {
          return;
        }

        const nextOrder = parseStoredOrder(stored.value, defaultOrder);
        setOrder((currentOrder) => {
          if (clientOrderVersionRef.current !== requestVersion) {
            return currentOrder;
          }

          if (areOrdersEqual(currentOrder, nextOrder)) {
            return currentOrder;
          }

          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextOrder));
          } catch {}

          return nextOrder;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [defaultOrder]);

  const persistLocally = useCallback((nextOrder: string[]) => {
    clientOrderVersionRef.current += 1;
    setOrder(nextOrder);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextOrder));
    } catch {}
  }, []);

  const setPersistedOrder = useCallback((nextOrder: string[]) => {
    persistLocally(nextOrder);
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void import("@/domains/user-preference/api-client")
        .then(({ userPreferenceApi }) => userPreferenceApi.save(STORAGE_KEY, nextOrder))
        .catch(() => {});
    }, 250);
  }, [persistLocally]);

  const clearPersistedOrder = useCallback(() => {
    clientOrderVersionRef.current += 1;
    setOrder(defaultOrder);

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}

    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void import("@/domains/user-preference/api-client")
        .then(({ userPreferenceApi }) => userPreferenceApi.clear(STORAGE_KEY))
        .catch(() => {});
    }, 250);
  }, [defaultOrder]);

  useEffect(() => {
    return () => {
      clearTimeout(syncTimerRef.current);
    };
  }, []);

  return {
    order,
    loaded,
    setPersistedOrder,
    clearPersistedOrder,
  };
}
