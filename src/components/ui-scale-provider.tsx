"use client";

import { createContext, useContext, useEffect, useState } from "react";

const SCALE_KEY = "ui-scale";
const SCALES = [
  { value: "1", label: "Default" },
  { value: "1.1", label: "Large" },
  { value: "1.2", label: "Extra Large" },
] as const;

type ScaleValue = (typeof SCALES)[number]["value"];

const ScaleContext = createContext<{
  scale: ScaleValue;
  setScale: (s: ScaleValue) => void;
  scales: typeof SCALES;
}>({ scale: "1", setScale: () => {}, scales: SCALES });

export function UIScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<ScaleValue>("1");

  useEffect(() => {
    const saved = localStorage.getItem(SCALE_KEY) as ScaleValue | null;
    if (saved && SCALES.some((s) => s.value === saved)) {
      setScaleState(saved);
      document.documentElement.style.setProperty("--ui-zoom", saved);
    }
  }, []);

  function setScale(s: ScaleValue) {
    setScaleState(s);
    localStorage.setItem(SCALE_KEY, s);
    document.documentElement.style.setProperty("--ui-zoom", s);
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
