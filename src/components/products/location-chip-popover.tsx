"use client";

import { ChevronDownIcon, MapPinIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getNextProductLocationIds,
} from "@/components/products/location-picker";
import {
  normalizeProductLocationIds,
  type ProductLocationId,
} from "@/domains/product/location-filters";

interface Props {
  value: readonly ProductLocationId[];
  onChange: (next: ProductLocationId[]) => void;
}

interface LocationOption {
  id: ProductLocationId;
  abbrev: "PIER" | "PCOP" | "PFS";
  label: string;
}

const OPTIONS: readonly LocationOption[] = [
  { id: 2, abbrev: "PIER", label: "Pierce Main" },
  { id: 3, abbrev: "PCOP", label: "Pierce COP" },
  { id: 4, abbrev: "PFS", label: "Pierce FS" },
] as const;

function summarize(ids: ProductLocationId[]): string {
  if (ids.length === 0) return "—";
  const primary = OPTIONS.find((o) => o.id === ids[0]);
  const baseLabel = primary?.label ?? primary?.abbrev ?? "Location";
  if (ids.length === 1) return baseLabel;
  return `${baseLabel} +${ids.length - 1}`;
}

export function LocationChipPopover({ value, onChange }: Props) {
  const ids = normalizeProductLocationIds(value);
  const summary = summarize(ids);

  function toggle(id: ProductLocationId) {
    const next = getNextProductLocationIds(ids, id);
    const sameLength = next.length === ids.length;
    const sameContent = sameLength && next.every((n, i) => n === ids[i]);
    if (sameContent) return; // last-selected guard handled in getNextProductLocationIds
    onChange(next);
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Location ${summary}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MapPinIcon className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Location</span>
            <span className="font-semibold">{summary}</span>
            <ChevronDownIcon className="size-3 text-muted-foreground" aria-hidden="true" />
          </button>
        }
      />
      <PopoverContent align="end" className="w-[260px] p-2">
        <div className="px-1.5 pb-1.5 pt-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Pricing &amp; stock context
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            All prices, costs, and stock counts shown reflect the selected locations. The first checked location is primary.
          </p>
        </div>
        <ul className="space-y-0.5">
          {OPTIONS.map((opt) => {
            const checked = ids.includes(opt.id);
            const isLast = checked && ids.length === 1;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => toggle(opt.id)}
                  disabled={isLast}
                  aria-pressed={checked}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
                    checked
                      ? "bg-primary/[0.06] text-primary hover:bg-primary/[0.10]"
                      : "text-foreground hover:bg-accent"
                  } ${isLast ? "cursor-not-allowed opacity-70" : ""}`}
                  title={isLast ? "Cannot deselect the last location." : undefined}
                >
                  <span
                    className={`inline-flex size-3.5 items-center justify-center rounded-[3px] border ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                    aria-hidden="true"
                  >
                    {checked ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5 9-11" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="flex-1 truncate">{opt.label}</span>
                  <span className="font-mono tnum text-[10px] text-muted-foreground">{opt.abbrev}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
