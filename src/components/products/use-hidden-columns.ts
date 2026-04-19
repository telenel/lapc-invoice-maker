"use client";

import { useEffect, useRef, useState } from "react";

// These must match the @container breakpoints in product-table.css.
// If you change one, change both.
const MED_BREAKPOINT = 1024;
const LOW_BREAKPOINT = 1280;

export interface HiddenSummary {
  tiers: Array<"medium" | "low">;
}

export function getHiddenTiersForWidth(width: number): Array<"medium" | "low"> {
  const tiers: Array<"medium" | "low"> = [];
  if (width <= LOW_BREAKPOINT) tiers.push("low");
  if (width <= MED_BREAKPOINT) tiers.push("medium");
  return tiers;
}

export function useHiddenColumns(): {
  ref: React.RefObject<HTMLDivElement>;
  summary: HiddenSummary;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<HiddenSummary>({ tiers: [] });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setSummary({ tiers: getHiddenTiersForWidth(width) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, summary };
}
