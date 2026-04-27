"use client";

import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLUMN_LABELS, COLUMN_PRESETS, COLUMN_PREFS_STORAGE_KEY, DEFAULT_COLUMN_SET, OPTIONAL_COLUMNS } from "@/domains/product/constants";
import type { OptionalColumnKey } from "@/domains/product/constants";

export interface ColumnVisibilityHandle {
  hideColumn: (key: OptionalColumnKey) => void;
}

export function resolveColumnVisibilityUpdate(
  base: OptionalColumnKey[],
  runtimeOverride: OptionalColumnKey[] | null,
  next: OptionalColumnKey[],
): { base: OptionalColumnKey[]; runtime: OptionalColumnKey[] | null } {
  if (runtimeOverride) {
    return { base, runtime: next };
  }
  return { base: next, runtime: null };
}

export function isLegacyDefaultColumnSet(visible: OptionalColumnKey[]): boolean {
  return (
    visible.length === 3 &&
    visible.includes("units_1y") &&
    visible.includes("dcc") &&
    visible.includes("margin")
  );
}

interface Props {
  runtimeOverride: OptionalColumnKey[] | null;
  onUserChange: (visible: OptionalColumnKey[]) => void;
  onRuntimeChange: (visible: OptionalColumnKey[] | null) => void;
  onResetRuntime: () => void;
}

export const ColumnVisibilityToggle = forwardRef<ColumnVisibilityHandle, Props>(
  function ColumnVisibilityToggle(
    { runtimeOverride, onUserChange, onRuntimeChange, onResetRuntime },
    ref,
  ) {
    const [base, setBase] = useState<OptionalColumnKey[]>(() => {
      if (typeof window === "undefined") return DEFAULT_COLUMN_SET;
      try {
        const raw = window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY);
        if (!raw) return DEFAULT_COLUMN_SET;
        const parsed = JSON.parse(raw) as { visible?: string[] };
        if (!parsed?.visible) return DEFAULT_COLUMN_SET;
        const visible = parsed.visible.filter((k): k is OptionalColumnKey =>
          (OPTIONAL_COLUMNS as readonly string[]).includes(k),
        );
        return isLegacyDefaultColumnSet(visible) ? DEFAULT_COLUMN_SET : visible;
      } catch {
        return DEFAULT_COLUMN_SET;
      }
    });

    useEffect(() => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(COLUMN_PREFS_STORAGE_KEY, JSON.stringify({ visible: base }));
      onUserChange(base);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [base]);

    const active = runtimeOverride ?? base;

    function toggle(key: OptionalColumnKey) {
      const next = active.includes(key) ? active.filter((k) => k !== key) : [...active, key];
      if (runtimeOverride) {
        const resolved = resolveColumnVisibilityUpdate(base, runtimeOverride, next);
        onRuntimeChange(resolved.runtime);
      } else {
        setBase(next);
      }
    }

    function applyPreset(columns: readonly OptionalColumnKey[]) {
      const next = [...columns];
      if (runtimeOverride) {
        const resolved = resolveColumnVisibilityUpdate(base, runtimeOverride, next);
        onRuntimeChange(resolved.runtime);
      } else {
        setBase(next);
      }
    }

    function presetMatches(columns: readonly OptionalColumnKey[]): boolean {
      if (columns.length !== active.length) return false;
      const expected = new Set(columns);
      return active.every((c) => expected.has(c));
    }

    useImperativeHandle(ref, () => ({
      hideColumn(key: OptionalColumnKey) {
        const next = active.filter((k) => k !== key);
        if (runtimeOverride) {
          const resolved = resolveColumnVisibilityUpdate(base, runtimeOverride, next);
          onRuntimeChange(resolved.runtime);
          return;
        }
        setBase(next);
      },
    }), [active, base, runtimeOverride, onRuntimeChange]);

    // Trigger label: name of the matching preset, or "Custom" if the user
    // has hand-picked an idiosyncratic column set. Count always reflects the
    // currently-visible optional column count.
    const matchingPreset = COLUMN_PRESETS.find((p) => presetMatches(p.columns));
    const triggerLabel = matchingPreset?.label ?? "Custom";

    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1">
              <span className="text-muted-foreground">{triggerLabel}</span>
              <span className="font-mono tnum text-[10px] text-muted-foreground">
                · {active.length}
              </span>
            </Button>
          }
        />
        <PopoverContent align="end" className="w-64 p-2">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Presets
          </div>
          <div className="mb-2 grid grid-cols-2 gap-1">
            {COLUMN_PRESETS.map((preset) => {
              const matches = presetMatches(preset.columns);
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyPreset(preset.columns)}
                  title={preset.description}
                  className={`flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left text-[11.5px] font-medium transition-colors ${
                    matches
                      ? "border-primary/35 bg-primary/[0.06] text-primary"
                      : "border-border bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className="text-[9.5px] font-normal text-muted-foreground">
                    {preset.columns.length} {preset.columns.length === 1 ? "col" : "cols"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Visible columns
          </div>
          <ul className="space-y-1">
            {OPTIONAL_COLUMNS.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <input
                  id={`col-${key}`}
                  type="checkbox"
                  checked={active.includes(key)}
                  onChange={() => toggle(key)}
                  className="h-4 w-4"
                />
                <label htmlFor={`col-${key}`} className="text-sm cursor-pointer">
                  {COLUMN_LABELS[key]}
                </label>
              </li>
            ))}
          </ul>
          {runtimeOverride && (
            <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={onResetRuntime}>
              Reset to my default
            </Button>
          )}
        </PopoverContent>
      </Popover>
    );
  },
);
