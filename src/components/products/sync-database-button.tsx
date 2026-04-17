"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { productApi } from "@/domains/product/api-client";

export function SyncDatabaseButton() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate from localStorage for MVP. The button updates this on success.
    const stored = localStorage.getItem("laportal.lastPrismSync");
    setLastSync(stored);
  }, []);

  async function handleClick() {
    setSyncing(true);
    setError(null);
    try {
      const result = await productApi.syncPrismPull();
      const now = new Date().toISOString();
      localStorage.setItem("laportal.lastPrismSync", now);
      setLastSync(now);
      console.log(`Sync complete: ${result.scanned} scanned, ${result.updated} updated in ${result.durationMs}ms`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  const lastSyncLabel = lastSync
    ? `Last synced ${relativeTime(new Date(lastSync))}`
    : "Never synced";

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync Database"}
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground">
        {lastSyncLabel}
      </span>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
