"use client";

import { Button } from "@/components/ui/button";

interface Props {
  primaryLabel: string;
  primaryDisabled: boolean;
  grandTotal: number;
  onPrimaryAction: () => void;
  onOpenSummary: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function BottomActionBar({
  primaryLabel,
  primaryDisabled,
  grandTotal,
  onPrimaryAction,
  onOpenSummary,
}: Props) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-2 flex items-center gap-3">
      <button
        type="button"
        onClick={onOpenSummary}
        className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Open summary
      </button>
      <span className="ml-auto tabular-nums font-bold text-sm">{fmt(grandTotal)}</span>
      <Button onClick={onPrimaryAction} disabled={primaryDisabled} size="sm">
        {primaryLabel}
      </Button>
    </div>
  );
}
