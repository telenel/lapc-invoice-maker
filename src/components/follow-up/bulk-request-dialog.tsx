"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { followUpApi } from "@/domains/follow-up/api-client";
import type { InitiateFollowUpResult } from "@/domains/follow-up/types";

interface BulkRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceIds: string[];
  onSuccess?: () => void;
}

export function BulkRequestDialog({
  open,
  onOpenChange,
  invoiceIds,
  onSuccess,
}: BulkRequestDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<InitiateFollowUpResult[] | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const response = await followUpApi.initiate(invoiceIds);
      setResults(response.results);
      if (response.summary.failed === 0) {
        toast.success(`${response.summary.succeeded} request(s) sent`);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.warning(
          `${response.summary.succeeded} sent, ${response.summary.failed} failed`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Account Numbers</DialogTitle>
          <DialogDescription>
            Send account number requests for {invoiceIds.length} item(s)?
            Each will receive a request now, followed by up to 4 weekly reminders.
          </DialogDescription>
        </DialogHeader>

        {results && (
          <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
            {results.map((r) => (
              <div key={r.invoiceId} className="flex items-center justify-between">
                <span className="truncate">{r.invoiceId.slice(0, 8)}...</span>
                {r.status === "success" ? (
                  <span className="text-green-600">Sent</span>
                ) : (
                  <span className="text-red-600">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Sending..." : "Send Requests"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
