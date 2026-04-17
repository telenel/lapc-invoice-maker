"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  /** Required columns cannot be hidden via the Columns menu. */
  required?: boolean;
}

export interface ColumnRuntimeState {
  key: string;
  width: number;
  hidden: boolean;
}

export interface ColumnVisible<D extends ColumnDef = ColumnDef> {
  def: D;
  width: number;
  hidden: boolean;
}

export interface UseColumnState<D extends ColumnDef = ColumnDef> {
  state: ColumnRuntimeState[];
  visible: ColumnVisible<D>[];
  setWidth: (key: string, width: number) => void;
  toggleHidden: (key: string) => void;
  reset: () => void;
}

export function useColumnState<D extends ColumnDef>(
  defs: D[],
  storageKey: string,
): UseColumnState<D> {
  const initial = useMemo<ColumnRuntimeState[]>(() => {
    const defaults = defs.map((d) => ({
      key: d.key,
      width: d.defaultWidth,
      hidden: false,
    }));
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaults;
      const stored = JSON.parse(raw) as Partial<ColumnRuntimeState>[];
      if (!Array.isArray(stored)) return defaults;
      return defaults.map((d) => {
        const s = stored.find((x) => x && x.key === d.key);
        if (!s) return d;
        return {
          key: d.key,
          width: typeof s.width === "number" ? s.width : d.width,
          hidden: !!s.hidden,
        };
      });
    } catch {
      return defaults;
    }
  }, [defs, storageKey]);

  const [state, setState] = useState<ColumnRuntimeState[]>(initial);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* ignore storage failures (private mode, quota, etc.) */
    }
  }, [state, storageKey]);

  const setWidth = useCallback((key: string, width: number) => {
    setState((s) =>
      s.map((c) =>
        c.key === key ? { ...c, width: Math.max(64, Math.round(width)) } : c,
      ),
    );
  }, []);

  const toggleHidden = useCallback(
    (key: string) => {
      const def = defs.find((d) => d.key === key);
      if (def?.required) return;
      setState((s) =>
        s.map((c) => (c.key === key ? { ...c, hidden: !c.hidden } : c)),
      );
    },
    [defs],
  );

  const reset = useCallback(() => {
    setState(
      defs.map((d) => ({ key: d.key, width: d.defaultWidth, hidden: false })),
    );
  }, [defs]);

  const visible = useMemo<ColumnVisible<D>[]>(
    () =>
      state
        .map((s) => {
          const def = defs.find((d) => d.key === s.key);
          return def ? { def, width: s.width, hidden: s.hidden } : null;
        })
        .filter((c): c is ColumnVisible<D> => c !== null && !c.hidden),
    [state, defs],
  );

  return { state, visible, setWidth, toggleHidden, reset };
}
