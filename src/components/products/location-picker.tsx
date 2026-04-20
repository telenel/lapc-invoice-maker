"use client";

import { normalizeProductLocationIds, type ProductLocationId } from "@/domains/product/location-filters";
import { cn } from "@/lib/utils";

const LOCATION_OPTIONS: readonly { id: ProductLocationId; label: string }[] = [
  { id: 2, label: "PIER" },
  { id: 3, label: "PCOP" },
  { id: 4, label: "PFS" },
] as const;

export function getNextProductLocationIds(
  current: readonly ProductLocationId[],
  clickedId: ProductLocationId,
): ProductLocationId[] {
  const normalized = normalizeProductLocationIds(current);
  const isSelected = normalized.includes(clickedId);

  if (isSelected) {
    if (normalized.length === 1) {
      return normalized;
    }

    return normalizeProductLocationIds(normalized.filter((id) => id !== clickedId));
  }

  return normalizeProductLocationIds([...normalized, clickedId]);
}

interface LocationPickerProps {
  value: readonly ProductLocationId[];
  onChange: (next: ProductLocationId[]) => void;
  className?: string;
}

export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const locationIds = normalizeProductLocationIds(value);

  return (
    <div className={cn("inline-flex overflow-hidden rounded-lg border border-border bg-secondary p-0.5", className)}>
      <div
        role="group"
        aria-label="Location filter"
        className="inline-flex overflow-hidden rounded-[7px]"
      >
        {LOCATION_OPTIONS.map(({ id, label }, index) => {
          const active = locationIds.includes(id);
          const next = getNextProductLocationIds(locationIds, id);
          const noChange = next.length === locationIds.length && next.every((locationId, i) => locationId === locationIds[i]);

          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-label={label}
              onClick={() => {
                if (noChange) return;
                onChange(next);
              }}
              className={cn(
                "inline-flex min-w-[4.25rem] items-center justify-center px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px",
                active
                  ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                index > 0 && "border-l border-border/70 -ml-px",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
