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

interface RequestAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  recipientName: string;
  recipientEmail: string;
  onSuccess?: () => void;
}

export function RequestAccountDialog({
  open,
  onOpenChange,
  invoiceId,
  recipientName,
  recipientEmail,
  onSuccess,
}: RequestAccountDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await followUpApi.initiate([invoiceId]);
      const item = result.results[0];
      if (item?.status === "success") {
        toast.success("Account number request sent");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(item?.error ?? "Failed to send request");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send request",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Account Number</DialogTitle>
          <DialogDescription>
            A request will be sent now, followed by up to 4 weekly reminders if
            needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-medium">{recipientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{recipientEmail}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
