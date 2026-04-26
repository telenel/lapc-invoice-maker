"use client";

import { TABLE_DENSITIES, type TableDensity } from "@/domains/product/constants";

interface Props {
  value: TableDensity;
  onChange: (next: TableDensity) => void;
}

export function DensityToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Row density"
      className="inline-flex items-center rounded-md border border-border bg-secondary p-0.5"
    >
      {TABLE_DENSITIES.map((density) => {
        const active = density.value === value;
        return (
          <button
            key={density.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (active) return;
              onChange(density.value);
            }}
            className={`inline-flex items-center justify-center rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium transition-colors ${
              active
                ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {density.label}
          </button>
        );
      })}
    </div>
  );
}
