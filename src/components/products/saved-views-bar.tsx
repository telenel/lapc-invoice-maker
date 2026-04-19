"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, SparklesIcon, AlertCircleIcon } from "lucide-react";
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
  onClearPreset: () => void;
  onDeleteClick: (view: SavedView) => void;
  onViewsResolved?: (views: SavedView[]) => void;
}

/**
 * Featured preset slugs surfaced inline next to the Presets button.
 * Chosen to span the four high-value axes: stock, sales, pricing, data quality.
 */
const FEATURED_PRESET_SLUGS = [
  "stock-stockout-risk",
  "movers-top-units-30d",
  "price-thin-margin-popular",
  "data-missing-barcode",
];

export function SavedViewsBar({
  activeSlug,
  activeId,
  onPresetClick,
  onClearPreset,
  onDeleteClick,
  onViewsResolved,
}: Props) {
  const [system, setSystem] = useState<SavedView[]>(SYSTEM_PRESET_VIEWS);
  const [mine, setMine] = useState<SavedView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, [onViewsResolved]);

  const byGroup = useMemo(() => {
    const map = new Map<PresetGroup, SavedView[]>();
    for (const v of system) {
      if (!v.presetGroup) continue;
      const arr = map.get(v.presetGroup as PresetGroup) ?? [];
      arr.push(v);
      map.set(v.presetGroup as PresetGroup, arr);
    }
    return map;
  }, [system]);

  const featured = useMemo(() => {
    const bySlug = new Map(system.map((v) => [v.slug ?? "", v]));
    return FEATURED_PRESET_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter((v): v is SavedView => !!v);
  }, [system]);

  const activePreset = useMemo(
    () => system.find((v) => v.slug === activeSlug) ?? null,
    [system, activeSlug],
  );

  const presetCount = system.filter((v) => v.presetGroup).length;

  return (
    <section
      className="w-full rounded-xl border border-border bg-[linear-gradient(112deg,color-mix(in_oklch,var(--primary)_3%,var(--card))_0%,var(--card)_45%,var(--card)_100%)] px-3 py-2"
      aria-label="Presets and saved views"
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Heading pill — single line */}
        <div className="flex items-center gap-1.5 shrink-0 pr-2.5 border-r border-border/70">
          <SparklesIcon
            className="size-3.5 text-primary"
            aria-hidden="true"
            strokeWidth={2.25}
          />
          <span className="text-[12px] font-semibold tracking-[-0.005em] text-foreground">
            Presets
          </span>
          <span className="font-mono tnum text-[10.5px] text-muted-foreground">
            {activePreset ? `· ${activePreset.name}` : `· ${presetCount}`}
          </span>
          {loadError ? (
            <span
              title={`Saved-views API: ${loadError}`}
              aria-label="Saved-views API unavailable"
              className="inline-flex"
            >
              <AlertCircleIcon
                className="size-3 text-muted-foreground/70"
                aria-hidden="true"
              />
            </span>
          ) : null}
        </div>

        {/* Featured chips */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {featured.map((v) => {
            const active = activeSlug === v.slug;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={active}
                onClick={() => onPresetClick(v)}
                title={v.description ?? v.name}
                className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-all duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_1px_2px_color-mix(in_oklch,var(--primary)_30%,transparent)]"
                    : "bg-card border-border text-foreground hover:border-primary/40 hover:bg-primary/[0.04]"
                }`}
              >
                {v.name}
              </button>
            );
          })}
        </div>

        {/* Browse all */}
        <Popover open={presetsOpen} onOpenChange={setPresetsOpen}>
          <PopoverTrigger
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11.5px] font-medium text-primary hover:bg-primary/10 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-150 ease-out"
            aria-label="Browse all presets"
          >
            Browse all
            <span className="font-mono tnum text-[10px] opacity-80">·{presetCount}</span>
            <ChevronDownIcon
              className={`size-3 transition-transform duration-200 ${presetsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[560px] max-h-[480px] overflow-auto p-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex flex-col leading-tight">
                <span className="text-[12px] font-semibold tracking-[-0.005em] text-foreground">
                  All {presetCount} presets
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Curated filter shortcuts — stock, sales, pricing, data quality.
                </span>
              </div>
              {activePreset ? (
                <button
                  type="button"
                  onClick={() => {
                    onClearPreset();
                    setPresetsOpen(false);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="p-2 flex flex-col gap-3">
              {PRESET_GROUPS.map(({ value, label }) => {
                const items = byGroup.get(value) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={value} className="flex flex-col gap-1">
                    <div className="px-1 text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground">
                      {label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {items.map((v) => (
                        <PresetPill
                          key={v.id}
                          view={v}
                          active={activeSlug === v.slug}
                          onClick={() => {
                            onPresetClick(v);
                            setPresetsOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* User views */}
        {mine.length > 0 ? (
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto pl-2 border-l border-border/70">
            <span className="text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground shrink-0">
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
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PresetPill({
  view,
  active,
  onClick,
}: {
  view: SavedView;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={useActiveScrollIntoView(active)}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left ${
        active
          ? "bg-primary/10 border-primary text-primary font-medium"
          : "bg-card border-border text-foreground hover:bg-accent"
      }`}
      title={view.description ?? view.name}
    >
      {view.name}
    </button>
  );
}

function useActiveScrollIntoView(active: boolean) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [active]);
  return ref;
}

function UserChip({
  view,
  active,
  onClick,
  onDelete,
}: {
  view: SavedView;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <Popover>
      <span className="inline-flex items-center shrink-0">
        <button
          type="button"
          data-view-chip
          aria-pressed={active}
          onClick={onClick}
          className={`rounded-l-md border px-2 py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            active
              ? "bg-primary/10 border-primary text-primary"
              : "bg-card border-border text-foreground hover:bg-accent"
          }`}
        >
          {view.name}
        </button>
        <PopoverTrigger
          aria-label={`View options for ${view.name}`}
          className="rounded-r-md border border-l-0 px-1.5 py-1 text-[11.5px] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ⋯
        </PopoverTrigger>
      </span>
      <PopoverContent align="end" className="w-40 p-1">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start text-destructive"
          onClick={onDelete}
        >
          Delete View
        </Button>
      </PopoverContent>
    </Popover>
  );
}
