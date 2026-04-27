"use client";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface Props {
  enabled: boolean;
  rate: number;
  taxableCount: number;
  onEnabledChange: (v: boolean) => void;
  onRateChange: (v: number) => void;
}

export function TaxCard({ enabled, rate, taxableCount, onEnabledChange, onRateChange }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Sales tax</p>
          <p className="text-[12px] text-muted-foreground">Per-item taxable toggle</p>
        </div>
        <Switch aria-label="Tax" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <div className="flex items-center gap-3">
          <Input type="number" step="0.0001" min={0} max={1} value={rate} onChange={(e) => onRateChange(Number(e.target.value))} className="font-mono w-28" />
          <p className="text-[11.5px] text-muted-foreground">{(rate * 100).toFixed(2)}% · {taxableCount} taxable</p>
        </div>
      )}
    </div>
  );
}
