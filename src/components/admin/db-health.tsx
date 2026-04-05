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
      mode: "app" | "supabase";
      cronSecretConfigured: boolean;
    };
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
                <span className="text-muted-foreground">Mode</span>
                <span className="font-medium uppercase">
                  {data.platform.scheduler.mode}
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
