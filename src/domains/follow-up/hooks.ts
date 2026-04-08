"use client";

import { useCallback, useEffect, useState } from "react";
import { followUpApi } from "./api-client";
import type { FollowUpBadgeState } from "./types";

export function useFollowUpBadge(invoiceId: string | null) {
  const [badge, setBadge] = useState<FollowUpBadgeState | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const state = await followUpApi.getBadgeState(invoiceId);
      setBadge(state);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { badge, loading, refresh };
}
