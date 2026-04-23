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
import { productApi } from "@/domains/product/api-client";

interface DetailRun {
  id: string;
  createdAt: string;
  operatorDisplay: string;
  selection: Record<string, unknown>;
  transform: Record<string, unknown>;
  affectedSkus: number[];
  skuCount: number;
  pricingDeltaCents: number;
  hadDistrictChanges: boolean;
  summary: string;
}

interface Props {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailDialog({ runId, open, onOpenChange }: Props) {
  const [run, setRun] = useState<DetailRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    productApi.getBulkEditRun(runId).then((r) => { setRun(r as DetailRun); setLoading(false); }).catch(() => setLoading(false));
  }, [runId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk edit detail</DialogTitle>
          <DialogDescription>
            {run ? `${run.operatorDisplay} @ ${new Date(run.createdAt).toLocaleString()}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>
        {loading || !run ? (
          <div role="status" className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>{run.summary}</p>
            <div>
              <div className="font-medium">Affected SKUs ({run.affectedSkus.length})</div>
              <div className="mt-1 max-h-40 overflow-auto rounded border bg-muted/30 p-2 font-mono text-xs">
                {run.affectedSkus.join(", ")}
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-muted-foreground">Raw selection</summary>
              <pre className="mt-1 overflow-auto rounded bg-muted/30 p-2 text-xs">{JSON.stringify(run.selection, null, 2)}</pre>
            </details>
            <details>
              <summary className="cursor-pointer text-muted-foreground">Raw transform</summary>
              <pre className="mt-1 overflow-auto rounded bg-muted/30 p-2 text-xs">{JSON.stringify(run.transform, null, 2)}</pre>
            </details>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
