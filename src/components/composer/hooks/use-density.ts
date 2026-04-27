"use client";

import { useState, useCallback, useEffect } from "react";
import type { Density } from "../types";

const STORAGE_KEY = "composer.density";
const VALID: readonly Density[] = ["compact", "standard", "comfortable"] as const;

function isDensity(v: unknown): v is Density {
  return typeof v === "string" && (VALID as readonly string[]).includes(v);
}

export function useDensity() {
  const [density, setDensityState] = useState<Density>("standard");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isDensity(raw)) setDensityState(raw);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { density, setDensity };
}
