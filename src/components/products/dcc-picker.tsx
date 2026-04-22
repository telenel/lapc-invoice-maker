"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadDccList, type DccListItem } from "@/domains/product/views-api";

interface Props {
  deptNum: string;
  classNum: string;
  catNum: string;
  onChange: (patch: { deptNum?: string; classNum?: string; catNum?: string }) => void;
}

function splitDccPartsWithPositions(query: string): string[] | null {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!/^[\d\s.\-]+$/.test(trimmed)) return null;

  return splitCompactDccParts(trimmed);
}

function splitCompactDccParts(query: string): string[] {
  const compact = query.trim().replace(/\s*([.-])\s*/g, "$1");
  if (!compact) return [];

  const tokens = compact.match(/[^.\-\s]+|[.\-]|\s+/g) ?? [];
  const parts: string[] = [];
  let current = "";
  let lastSeparatorWasExplicit = false;

  for (const token of tokens) {
    if (token === "." || token === "-") {
      parts.push(current);
      current = "";
      lastSeparatorWasExplicit = true;
      continue;
    }

    if (token.trim() === "") {
      if (!lastSeparatorWasExplicit) {
        parts.push(current);
        current = "";
      }
      lastSeparatorWasExplicit = false;
      continue;
    }

    current += token;
    lastSeparatorWasExplicit = false;
  }

  parts.push(current);
  return parts;
}

function formatDccParts(
  parts: Array<string | number | null | undefined>,
  separator: "." | "-" = ".",
): string {
  return parts
    .filter((part): part is string | number => part !== "" && part !== null && part !== undefined)
    .map(String)
    .join(separator);
}

function normalizeDccQuery(query: string): string | null {
  const parts = splitDccPartsWithPositions(query);
  if (parts === null) return null;
  if (parts.some((part) => part === "")) return null;
  return formatDccParts(parts, ".");
}

function getItemDccText(item: DccListItem, separator: "." | "-" = "."): string {
  return formatDccParts([item.deptNum, item.classNum, item.catNum], separator);
}

export function getPartialDccPatch(
  query: string,
): { deptNum?: string; classNum?: string; catNum?: string } | null {
  const parts = splitDccPartsWithPositions(query);
  if (parts === null) {
    return null;
  }
  if (parts.length === 0) {
    return { deptNum: "", classNum: "", catNum: "" };
  }
  return {
    deptNum: parts[0] ?? "",
    classNum: parts[1] ?? "",
    catNum: parts[2] ?? "",
  };
}

export function getSanitizedFallbackDccPatch(query: string): {
  deptNum?: string;
  classNum?: string;
  catNum?: string;
} {
  const parts = splitCompactDccParts(query);
  const [deptNum = "", classNum = "", catNum = ""] = parts
    .slice(0, 3)
    .map((part) => part.replace(/\D+/g, ""));

  return { deptNum, classNum, catNum };
}

export function findExactDccMatch(
  items: DccListItem[] | null,
  query: string,
): DccListItem | null {
  if (!items) return null;
  const normalized = normalizeDccQuery(query);
  if (!normalized) return null;
  return items.find((it) => getItemDccText(it, ".") === normalized) ?? null;
}

export function findCommittedDccMatch(
  items: DccListItem[] | null,
  query: string,
): DccListItem | null {
  const exact = findExactDccMatch(items, query);
  if (exact) return exact;
  if (!items) return null;

  const trimmed = query.trim();
  if (!trimmed || splitDccPartsWithPositions(trimmed) !== null) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  const matches = items.filter((it) =>
    [it.deptName, it.className, it.catName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(lowered),
  );

  return matches.length === 1 ? matches[0] : null;
}

export function DccPicker({ deptNum, classNum, catNum, onChange }: Props) {
  const [items, setItems] = useState<DccListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(() => deptNumToText(deptNum, classNum, catNum));

  useEffect(() => {
    setQuery(deptNumToText(deptNum, classNum, catNum));
  }, [deptNum, classNum, catNum]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attempt = () => {
      loadDccList()
        .then((list) => {
          if (cancelled) return;
          setItems(list);
          setFailed(false);
        })
        .catch(() => {
          if (cancelled) return;
          setFailed(true);
          // Retry after 30s so a transient /api/products/dcc-list blip
          // doesn't leave the advanced selector permanently on the text
          // fallback. loadDccList already clears its cache on rejection,
          // so the next call can legitimately recover.
          timer = setTimeout(attempt, 30_000);
        });
    };

    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const suggestions = useMemo(() => {
    if (!items || !query.trim()) return [];
    const normalizedCode = normalizeDccQuery(query);
    const codeQuery = normalizedCode !== null && normalizedCode !== "";
    const q = query.toLowerCase();
    const filtered = items.filter((it) => {
      const triple = getItemDccText(it, ".");
      const names = [it.deptName, it.className, it.catName].filter(Boolean).join(" ").toLowerCase();
      return codeQuery ? triple.startsWith(normalizedCode) : names.includes(q);
    });
    return filtered.slice(0, 12);
  }, [items, query]);

  function pick(it: DccListItem) {
    onChange({
      deptNum: String(it.deptNum),
      classNum: it.classNum != null ? String(it.classNum) : "",
      catNum: it.catNum != null ? String(it.catNum) : "",
    });
  }

  if (failed) {
    return (
      <div className="space-y-1">
        <Label htmlFor="dcc-fallback">DCC</Label>
        <Input
          id="dcc-fallback"
          placeholder="10-10-20"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onChange(getSanitizedFallbackDccPatch(next));
          }}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
        />
        <p className="text-xs text-muted-foreground">
          Name lookup unavailable — enter DCC as 10-10-20.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="dcc-picker">DCC</Label>
      <Input
        id="dcc-picker"
        list="dcc-picker-list"
        placeholder="10-10-20 or drinks…"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          const patch = getPartialDccPatch(next);
          if (patch) {
            onChange(patch);
          }
        }}
        onBlur={() => {
          const committed = findCommittedDccMatch(items, query);
          if (committed) pick(committed);
        }}
        spellCheck={false}
        autoComplete="off"
      />
      <datalist id="dcc-picker-list">
        {suggestions.map((it) => (
          <option
            key={getItemDccText(it, ".")}
            value={getItemDccText(it, "-")}
          >
            {[it.deptName, it.className, it.catName].filter(Boolean).join(" › ")}
          </option>
        ))}
      </datalist>
    </div>
  );
}

function deptNumToText(deptNum: string, classNum: string, catNum: string): string {
  if (!deptNum) return "";
  return formatDccParts([deptNum, classNum, catNum], "-");
}
