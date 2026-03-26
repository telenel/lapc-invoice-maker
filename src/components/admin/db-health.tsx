"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DbHealthData {
  status: "connected" | "error";
  message?: string;
  timestamp: string;
  dbSize: string | null;
  tables: Record<string, number>;
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
      const res = await fetch("/api/admin/db-health");
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || json.error || "Failed to fetch database health");
        setData(json.status ? json : null);
      } else {
        setData(json);
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
          <RefreshCw className={loading ? "animate-spin" : ""} />
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
              Last checked: {new Date(data.timestamp).toLocaleString()}
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
      {data?.tables && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(data.tables).map(([key, count]) => (
            <div
              key={key}
              className="rounded-lg border p-3 text-center"
            >
              <p className="text-2xl font-bold tabular-nums">
                {count.toLocaleString()}
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
