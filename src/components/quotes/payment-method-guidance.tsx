"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getQuotePaymentMethodGuidance } from "@/domains/quote/payment";
import { cn } from "@/lib/utils";

export function PaymentMethodGuidanceCallout({
  method,
  className,
}: {
  method: string | null;
  className?: string;
}) {
  const guidance = getQuotePaymentMethodGuidance(method);
  if (!guidance) return null;

  return (
    <div className={cn("rounded-lg border bg-muted/40 p-3 text-sm", className)}>
      <p className="font-medium text-foreground">{guidance.description}</p>
      <div className="mt-3 border-l border-border pl-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {guidance.calloutTitle}
        </p>
        <address className="mt-2 not-italic text-sm text-muted-foreground">
          {guidance.calloutLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </address>
      </div>
    </div>
  );
}

export function PaymentMethodGuidanceDialog({
  method,
  open,
  onOpenChange,
}: {
  method: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const guidance = getQuotePaymentMethodGuidance(method);
  if (!guidance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{guidance.title}</DialogTitle>
          <DialogDescription>{guidance.description}</DialogDescription>
        </DialogHeader>
        <PaymentMethodGuidanceCallout method={method} />
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
