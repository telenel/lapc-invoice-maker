"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRESET_GROUPS } from "@/domains/product/constants";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { listViews } from "@/domains/product/views-api";
import type { PresetGroup, SavedView } from "@/domains/product/types";

interface Props {
  activeSlug: string | null;
  activeId: string | null;
  onPresetClick: (view: SavedView) => void;
  onSaveClick: () => void;
  onDeleteClick: (view: SavedView) => void;
  onViewsResolved?: (views: SavedView[]) => void;
}

export function SavedViewsBar({
  activeSlug,
  activeId,
  onPresetClick,
  onSaveClick,
  onDeleteClick,
  onViewsResolved,
}: Props) {
  const [system, setSystem] = useState<SavedView[]>(SYSTEM_PRESET_VIEWS);
  const [mine, setMine] = useState<SavedView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let cancelled = false;
    listViews()
      .then((r) => {
        if (cancelled) return;
        const nextSystem = r.system.length > 0 ? r.system : SYSTEM_PRESET_VIEWS;
        setSystem(nextSystem);
        setMine(r.mine);
        setLoadError(null);
        onViewsResolved?.([...nextSystem, ...r.mine]);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not load saved views.");
        onViewsResolved?.(SYSTEM_PRESET_VIEWS);
      });
    return () => { cancelled = true; };
  }, [onViewsResolved]);

  const byGroup = new Map<PresetGroup, SavedView[]>();
  for (const v of system) {
    if (!v.presetGroup) continue;
    const arr = byGroup.get(v.presetGroup as PresetGroup) ?? [];
    arr.push(v);
    byGroup.set(v.presetGroup as PresetGroup, arr);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLOListElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const chips = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-view-chip]") ?? []);
    const idx = chips.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    const next = e.key === "ArrowRight" ? (idx + 1) % chips.length : (idx - 1 + chips.length) % chips.length;
    chips[next]?.focus();
    e.preventDefault();
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saved views">
      <ol
        ref={listRef}
        onKeyDown={handleKeyDown}
        className="flex flex-wrap items-center gap-1.5"
      >
        {PRESET_GROUPS.map(({ value, label, icon }) => {
          const items = byGroup.get(value) ?? [];
          if (items.length === 0) return null;
          return (
            <li key={value} className="flex items-center gap-1.5 border-r border-border pr-2 last:border-r-0">
              <span className="text-xs font-medium text-muted-foreground select-none" aria-hidden>
                {icon} {label}
              </span>
              {items.map((v) => (
                <ViewChip
                  key={v.id}
                  view={v}
                  active={activeSlug === v.slug}
                  onClick={() => onPresetClick(v)}
                />
              ))}
            </li>
          );
        })}

        {mine.length > 0 && (
          <li className="flex items-center gap-1.5 pl-2">
            <span className="text-xs font-medium text-muted-foreground select-none" aria-hidden>
              My views
            </span>
            {mine.map((v) => (
              <UserChip
                key={v.id}
                view={v}
                active={activeId === v.id}
                onClick={() => onPresetClick(v)}
                onDelete={() => onDeleteClick(v)}
              />
            ))}
          </li>
        )}
      </ol>

      <Button size="sm" variant="outline" onClick={onSaveClick} className="ml-auto">
        + Save View
      </Button>

      {loadError && (
        <p className="w-full text-xs text-muted-foreground" role="status" aria-live="polite">
          Showing system presets only — {loadError}
        </p>
      )}
    </div>
  );
}

function ViewChip({ view, active, onClick }: { view: SavedView; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-view-chip
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
      }`}
      style={{ touchAction: "manipulation" }}
    >
      {view.name}
    </button>
  );
}

function UserChip({ view, active, onClick, onDelete }: { view: SavedView; active: boolean; onClick: () => void; onDelete: () => void }) {
  return (
    <Popover>
      <span className="inline-flex items-center">
        <button
          type="button"
          data-view-chip
          aria-pressed={active}
          onClick={onClick}
          className={`rounded-l-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
          }`}
        >
          {view.name}
        </button>
        <PopoverTrigger
          aria-label={`View options for ${view.name}`}
          className="rounded-r-full border border-l-0 px-1.5 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ⋯
        </PopoverTrigger>
      </span>
      <PopoverContent align="end" className="w-40 p-1">
        <Button size="sm" variant="ghost" className="w-full justify-start text-destructive" onClick={onDelete}>
          Delete View
        </Button>
      </PopoverContent>
    </Popover>
  );
}
