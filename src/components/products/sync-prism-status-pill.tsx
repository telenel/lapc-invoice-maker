"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  ChevronDownIcon,
  LockIcon,
  RefreshCwIcon,
  UnlockIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  productApi,
  type SyncPullResult,
  type SyncRun,
} from "@/domains/product/api-client";

export interface SyncPrismStatusPillHandle {
  openHistory: () => void;
}

interface Props {
  prismAvailable: boolean;
  onPrismRetry?: () => void;
}

export const SyncPrismStatusPill = forwardRef<SyncPrismStatusPillHandle, Props>(
  function SyncPrismStatusPill({ prismAvailable, onPrismRetry }, ref) {
    const [runs, setRuns] = useState<SyncRun[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<SyncPullResult | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyMode, setHistoryMode] = useState<"just-synced" | "history">("history");
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [unknown, setUnknown] = useState(false);

    useEffect(() => {
      let cancelled = false;
      const tick = () => {
        productApi
          .getSyncRuns()
          .then((r) => {
            if (cancelled) return;
            setRuns(r.runs);
            setUnknown(false);
          })
          .catch(() => {
            if (cancelled) return;
            setUnknown(true);
          });
      };
      tick();
      const interval = window.setInterval(tick, 5 * 60 * 1000);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }, []);

    async function handleSync() {
      setSyncing(true);
      setError(null);
      setLastResult(null);
      try {
        const result = await productApi.syncPrismPull();
        setLastResult(result);
        setHistoryMode("just-synced");
        setHistoryOpen(true);
        setPopoverOpen(false);
        const refreshed = await productApi.getSyncRuns();
        setRuns(refreshed.runs);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSyncing(false);
      }
    }

    function openHistory() {
      setHistoryMode("history");
      setHistoryOpen(true);
      setPopoverOpen(false);
    }

    useImperativeHandle(ref, () => ({ openHistory }), []);

    const latest = runs[0] ?? null;
    const latestOk = latest?.status === "ok";
    const completedAt = latest?.completedAt ? new Date(latest.completedAt) : null;
    const ageMs = completedAt ? Date.now() - completedAt.getTime() : null;
    // Only treat the system as fresh when the most recent run actually
    // succeeded — failed/partial runs still record completedAt, but a green
    // dot would mask that the mirror is out of date.
    const fresh = latestOk && ageMs != null && ageMs < 5 * 60 * 1000;
    const stale = ageMs != null && ageMs >= 24 * 60 * 60 * 1000;
    const syncDotClass = unknown
      ? "bg-muted-foreground/60"
      : syncing
        ? "bg-amber-500 motion-safe:animate-pulse"
        : fresh
          ? "bg-emerald-500"
          : stale
            ? "bg-destructive"
            : "bg-amber-500";
    const syncRelative = unknown
      ? "unknown"
      : syncing
        ? "running"
        : completedAt
          ? formatRelative(completedAt)
          : "never";

    const PrismIcon = prismAvailable ? UnlockIcon : LockIcon;
    const prismLabel = prismAvailable ? "writable" : "read-only";
    const prismToneClass = prismAvailable ? "text-emerald-600" : "text-destructive";

    return (
      <>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={`Sync ${syncRelative} · Prism ${prismLabel}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`size-1.5 rounded-full ${syncDotClass}`}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">Sync</span>
                  <span className="font-mono tnum">{syncRelative}</span>
                </span>
                <span className="h-3 w-px bg-border" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5">
                  <PrismIcon className={`size-3 ${prismToneClass}`} aria-hidden="true" />
                  <span className="text-muted-foreground">Prism</span>
                  <span className={`font-semibold ${prismToneClass}`}>{prismLabel}</span>
                </span>
                <ChevronDownIcon
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            }
          />
          <PopoverContent align="end" className="w-[320px] p-2">
            <div className="px-2 pb-2 pt-1">
              <div className="text-[12px] font-semibold">System status</div>
              <div className="text-[11px] text-muted-foreground">
                Catalog data and write permission for this session.
              </div>
            </div>
            <StatusRow
              icon={<RefreshCwIcon className="size-3" aria-hidden="true" />}
              tone={fresh ? "ok" : "warn"}
              title="Database sync"
              value={
                syncing
                  ? "Running…"
                  : completedAt
                    ? `Last sync ${formatRelative(completedAt)}`
                    : "Never synced"
              }
              detail={
                latest?.status === "failed"
                  ? `Latest run failed${latest.error ? `: ${latest.error}` : "."}`
                  : "Mirror of Prism is updated incrementally every 5 minutes."
              }
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-7 px-2 text-[11px]"
                >
                  <RefreshCwIcon className="mr-1 size-3" aria-hidden="true" />
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
              }
            />
            <StatusRow
              icon={<PrismIcon className="size-3" aria-hidden="true" />}
              tone={prismAvailable ? "ok" : "bad"}
              title="Prism write availability"
              value={
                prismAvailable
                  ? "Writable from this workstation"
                  : "Read-only — Prism unreachable"
              }
              detail={
                prismAvailable
                  ? "New Item, Edit, Bulk Edit, Discontinue, Hard Delete are enabled."
                  : "Write actions are disabled until Prism is reachable from this network."
              }
              action={
                onPrismRetry ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onPrismRetry}
                    className="h-7 px-2 text-[11px]"
                  >
                    Retry
                  </Button>
                ) : null
              }
            />
            {error ? (
              <div className="mx-1 mt-1 rounded-md border border-destructive/30 bg-destructive/[0.05] px-2 py-1.5 text-[11px] text-destructive">
                {error}
              </div>
            ) : null}
            <div className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                onClick={openHistory}
                className="block w-full rounded-md px-2 py-1.5 text-left text-[11.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                View sync history…
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <SyncResultsDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          mode={historyMode}
          lastResult={lastResult}
          runs={runs}
        />
      </>
    );
  },
);

function StatusRow({
  icon,
  tone,
  title,
  value,
  detail,
  action,
}: {
  icon: React.ReactNode;
  tone: "ok" | "warn" | "bad";
  title: string;
  value: string;
  detail: string;
  action?: React.ReactNode;
}) {
  const toneText =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-destructive";
  const toneBg =
    tone === "ok"
      ? "bg-emerald-500/10"
      : tone === "warn"
        ? "bg-amber-500/10"
        : "bg-destructive/10";
  return (
    <div className="m-1 flex items-start gap-2 rounded-md border border-border bg-card p-2">
      <span
        className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded ${toneBg} ${toneText}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11.5px] font-semibold">{title}</span>
          {action}
        </div>
        <div className={`text-[11.5px] font-medium ${toneText}`}>{value}</div>
        <div className="text-[10.5px] leading-snug text-muted-foreground">{detail}</div>
      </div>
    </div>
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
            {mode === "just-synced"
              ? lastResult?.status === "partial"
                ? "Sync partially complete"
                : "Sync complete"
              : "Sync history"}
          </DialogTitle>
          <DialogDescription>
            {mode === "just-synced"
              ? lastResult?.status === "partial"
                ? "The catalog refresh completed, but the transaction analytics stage needs attention."
                : "The Supabase mirror has been refreshed from WinPRISM. Here's what changed."
              : "Most recent Prism pull-sync runs."}
          </DialogDescription>
        </DialogHeader>

        {mode === "just-synced" && lastResult ? (
          <>
            <div className="grid grid-cols-4 gap-3 py-2">
              <Stat label="Scanned" value={lastResult.scanned} />
              <Stat label="Updated" value={lastResult.updated} accent={lastResult.updated > 0} />
              <Stat label="Removed" value={lastResult.removed} accent={lastResult.removed > 0} />
              <Stat label="Catalog time" value={formatDuration(lastResult.durationMs)} />
              <Stat label="Txns +" value={lastResult.txnsAdded} accent={lastResult.txnsAdded > 0} />
              <Stat
                label="Aggs refreshed"
                value={lastResult.aggregatesUpdated}
                accent={lastResult.aggregatesUpdated > 0}
              />
              <Stat label="Txn time" value={formatDuration(lastResult.txnSyncDurationMs)} />
            </div>
            {lastResult.status === "partial" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {lastResult.txnSyncError ??
                  (lastResult.txnSyncSkipped
                    ? `Transaction sync skipped: ${lastResult.txnSyncSkipped}.`
                    : "Transaction analytics did not finish cleanly.")}
              </div>
            ) : null}
          </>
        ) : null}

        <div className="max-h-80 overflow-y-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 text-right font-medium">Scanned</th>
                <th className="px-3 py-2 text-right font-medium">Updated</th>
                <th className="px-3 py-2 text-right font-medium">Txns+</th>
                <th className="px-3 py-2 text-right font-medium">Aggs</th>
                <th className="px-3 py-2 text-right font-medium">Removed</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                    No sync runs yet.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 truncate">{formatTriggeredBy(r.triggeredBy)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.scannedCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.updatedCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.txnsAdded?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.aggregatesUpdated?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.removedCount?.toLocaleString() ?? "—"}
                    </td>
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
  if (status === "partial") {
    return (
      <span
        className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800"
        title={error ?? undefined}
      >
        partial
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-800"
        title={error ?? undefined}
      >
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

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
