"use client";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface Props {
  enabled: boolean;
  percent: number;
  onEnabledChange: (v: boolean) => void;
  onPercentChange: (v: number) => void;
}

export function MarginCard({ enabled, percent, onEnabledChange, onPercentChange }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Margin</p>
          <p className="text-[12px] text-muted-foreground">Markup over cost</p>
        </div>
        <Switch aria-label="Margin" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <>
          <div className="flex items-center gap-3">
            <Slider min={0} max={60} step={1} value={[percent]} onValueChange={(v) => onPercentChange((v as readonly number[])[0])} aria-label="Margin percent" />
            <span className="tabular-nums text-sm font-bold w-12 text-right">{percent}%</span>
          </div>
          <p className="text-[11.5px] text-muted-foreground">Cost prices stay internal; charged price updates automatically.</p>
          {percent === 0 && <p className="text-[11.5px] text-warn">Set a margin above 0% for it to take effect</p>}
        </>
      )}
    </div>
  );
}
