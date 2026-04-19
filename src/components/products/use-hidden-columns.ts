"use client";

import { useEffect, useRef, useState } from "react";

const MED_BREAKPOINT = 1024;
const LOW_BREAKPOINT = 1280;

export interface HiddenSummary {
  tiers: Array<"medium" | "low">;
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
      const w = entries[0].contentRect.width;
      const tiers: Array<"medium" | "low"> = [];
      if (w < LOW_BREAKPOINT) tiers.push("low");
      if (w < MED_BREAKPOINT) tiers.push("medium");
      setSummary({ tiers });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, summary };
}
