"use client";

interface MarginBarProps {
  cost: number;
  retail: number;
  showText?: boolean;
}

export function MarginBar({ cost, retail, showText = true }: MarginBarProps) {
  if (!retail || retail <= 0) {
    return (
      <span className="inline-flex items-center gap-2 min-w-[92px] justify-end">
        {showText ? (
          <span className="font-mono text-[11.5px] text-muted-foreground tnum w-[38px] text-right">
            —
          </span>
        ) : null}
        <span className="relative w-[46px] h-1 rounded-sm bg-muted overflow-hidden" />
      </span>
    );
  }

  const raw = (retail - cost) / retail;
  const pct = Math.max(0, Math.min(1, raw));
  const display = (pct * 100).toFixed(1);

  let barColor = "var(--brand-teal)";
  if (pct < 0.25) barColor = "var(--destructive)";
  else if (pct < 0.35) barColor = "var(--chart-4)";

  return (
    <span className="inline-flex items-center gap-2 min-w-[92px] justify-end">
      {showText ? (
        <span className="font-mono text-[11.5px] text-muted-foreground tnum w-[38px] text-right">
          {display}%
        </span>
      ) : null}
      <span className="relative w-[46px] h-1 rounded-sm bg-muted overflow-hidden">
        <span
          className="absolute inset-0 rounded-sm"
          style={{
            right: `${(1 - pct) * 100}%`,
            background: barColor,
          }}
        />
      </span>
    </span>
  );
}
