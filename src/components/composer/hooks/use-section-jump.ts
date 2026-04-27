"use client";

import { useCallback } from "react";
import type { SectionAnchor } from "../types";

const PULSE_CLASS = "composer-pulse";
const PULSE_MS = 900;

export function useSectionJump() {
  const jump = useCallback((anchor: SectionAnchor) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add(PULSE_CLASS);
    window.setTimeout(() => el.classList.remove(PULSE_CLASS), PULSE_MS);
  }, []);

  return { jump };
}
