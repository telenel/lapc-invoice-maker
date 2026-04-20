"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { AlertTriangleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PrismWriteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  warnings: string[];
  confirmPhrase: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  confirming?: boolean;
  confirmDisabled?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}

export function PrismWriteConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  warnings,
  confirmPhrase,
  confirmLabel,
  onConfirm,
  confirming = false,
  confirmDisabled = false,
  destructive = true,
  children,
}: PrismWriteConfirmationDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const checkboxId = useId();
  const phraseId = useId();

  useEffect(() => {
    if (open) return;
    setAcknowledged(false);
    setTypedPhrase("");
  }, [open]);

  const normalizedPhrase = confirmPhrase.trim().toUpperCase();
  const canConfirm =
    acknowledged &&
    typedPhrase.trim().toUpperCase() === normalizedPhrase &&
    !confirming &&
    !confirmDisabled;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setAcknowledged(false);
      setTypedPhrase("");
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    await onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children ? <div className="space-y-4">{children}</div> : null}

        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
            <div className="space-y-2">
              <p className="font-semibold">
                Live write: this will change Prism and the POS database.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-rose-900/90 dark:text-rose-100/90">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label
            htmlFor={checkboxId}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2 text-sm"
          >
            <Checkbox
              id={checkboxId}
              checked={acknowledged}
              onCheckedChange={(value) => setAcknowledged(value === true)}
              disabled={confirming}
              className="mt-0.5"
            />
            <span className="leading-5">
              I understand this is a live Prism/POS write and I am explicitly approving it.
            </span>
          </label>

          <div className="space-y-1.5">
            <label htmlFor={phraseId} className="text-sm font-medium">
              Type <span className="font-mono">{normalizedPhrase}</span> to continue
            </label>
            <Input
              id={phraseId}
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={confirming}
              placeholder={normalizedPhrase}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(!destructive && "border border-foreground/10")}
          >
            {confirming ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
