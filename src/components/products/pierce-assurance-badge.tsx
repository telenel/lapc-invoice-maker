"use client";

import { useEffect, useState } from "react";
import { productApi, type SyncRun } from "@/domains/product/api-client";

interface Props {
  onClick: () => void;
}

export function PierceAssuranceBadge({ onClick }: Props) {
  const [latest, setLatest] = useState<SyncRun | null>(null);
  const [unknown, setUnknown] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      productApi.getSyncRuns()
        .then((r) => {
          if (cancelled) return;
          setLatest(r.runs[0] ?? null);
          setUnknown(false);
        })
        .catch(() => {
          if (!cancelled) setUnknown(true);
        });
    };

    tick();
    const interval = window.setInterval(tick, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const fresh = Boolean(
    latest &&
      latest.status === "ok" &&
      latest.completedAt &&
      Date.now() - new Date(latest.completedAt).getTime() < 24 * 60 * 60 * 1000,
  );
  const dotClass = fresh ? "bg-emerald-500" : "bg-amber-500";
  const srText = unknown
    ? "Pierce catalog sync status unknown."
    : fresh
      ? `Pierce catalog in sync, last checked ${latest?.completedAt ? new Date(latest.completedAt).toLocaleString() : "unknown"}.`
      : `Pierce catalog sync needs attention. Last status: ${latest?.status ?? "no runs yet"}.`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="status"
      aria-live="polite"
      title={unknown ? "Couldn\u2019t read sync status" : srText}
    >
      <span className={`h-2 w-2 rounded-full motion-safe:animate-pulse ${dotClass}`} aria-hidden />
      <span>Pierce</span>
      <span className="sr-only">{srText}</span>
    </button>
  );
}
