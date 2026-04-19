"use client";

import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLUMN_LABELS, COLUMN_PREFS_STORAGE_KEY, DEFAULT_COLUMN_SET, OPTIONAL_COLUMNS } from "@/domains/product/constants";
import type { OptionalColumnKey } from "@/domains/product/constants";

export interface ColumnVisibilityHandle {
  hideColumn: (key: OptionalColumnKey) => void;
}

interface Props {
  runtimeOverride: OptionalColumnKey[] | null;
  onUserChange: (visible: OptionalColumnKey[]) => void;
  onResetRuntime: () => void;
}

export const ColumnVisibilityToggle = forwardRef<ColumnVisibilityHandle, Props>(
  function ColumnVisibilityToggle({ runtimeOverride, onUserChange, onResetRuntime }, ref) {
    const [base, setBase] = useState<OptionalColumnKey[]>(() => {
      if (typeof window === "undefined") return DEFAULT_COLUMN_SET;
      try {
        const raw = window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY);
        if (!raw) return DEFAULT_COLUMN_SET;
        const parsed = JSON.parse(raw) as { visible?: string[] };
        if (!parsed?.visible) return DEFAULT_COLUMN_SET;
        return parsed.visible.filter((k): k is OptionalColumnKey =>
          (OPTIONAL_COLUMNS as readonly string[]).includes(k),
        );
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
        setBase(next);
        onResetRuntime();
      } else {
        setBase(next);
      }
    }

    useImperativeHandle(ref, () => ({
      hideColumn(key: OptionalColumnKey) {
        const next = active.filter((k) => k !== key);
        setBase(next);
        if (runtimeOverride) onResetRuntime();
      },
    }), [active, runtimeOverride, onResetRuntime]);

    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm">
              + Add column
            </Button>
          }
        />
        <PopoverContent align="end" className="w-56 p-2">
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
