"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useUserPreference } from "@/domains/user-preference/hooks";

const SCALE_KEY = "ui-scale";
const DEFAULT_SCALE = "1.1";
const SCALES = [
  { value: "1", label: "Compact" },
  { value: "1.1", label: "Normal" },
  { value: "1.2", label: "Large" },
] as const;

type ScaleValue = (typeof SCALES)[number]["value"];

function parseScalePreference(value: unknown): ScaleValue {
  if (typeof value === "string" && SCALES.some((scale) => scale.value === value)) {
    return value as ScaleValue;
  }

  return DEFAULT_SCALE;
}

const ScaleContext = createContext<{
  scale: ScaleValue;
  setScale: (s: ScaleValue) => void;
  scales: typeof SCALES;
}>({ scale: DEFAULT_SCALE, setScale: () => {}, scales: SCALES });

export function UIScaleProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const {
    value: scale,
    setValue: setScalePreference,
  } = useUserPreference<ScaleValue>({
    key: SCALE_KEY,
    defaultValue: DEFAULT_SCALE,
    deserialize: parseScalePreference,
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-zoom", scale);
    setMounted(true);
  }, [scale]);

  function setScale(nextScale: ScaleValue) {
    setScalePreference(nextScale);
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
