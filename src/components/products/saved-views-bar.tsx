"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircleIcon, ChevronDownIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react";
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
  /**
   * Incrementing token that triggers a re-fetch of the views list. Parent
   * should bump it after save or delete mutations so the bar picks up the
   * change without a full remount.
   */
  refreshToken?: number;
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

export function getSavedViewsErrorFallback() {
  return {
    system: SYSTEM_PRESET_VIEWS,
    mine: [] as SavedView[],
    resolved: SYSTEM_PRESET_VIEWS,
  };
}

export function SavedViewsBar({
  activeSlug,
  activeId,
  onPresetClick,
  onClearPreset,
  onDeleteClick,
  onViewsResolved,
  refreshToken,
}: Props) {
  const [system, setSystem] = useState<SavedView[]>(SYSTEM_PRESET_VIEWS);
  const [mine, setMine] = useState<SavedView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetQuery, setPresetQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attempt = () => {
      // Re-fires whenever refreshToken changes so the bar picks up save /
      // delete mutations from the parent without a full component remount.
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
          const fallback = getSavedViewsErrorFallback();
          // Fall back to system presets immediately so a failed refresh after
          // save/delete can't leave stale custom views rendered or reapplicable
          // from the parent's resolved cache. The retry still gives the API a
          // chance to recover without a full remount.
          setSystem(fallback.system);
          setMine(fallback.mine);
          setLoadError(err instanceof Error ? err.message : "Could not load saved views.");
          onViewsResolved?.(fallback.resolved);
          retryTimer = setTimeout(attempt, 30_000);
        });
    };

    attempt();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [onViewsResolved, refreshToken]);

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

  const filteredByGroup = useMemo(() => {
    const query = presetQuery.trim().toLowerCase();
    if (!query) return byGroup;

    const groupLabels = new Map(PRESET_GROUPS.map((group) => [group.value, group.label]));
    const map = new Map<PresetGroup, SavedView[]>();
    for (const { value } of PRESET_GROUPS) {
      const items = byGroup.get(value) ?? [];
      const groupLabel = groupLabels.get(value)?.toLowerCase() ?? "";
      const matches = items.filter((view) => {
        const haystack = [
          view.name,
          view.description ?? "",
          view.slug ?? "",
          groupLabel,
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      });
      if (matches.length > 0) map.set(value, matches);
    }
    return map;
  }, [byGroup, presetQuery]);

  const filteredPresetCount = useMemo(() => {
    let count = 0;
    filteredByGroup.forEach((items) => {
      count += items.length;
    });
    return count;
  }, [filteredByGroup]);

  const featured = useMemo(() => {
    const bySlug = new Map(system.map((v) => [v.slug ?? "", v]));
    return FEATURED_PRESET_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter((v): v is SavedView => !!v);
  }, [system]);

  const activePreset = useMemo(() => {
    if (activeSlug) {
      const sys = system.find((v) => v.slug === activeSlug);
      if (sys) return sys;
    }
    if (activeId) {
      // User-created views have `slug: null`, so they can only be matched by id.
      const custom = mine.find((v) => v.id === activeId);
      if (custom) return custom;
    }
    return null;
  }, [system, mine, activeSlug, activeId]);

  const presetCount = system.filter((v) => v.presetGroup).length;

  useEffect(() => {
    if (!presetsOpen) setPresetQuery("");
  }, [presetsOpen]);

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

        {/* Featured chips — roving-tabindex group with arrow-key navigation */}
        <div
          role="toolbar"
          aria-label="Featured presets"
          className="flex items-center gap-1.5 flex-wrap min-w-0"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            const chips = Array.from(
              (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
                "button[data-featured-chip]",
              ),
            );
            const idx = chips.indexOf(document.activeElement as HTMLButtonElement);
            if (idx === -1) return;
            const next =
              e.key === "ArrowRight"
                ? (idx + 1) % chips.length
                : (idx - 1 + chips.length) % chips.length;
            chips[next]?.focus();
            e.preventDefault();
          }}
        >
          {featured.map((v) => {
            const active = activeSlug === v.slug;
            return (
              <button
                key={v.id}
                type="button"
                data-featured-chip
                aria-pressed={active}
                onClick={() => onPresetClick(v)}
                title={v.description ?? v.name}
                className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11.5px] font-medium text-primary hover:bg-primary/10 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150 ease-out"
            aria-label="Browse all presets"
          >
            Browse all
            <span className="font-mono tnum text-[10px] opacity-80">·{presetCount}</span>
            <ChevronDownIcon
              className={`size-3 transition-transform duration-200 ${presetsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[640px] max-w-[calc(100vw-2rem)] max-h-[520px] overflow-auto p-0">
            <div className="p-3 border-b border-border flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col leading-tight">
                  <span className="text-[12px] font-semibold tracking-[-0.005em] text-foreground">
                    All {presetCount} presets
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Search by name, category, or workflow signal.
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
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/35 px-2.5 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
                <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  aria-label="Search presets"
                  type="search"
                  value={presetQuery}
                  onChange={(event) => setPresetQuery(event.target.value)}
                  placeholder="Search presets…"
                  className="min-w-0 flex-1 border-none bg-transparent p-0 text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="font-mono tnum text-[10.5px] text-muted-foreground">
                  {filteredPresetCount}/{presetCount}
                </span>
                {presetQuery ? (
                  <button
                    type="button"
                    aria-label="Clear preset search"
                    onClick={() => setPresetQuery("")}
                    className="inline-flex items-center justify-center rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <XIcon className="size-3" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
            <div aria-label="Preset browser results" className="p-2 flex flex-col gap-3">
              {PRESET_GROUPS.map(({ value, label }) => {
                const items = filteredByGroup.get(value) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={value} className="rounded-lg border border-border/70 bg-card/70 p-2">
                    <div className="mb-1.5 flex items-center justify-between gap-3 px-1 text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground">
                      {label}
                      <span className="font-mono tnum text-[10px] font-normal">
                        {items.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
              {filteredPresetCount === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
                  No presets match &ldquo;{presetQuery.trim()}&rdquo;.
                </div>
              ) : null}
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
      className={`flex min-w-0 flex-col rounded-md border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-primary/10 border-primary text-primary font-medium"
          : "bg-card border-border text-foreground hover:bg-accent"
      }`}
      title={view.description ?? view.name}
    >
      <span className="truncate text-[11.5px] font-medium">{view.name}</span>
      {view.description ? (
        <span className="mt-0.5 truncate text-[10.5px] font-normal text-muted-foreground">
          {view.description}
        </span>
      ) : null}
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
