"use client";

import { createContext, useContext, useEffect, useState } from "react";

const SCALE_KEY = "ui-scale";
const DEFAULT_SCALE = "1.1";
const SCALES = [
  { value: "1", label: "Compact" },
  { value: "1.1", label: "Normal" },
  { value: "1.2", label: "Large" },
] as const;

type ScaleValue = (typeof SCALES)[number]["value"];

const ScaleContext = createContext<{
  scale: ScaleValue;
  setScale: (s: ScaleValue) => void;
  scales: typeof SCALES;
}>({ scale: DEFAULT_SCALE, setScale: () => {}, scales: SCALES });

export function UIScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<ScaleValue>(DEFAULT_SCALE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SCALE_KEY) as ScaleValue | null;
    if (saved && SCALES.some((s) => s.value === saved)) {
      setScaleState(saved);
      document.documentElement.style.setProperty("--ui-zoom", saved);
    } else {
      document.documentElement.style.setProperty("--ui-zoom", DEFAULT_SCALE);
    }
    setMounted(true);
  }, []);

  function setScale(s: ScaleValue) {
    setScaleState(s);
    localStorage.setItem(SCALE_KEY, s);
    document.documentElement.style.setProperty("--ui-zoom", s);
  }

  // Suppress hydration by not rendering until mounted — the CSS variable
  // is set synchronously in the useEffect so there's no flash.
  if (!mounted) {
    return (
      <ScaleContext.Provider value={{ scale: DEFAULT_SCALE, setScale, scales: SCALES }}>
        {children}
      </ScaleContext.Provider>
    );
  }

  return (
    <ScaleContext.Provider value={{ scale, setScale, scales: SCALES }}>
      {children}
    </ScaleContext.Provider>
  );
}

export function useUIScale() {
  return useContext(ScaleContext);
}
