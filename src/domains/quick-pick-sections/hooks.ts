"use client";

import { useEffect, useState } from "react";
import { quickPickSectionsApi } from "./api-client";
import type { QuickPickSectionDto } from "./types";

export function useQuickPickSections() {
  const [sections, setSections] = useState<QuickPickSectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    quickPickSectionsApi
      .listQuickPickSections()
      .then((items) => {
        if (cancelled) return;
        setSections(items);
        setError(null);
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setSections([]);
        setError(
          nextError instanceof Error
            ? nextError
            : new Error("Failed to load quick pick sections."),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { sections, loading, error };
}
