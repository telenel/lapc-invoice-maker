"use client";

import { CheckIcon, AlertTriangleIcon, RefreshCwIcon, PrinterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ComposerTotals, DocType } from "../types";

interface Props {
  readiness: number;       // 0..1
  blockerCount: number;
  docType: DocType;
  totals: ComposerTotals;
  marginEnabled: boolean;
  taxEnabled: boolean;
  taxRate: number;
  accountNumber: string;
  department: string;
  saving: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
  onJumpToBlockers: () => void;
  onJumpToAccount: () => void;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function ReadinessCard(p: Props) {
  const pct = Math.round(p.readiness * 100);
  const isReady = p.readiness === 1 && p.blockerCount === 0;
  const tone =
    p.blockerCount > 0 ? { text: "text-warn",     statusLabel: `${p.blockerCount} blocker(s)` } :
    isReady             ? { text: "text-positive", statusLabel: "Ready" } :
                          { text: "text-primary",  statusLabel: `${pct}%` };

  const totalLabel = p.docType === "invoice" ? "INVOICE TOTAL" : "QUOTED TOTAL";
  const accountOk = !!p.accountNumber && !!p.department;
  const primaryLabel = p.docType === "invoice" ? "Generate PDF" : "Save Quote & Generate PDF";

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-rail space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Readiness</p>
        <p className={cn("text-[12.5px] font-semibold", tone.text)}>{tone.statusLabel}</p>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all duration-240", isReady ? "bg-positive" : p.blockerCount ? "bg-warn" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>

      <div className="border-t border-dashed border-border pt-2 space-y-1 text-[12.5px]">
        <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Subtotal · {p.totals.itemCount} items</span><span className="tabular-nums">{fmt(p.totals.subtotal)}</span></div>
        {p.marginEnabled && <div className="flex items-baseline justify-between text-positive"><span>Margin</span><span className="tabular-nums">+{fmt(p.totals.marginAmount)}</span></div>}
        {p.taxEnabled && <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Sales tax · {(p.taxRate * 100).toFixed(2)}% · {p.totals.taxableCount} taxable</span><span className="tabular-nums">{fmt(p.totals.taxAmount)}</span></div>}
        <div className="flex items-baseline justify-between border-t border-border pt-1.5 mt-1.5 font-bold">
          <span className="text-[10.5px] font-mono uppercase tracking-wider">{totalLabel}</span>
          <span className="text-[22px] tabular-nums">{fmt(p.totals.grandTotal)}</span>
        </div>
      </div>

      <button type="button"
        onClick={accountOk ? undefined : p.onJumpToAccount}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border p-2 text-[12px] text-left",
          accountOk ? "bg-positive-bg border-positive-border text-positive" : "bg-warn-bg border-warn-border text-warn"
        )}
      >
        {accountOk ? <CheckIcon className="size-3.5" /> : <AlertTriangleIcon className="size-3.5" />}
        <span className="flex-1">
          {accountOk ? <>Charging <span className="font-mono">{p.accountNumber} · {p.department}</span></> : "Account number missing"}
        </span>
      </button>

      <Button onClick={p.onPrimaryAction} disabled={p.primaryDisabled} className="w-full justify-center">
        {p.saving ? <><RefreshCwIcon className="size-3.5 mr-1.5 animate-spin" /> Saving…</> : primaryLabel}
      </Button>
      {p.primaryDisabled && p.blockerCount > 0 && (
        <button type="button" onClick={p.onJumpToBlockers} className="w-full text-center text-[12.5px] text-destructive hover:underline">
          Resolve {p.blockerCount} blocker(s) below to continue
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={p.onSaveDraft} disabled={!p.canSaveDraft}>Save Draft</Button>
        <Button variant="outline" onClick={p.onPrintRegister}>
          <PrinterIcon className="size-3.5 mr-1.5" /> Print Register
        </Button>
      </div>
      {!p.canSaveDraft && <p className="text-[11.5px] text-muted-foreground -mt-1">Fill department, date, requestor, and one valid item to save</p>}
    </div>
  );
}
