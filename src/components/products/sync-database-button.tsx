"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { productApi, type SyncPullResult, type SyncRun } from "@/domains/product/api-client";

export function SyncDatabaseButton() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncPullResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"just-synced" | "history">("history");

  useEffect(() => {
    let cancelled = false;
    productApi.getSyncRuns()
      .then((r) => { if (!cancelled) setRuns(r.runs); })
      .catch(() => { /* unauth / unconfigured — silent */ });
    return () => { cancelled = true; };
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await productApi.syncPrismPull();
      setLastResult(result);
      setDialogMode("just-synced");
      setDialogOpen(true);
      const refreshed = await productApi.getSyncRuns();
      setRuns(refreshed.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  function openHistory() {
    setDialogMode("history");
    setDialogOpen(true);
  }

  const latest = runs[0] ?? null;
  const lastSyncLabel = latest?.completedAt
    ? `Last synced ${relativeTime(new Date(latest.completedAt))}`
    : latest
    ? `Last attempt ${relativeTime(new Date(latest.startedAt))}`
    : "Never synced";

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync Database"}
        </Button>
        <div className="flex flex-col items-start text-xs tabular-nums leading-tight text-muted-foreground">
          <span>{lastSyncLabel}</span>
          {runs.length > 0 ? (
            <button
              type="button"
              onClick={openHistory}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              History
            </button>
          ) : null}
        </div>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>

      <SyncResultsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        lastResult={lastResult}
        runs={runs}
      />
    </>
  );
}

function SyncResultsDialog({
  open,
  onOpenChange,
  mode,
  lastResult,
  runs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "just-synced" | "history";
  lastResult: SyncPullResult | null;
  runs: SyncRun[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "just-synced" ? "Sync complete" : "Sync history"}
          </DialogTitle>
          <DialogDescription>
            {mode === "just-synced"
              ? "The Supabase mirror has been refreshed from WinPRISM. Here's what changed."
              : "Most recent Prism pull-sync runs."}
          </DialogDescription>
        </DialogHeader>

        {mode === "just-synced" && lastResult ? (
          <div className="grid grid-cols-4 gap-3 py-2">
            <Stat label="Scanned" value={lastResult.scanned} />
            <Stat label="Updated" value={lastResult.updated} accent={lastResult.updated > 0} />
            <Stat label="Removed" value={lastResult.removed} accent={lastResult.removed > 0} />
            <Stat label="Duration" value={formatDuration(lastResult.durationMs)} />
          </div>
        ) : null}

        <div className="max-h-80 overflow-y-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 text-right font-medium">Scanned</th>
                <th className="px-3 py-2 text-right font-medium">Updated</th>
                <th className="px-3 py-2 text-right font-medium">Removed</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                    No sync runs yet.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 truncate">{formatTriggeredBy(r.triggeredBy)}</td>
                    <td className="px-3 py-2 text-right">{r.scannedCount?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.updatedCount?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.removedCount?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} error={r.error} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "ok") {
    return <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-800">ok</span>;
  }
  if (status === "failed") {
    return (
      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-800" title={error ?? undefined}>
        failed
      </span>
    );
  }
  return <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{status}</span>;
}

function formatTriggeredBy(s: string): string {
  if (s === "scheduled") return "cron";
  if (s.startsWith("manual:")) return "manual";
  return s;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSec = Math.floor(seconds % 60);
  return `${minutes}m ${remSec}s`;
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
