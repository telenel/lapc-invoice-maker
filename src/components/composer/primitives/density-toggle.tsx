"use client";

import { cn } from "@/lib/utils";
import type { Density } from "../types";

interface Props {
  value: Density;
  onChange: (next: Density) => void;
  className?: string;
}

const OPTIONS: readonly { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "comfortable", label: "Comfortable" },
] as const;

export function DensityToggle({ value, onChange, className }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Density"
      className={cn(
        "inline-flex rounded-md border border-border bg-muted p-0.5",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-sm px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors",
              checked
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
