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

export function getPartialDccPatch(
  query: string,
): { deptNum?: string; classNum?: string; catNum?: string } | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return { deptNum: "", classNum: "", catNum: "" };
  }
  if (!/^[\d.]+$/.test(trimmed)) {
    return null;
  }

  const parts = trimmed.split(".");
  return {
    deptNum: parts[0] ?? "",
    classNum: parts[1] ?? "",
    catNum: parts[2] ?? "",
  };
}

export function findExactDccMatch(
  items: DccListItem[] | null,
  query: string,
): DccListItem | null {
  if (!items) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;
  return (
    items.find((it) => `${it.deptNum}.${it.classNum ?? ""}.${it.catNum ?? ""}` === trimmed)
    ?? null
  );
}

export function findCommittedDccMatch(
  items: DccListItem[] | null,
  query: string,
): DccListItem | null {
  const exact = findExactDccMatch(items, query);
  if (exact) return exact;
  if (!items) return null;

  const trimmed = query.trim();
  if (!trimmed || /^[\d.]+$/.test(trimmed)) {
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
    const numeric = /^[\d.]+$/.test(query);
    const q = query.toLowerCase();
    const filtered = items.filter((it) => {
      const triple = `${it.deptNum}.${it.classNum ?? ""}.${it.catNum ?? ""}`;
      const names = [it.deptName, it.className, it.catName].filter(Boolean).join(" ").toLowerCase();
      return numeric ? triple.startsWith(query) : names.includes(q);
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
          placeholder="10.10.20"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            const parts = e.target.value.split(".");
            onChange({
              deptNum: parts[0] ?? "",
              classNum: parts[1] ?? "",
              catNum: parts[2] ?? "",
            });
          }}
          spellCheck={false}
          autoComplete="off"
          inputMode="numeric"
        />
        <p className="text-xs text-muted-foreground">
          Name lookup unavailable — enter DCC as 10.10.20.
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
        placeholder="10.10.20 or drinks…"
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
            key={`${it.deptNum}.${it.classNum ?? ""}.${it.catNum ?? ""}`}
            value={`${it.deptNum}.${it.classNum ?? ""}.${it.catNum ?? ""}`}
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
  return [deptNum, classNum, catNum].filter((p) => p !== "").join(".");
}
