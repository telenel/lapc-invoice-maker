"use client";

import { useCallback, useEffect, useState } from "react";
import { archiveApi } from "./api-client";
import type { ArchiveFilters, ArchiveListResponse } from "./types";

export function useArchive(filters: ArchiveFilters = {}) {
  const [data, setData] = useState<ArchiveListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await archiveApi.list(filters));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
