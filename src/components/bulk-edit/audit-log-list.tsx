"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { productApi } from "@/domains/product/api-client";
import { AuditLogDetailDialog } from "./audit-log-detail-dialog";

interface RunSummary {
  id: string;
  createdAt: string;
  operatorDisplay: string;
  skuCount: number;
  pricingDeltaCents: number;
  hadDistrictChanges: boolean;
  summary: string;
}

export function AuditLogList() {
  const [items, setItems] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { items } = await productApi.listBulkEditRuns({ limit: 20 });
      setItems(items as RunSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section aria-labelledby="audit-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="audit-heading" className="text-base font-semibold">Recent bulk edits</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : null}
      <ul className="divide-y rounded border">
        {items.length === 0 && !loading ? (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">No bulk edits yet.</li>
        ) : null}
        {items.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <div>
              <span className="tabular-nums text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
              {" "}&bull;{" "}
              <span className="font-medium">{r.operatorDisplay}</span>
              {" "}&bull;{" "}
              <span className="tabular-nums">{r.skuCount} items</span>
              {r.hadDistrictChanges ? <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">district</span> : null}
              <div className="text-xs text-muted-foreground">{r.summary}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>Detail</Button>
          </li>
        ))}
      </ul>
      {detailId ? (
        <AuditLogDetailDialog
          runId={detailId}
          open={detailId !== null}
          onOpenChange={(open) => !open && setDetailId(null)}
        />
      ) : null}
    </section>
  );
}
