"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/domains/admin/api-client";

interface DbHealthData {
  status: "connected" | "error";
  message?: string;
  timestamp: string;
  dbSize?: string | null;
  tables?: Record<string, number>;
  platform?: {
    supabase: {
      runtimePublicEnv: boolean;
      runtimeAdminEnv: boolean;
      buildPublicEnv: {
        supabaseUrlConfigured: boolean;
        supabaseAnonKeyConfigured: boolean;
      };
    };
    scheduler: {
      configuredMode: "app" | "supabase";
      activeMode: "app" | "supabase";
      confirmed: boolean;
      cronSecretConfigured: boolean;
    };
    storage: {
      legacyFilesystemFallbackEnabled: boolean;
      invoicePdfPaths: number;
      prismcorePaths: number;
      printQuotePdfPaths: number;
      totalLegacyReferences: number;
    };
  };
  jobs?: {
    summaries: Array<{
      jobKey: string;
      activeSchedulerMode: "app" | "supabase";
      configuredSchedulerMode: "app" | "supabase";
      lastStatus: string | null;
      lastStartedAt: string | null;
      lastFinishedAt: string | null;
      lastDurationMs: number | null;
      lastRunner: string | null;
    }>;
    recentRuns: Array<{
      id: string;
      jobKey: string;
      schedulerMode: string;
      runner: string | null;
      status: string;
      startedAt: string;
      finishedAt: string | null;
      durationMs: number | null;
      details: unknown;
    }>;
  };
}

const TABLE_LABELS: Record<string, string> = {
  users: "Users",
  staff: "Staff",
  invoices: "Invoices",
  invoiceItems: "Invoice Items",
  categories: "Categories",
  quickPickItems: "Quick Pick Items",
  staffAccountNumbers: "Account Numbers",
  staffSignerHistory: "Signer History",
  savedLineItems: "Saved Line Items",
  rateLimitEvents: "Rate Limit Events",
  jobRuns: "Job Runs",
};

export function DbHealth() {
  const [data, setData] = useState<DbHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminApi.getDbHealth();
      setData(json as DbHealthData);
      if (json.status === "error" && "message" in json) {
        setError(json.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const isConnected = data?.status === "connected";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Database Health</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <span
          className={`inline-block size-3 rounded-full ${
            loading
              ? "bg-yellow-400 animate-pulse"
              : isConnected
                ? "bg-green-500"
                : "bg-red-500"
          }`}
        />
        <div>
          <p className="text-sm font-medium">
            {loading
              ? "Checking connection..."
              : isConnected
                ? "Connected"
                : "Connection Error"}
          </p>
          {error && (
            <p className="text-xs text-destructive mt-0.5">{error}</p>
          )}
          {data?.timestamp && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last checked: {new Date(data.timestamp).toLocaleString("en-US")}
            </p>
          )}
        </div>
        {data?.dbSize && (
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Database Size</p>
            <p className="text-sm font-medium">{data.dbSize}</p>
          </div>
        )}
      </div>

      {/* Table Row Counts */}
      {data?.platform && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold">Supabase Platform</h4>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Build public env</span>
                <span className="font-medium">
                  {data.platform.supabase.buildPublicEnv.supabaseUrlConfigured &&
                  data.platform.supabase.buildPublicEnv.supabaseAnonKeyConfigured
                    ? "Configured"
                    : "Missing"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Runtime public env</span>
                <span className="font-medium">
                  {data.platform.supabase.runtimePublicEnv ? "Configured" : "Missing"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Runtime admin env</span>
                <span className="font-medium">
                  {data.platform.supabase.runtimeAdminEnv ? "Configured" : "Missing"}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold">Scheduler</h4>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Configured mode</span>
                <span className="font-medium uppercase">
                  {data.platform.scheduler.configuredMode}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Active mode</span>
                <span className="font-medium uppercase">
                  {data.platform.scheduler.activeMode}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Confirmed</span>
                <span className="font-medium">
                  {data.platform.scheduler.confirmed ? "Yes" : "No"}
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">CRON_SECRET</span>
                <span className="font-medium">
                  {data.platform.scheduler.cronSecretConfigured ? "Configured" : "Missing"}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {data?.platform?.storage && (
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-semibold">Storage Audit</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Legacy refs</p>
              <p className="text-lg font-semibold tabular-nums">
                {data.platform.storage.totalLegacyReferences.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice PDFs</p>
              <p className="text-lg font-semibold tabular-nums">
                {data.platform.storage.invoicePdfPaths.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PrismCore uploads</p>
              <p className="text-lg font-semibold tabular-nums">
                {data.platform.storage.prismcorePaths.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Print quote PDFs</p>
              <p className="text-lg font-semibold tabular-nums">
                {data.platform.storage.printQuotePdfPaths.toLocaleString("en-US")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Legacy fallback</p>
              <p className="text-sm font-semibold">
                {data.platform.storage.legacyFilesystemFallbackEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
          </div>
        </div>
      )}

      {data?.jobs && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold">Job Health</h4>
            <div className="mt-3 space-y-3">
              {data.jobs.summaries.map((job) => (
                <div key={job.jobKey} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{job.jobKey}</p>
                    <p className="text-xs uppercase text-muted-foreground">
                      {job.lastStatus ?? "never"}
                    </p>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    <p>Configured: {job.configuredSchedulerMode}</p>
                    <p>Active: {job.activeSchedulerMode}</p>
                    <p>Runner: {job.lastRunner ?? "n/a"}</p>
                    <p>
                      Last started: {job.lastStartedAt ? new Date(job.lastStartedAt).toLocaleString("en-US") : "never"}
                    </p>
                    <p>
                      Duration: {job.lastDurationMs !== null ? `${job.lastDurationMs} ms` : "n/a"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold">Recent Job Runs</h4>
            <div className="mt-3 space-y-2">
              {data.jobs.recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tracked runs yet.</p>
              ) : (
                data.jobs.recentRuns.map((run) => (
                  <div key={run.id} className="rounded-md border p-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{run.jobKey}</p>
                      <p className="uppercase text-muted-foreground">{run.status}</p>
                    </div>
                    <div className="mt-1 space-y-1 text-muted-foreground">
                      <p>Runner: {run.runner ?? "n/a"}</p>
                      <p>Scheduler: {run.schedulerMode}</p>
                      <p>Started: {new Date(run.startedAt).toLocaleString("en-US")}</p>
                      <p>Duration: {run.durationMs !== null ? `${run.durationMs} ms` : "n/a"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {data?.tables && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(data.tables).map(([key, count]) => (
            <div
              key={key}
              className="rounded-lg border p-3 text-center"
            >
              <p className="text-2xl font-bold tabular-nums">
                {count.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {TABLE_LABELS[key] || key}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
