"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CopyIcon,
  KeyboardIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { BatchCreateRow, BatchValidationError } from "@/domains/product/types";

export function parsePastedGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.length > 0);
  return lines.map((l) => l.split("\t"));
}

export type MarginTone = "good" | "warn" | "bad" | "idle";

export function computeMargin(
  cost: string,
  retail: string,
): { pct: number | null; tone: MarginTone } {
  if (cost.trim() === "" || retail.trim() === "") {
    return { pct: null, tone: "idle" };
  }
  const c = Number(cost);
  const r = Number(retail);
  if (!Number.isFinite(c) || !Number.isFinite(r) || r <= 0 || c < 0) {
    return { pct: null, tone: "idle" };
  }
  const pct = ((r - c) / r) * 100;
  const tone: MarginTone = pct >= 30 ? "good" : pct >= 10 ? "warn" : "bad";
  return { pct, tone };
}

type ColumnKind = "text" | "number" | "money" | "ref" | "margin";
type RefKind = "vendor" | "dcc" | "tax";

interface ColumnDef {
  key: string;
  label: string;
  kind: ColumnKind;
  ref?: RefKind;
  width: string;
  placeholder?: string;
  maxLength?: number;
}

const COLUMNS: ColumnDef[] = [
  { key: "description",   label: "Description",  kind: "text",   width: "min-w-[16rem]", placeholder: "PIERCE LOGO MUG 12OZ", maxLength: 128 },
  { key: "retail",        label: "Retail",       kind: "money",  width: "w-28",          placeholder: "0.00" },
  { key: "cost",          label: "Cost",         kind: "money",  width: "w-28",          placeholder: "0.00" },
  { key: "margin",        label: "Margin",       kind: "margin", width: "w-20" },
  { key: "vendorId",      label: "Vendor",       kind: "ref",    ref: "vendor", width: "min-w-[12rem]" },
  { key: "dccId",         label: "Dept / Class", kind: "ref",    ref: "dcc",    width: "min-w-[14rem]" },
  { key: "itemTaxTypeId", label: "Tax",          kind: "ref",    ref: "tax",    width: "min-w-[11rem]" },
  { key: "barcode",       label: "Barcode",      kind: "text",   width: "w-40", placeholder: "UPC", maxLength: 20 },
  { key: "catalogNumber", label: "Catalog #",    kind: "text",   width: "w-32", placeholder: "vendor part #", maxLength: 30 },
  { key: "comment",       label: "Comment",      kind: "text",   width: "w-32", placeholder: "note", maxLength: 25 },
];

const INPUTTABLE_COLS = COLUMNS.filter((c) => c.kind !== "margin");

interface GridRow {
  [key: string]: string;
}

function emptyRow(defaults?: Record<string, string | undefined>): GridRow {
  const base: GridRow = Object.fromEntries(INPUTTABLE_COLS.map((c) => [c.key, ""])) as GridRow;
  if (!defaults) return base;
  for (const [k, v] of Object.entries(defaults)) {
    if (typeof v === "string") base[k] = v;
  }
  return base;
}

function toBatchRow(r: GridRow, defaults?: GridRow): BatchCreateRow | null {
  function v(key: string): string {
    const own = r[key]?.trim();
    if (own) return own;
    return (defaults?.[key] ?? "").trim();
  }
  const description = v("description");
  if (!description) return null;
  return {
    description,
    vendorId: Number(v("vendorId")) || 0,
    dccId: Number(v("dccId")) || 0,
    itemTaxTypeId: v("itemTaxTypeId") ? Number(v("itemTaxTypeId")) : undefined,
    barcode: v("barcode") || null,
    catalogNumber: v("catalogNumber") || null,
    comment: v("comment") || null,
    retail: Number(v("retail")) || 0,
    cost: Number(v("cost")) || 0,
  };
}

function refOptions(
  ref: RefKind,
  refs: PrismRefs | null,
  currentValue: string,
): Array<{ value: string; label: string }> {
  if (!refs) return [];
  const options: Array<{ value: string; label: string }> = [];
  if (ref === "vendor") {
    for (const v of refs.vendors) {
      options.push({ value: String(v.vendorId), label: v.name });
    }
  } else if (ref === "dcc") {
    for (const d of refs.dccs) {
      const dept = (d.deptName ?? "").trim();
      const cls = (d.className ?? "").trim();
      const label = dept && cls ? `${dept} / ${cls}` : dept || cls || "(unnamed)";
      options.push({ value: String(d.dccId), label });
    }
  } else {
    for (const t of refs.taxTypes) {
      options.push({ value: String(t.taxTypeId), label: t.description });
    }
  }
  if (currentValue && !options.some((o) => o.value === currentValue)) {
    options.unshift({ value: currentValue, label: `Unknown (${currentValue})` });
  }
  return options;
}

const MARGIN_TONE_CLASS: Record<MarginTone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
  idle: "text-muted-foreground/60",
};

function toneForAvg(pct: number): MarginTone {
  return pct >= 30 ? "good" : pct >= 10 ? "warn" : "bad";
}

interface BatchAddGridProps {
  onSubmitted?: (skus: number[]) => void;
}

export function BatchAddGrid({ onSubmitted }: BatchAddGridProps) {
  const [refs, setRefs] = useState<PrismRefs | null>(null);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [rows, setRows] = useState<GridRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [useDefaults, setUseDefaults] = useState(true);
  const [errors, setErrors] = useState<BatchValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastValidated, setLastValidated] = useState<"clean" | "dirty" | "idle">("idle");
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  useEffect(() => {
    productApi
      .refs()
      .then((r) => {
        setRefs(r);
        setRows((prev) =>
          prev.map((row) => (row.itemTaxTypeId ? row : { ...row, itemTaxTypeId: "6" })),
        );
      })
      .catch((err) => setRefsError(err instanceof Error ? err.message : String(err)));
  }, []);

  const updateCell = useCallback((rowIdx: number, key: string, value: string) => {
    setRows((r) => r.map((row, i) => (i === rowIdx ? { ...row, [key]: value } : row)));
    setErrors((e) => e.filter((err) => err.rowIndex !== rowIdx || err.field !== key));
    setLastValidated("dirty");
  }, []);

  const addRow = useCallback((count = 1) => {
    setRows((r) => {
      const last = r[r.length - 1];
      const seed = {
        vendorId: last?.vendorId ?? "",
        dccId: last?.dccId ?? "",
        itemTaxTypeId: last?.itemTaxTypeId ?? "6",
      };
      const next = [...r];
      for (let i = 0; i < count; i++) next.push(emptyRow(seed));
      return next;
    });
    setLastValidated("dirty");
  }, []);

  const removeLastRow = useCallback(() => {
    setRows((r) => (r.length > 1 ? r.slice(0, -1) : r));
    setLastValidated("dirty");
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== idx) : r));
    setErrors((e) =>
      e
        .filter((x) => x.rowIndex !== idx)
        .map((x) => (x.rowIndex > idx ? { ...x, rowIndex: x.rowIndex - 1 } : x)),
    );
    setLastValidated("dirty");
  }, []);

  const duplicateRow = useCallback((idx: number) => {
    setRows((r) => {
      const next = [...r];
      next.splice(idx + 1, 0, { ...r[idx] });
      return next;
    });
    setLastValidated("dirty");
  }, []);

  const fillDown = useCallback((rowIdx: number, key: string) => {
    if (rowIdx === 0) return;
    setRows((r) =>
      r.map((row, i) => (i === rowIdx ? { ...row, [key]: r[rowIdx - 1][key] ?? "" } : row)),
    );
    setLastValidated("dirty");
  }, []);

  function onPaste(e: React.ClipboardEvent<HTMLElement>, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const grid = parsePastedGrid(text);
    setRows((existing) => {
      const next = [...existing];
      for (let i = 0; i < grid.length; i++) {
        const targetIdx = rowIdx + i;
        if (targetIdx >= next.length) next.push(emptyRow());
        const target = { ...next[targetIdx] };
        for (let j = 0; j < grid[i].length; j++) {
          const targetCol = INPUTTABLE_COLS[colIdx + j];
          if (!targetCol) break;
          target[targetCol.key] = grid[i][j];
        }
        next[targetIdx] = target;
      }
      return next;
    });
    setLastValidated("dirty");
  }

  const rowsToBatch = useCallback((): BatchCreateRow[] => {
    const defaults = useDefaults ? rows[0] : undefined;
    return rows.map((r) => toBatchRow(r, defaults)).filter((r): r is BatchCreateRow => r !== null);
  }, [rows, useDefaults]);

  const handleValidate = useCallback(async () => {
    setSubmitting(true);
    try {
      const batch = rowsToBatch();
      if (batch.length === 0) {
        setErrors([]);
        setLastValidated("idle");
        toast.info("Nothing to validate — add a description to at least one row.");
        return;
      }
      const result = await productApi.validateBatch({ action: "create", rows: batch });
      setErrors(result.errors);
      setLastValidated(result.errors.length === 0 ? "clean" : "dirty");
      if (result.errors.length === 0) {
        toast.success(
          `${batch.length} item${batch.length === 1 ? "" : "s"} valid — ready to submit`,
        );
      } else {
        toast.error(
          `${result.errors.length} validation error${result.errors.length === 1 ? "" : "s"}`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setSubmitting(false);
    }
  }, [rowsToBatch]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setErrors([]);
    try {
      const batch = rowsToBatch();
      if (batch.length === 0) return;
      const result = await productApi.batch({ action: "create", rows: batch });
      if ("errors" in result && result.errors.length > 0) {
        setErrors(result.errors);
        setLastValidated("dirty");
        toast.error(
          `${result.errors.length} row${result.errors.length === 1 ? "" : "s"} failed — nothing was saved`,
        );
        return;
      }
      if ("count" in result) {
        toast.success(`Created ${result.count} item${result.count === 1 ? "" : "s"}`);
        onSubmitted?.(result.skus);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [rowsToBatch, onSubmitted]);

  const cellError = useCallback(
    (rowIdx: number, key: string): string | null => {
      const e = errors.find((x) => x.rowIndex === rowIdx && x.field === key);
      return e ? e.message : null;
    },
    [errors],
  );

  const batch = useMemo(() => rowsToBatch(), [rowsToBatch]);
  const summary = useMemo(() => {
    const totalRetail = batch.reduce((s, r) => s + r.retail, 0);
    const totalCost = batch.reduce((s, r) => s + r.cost, 0);
    const avgMargin = totalRetail > 0 ? ((totalRetail - totalCost) / totalRetail) * 100 : null;
    return { totalRetail, totalCost, avgMargin };
  }, [batch]);

  const refsLoading = refs === null && !refsError;
  const canSubmit = !submitting && !refsLoading && batch.length > 0 && errors.length === 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inGrid = target && tbodyRef.current?.contains(target);
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canSubmit) void handleSubmit();
        } else {
          void handleValidate();
        }
        return;
      }
      if (inGrid && (e.key === "d" || e.key === "D")) {
        const id = target?.getAttribute("id") ?? "";
        const m = id.match(/^batch-(\d+)-(.+)$/);
        if (m) {
          e.preventDefault();
          fillDown(Number(m[1]), m[2]);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSubmit, handleSubmit, handleValidate, fillDown]);

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLElement>, rowIdx: number) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const isLast = rowIdx === rows.length - 1;
      const target = e.target as HTMLElement;
      if (isLast && target.tagName === "INPUT") {
        e.preventDefault();
        addRow(1);
        requestAnimationFrame(() => {
          const next = document.getElementById(`batch-${rowIdx + 1}-description`);
          next?.focus();
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      {refsError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          Couldn&apos;t load vendor / department / tax lookups: {refsError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
        <Button onClick={() => addRow(1)} variant="outline" size="sm" disabled={refsLoading}>
          <PlusIcon className="mr-1 size-3.5" />
          Add row
        </Button>
        <Button onClick={() => addRow(5)} variant="ghost" size="sm" disabled={refsLoading}>
          +5
        </Button>
        <Button
          onClick={removeLastRow}
          variant="ghost"
          size="sm"
          disabled={refsLoading || rows.length <= 1}
        >
          <MinusIcon className="mr-1 size-3.5" />
          Remove last
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden />
        <label
          className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
          title="Blank cells in rows 2+ inherit the value from row 1 in the same column."
        >
          <input
            type="checkbox"
            checked={useDefaults}
            onChange={(e) => setUseDefaults(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Use row 1 as defaults
        </label>
        <button
          type="button"
          onClick={() => setShowKeyboardHelp((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          aria-expanded={showKeyboardHelp}
        >
          <KeyboardIcon className="size-3.5" />
          Shortcuts
        </button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {showKeyboardHelp ? (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            <ShortcutRow keys="Enter" hint="New row (last row only)" />
            <ShortcutRow keys="⌘/Ctrl + D" hint="Fill down from above" />
            <ShortcutRow keys="⌘/Ctrl + Enter" hint="Validate" />
            <ShortcutRow keys="⌘/Ctrl + Shift + Enter" hint="Submit" />
            <ShortcutRow keys="Paste" hint="Tab/newline values spread across cells" />
          </div>
        </div>
      ) : null}

      {refsLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 px-4 py-10 text-sm text-muted-foreground"
        >
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Loading vendor, department, and tax lookups…
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border bg-card shadow-sm max-h-[62vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-muted/80 px-2 py-2 text-right font-medium text-muted-foreground w-10"
                >
                  #
                </th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      "px-2 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground",
                      c.width,
                      c.kind === "money" || c.kind === "margin" ? "text-right" : "",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
                <th
                  scope="col"
                  className="w-16 px-2 py-2 font-medium text-muted-foreground"
                  aria-label="Row actions"
                />
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {rows.map((row, rowIdx) => {
                const margin = computeMargin(row.cost, row.retail);
                const isTemplate = useDefaults && rowIdx === 0;
                return (
                  <tr
                    key={rowIdx}
                    className={cn(
                      "border-t even:bg-muted/20",
                      isTemplate && "bg-primary/5 even:bg-primary/5",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 bg-background px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground align-top",
                        isTemplate && "bg-primary/5",
                      )}
                    >
                      <div className="flex flex-col items-end gap-0.5 pt-1.5">
                        <span>{rowIdx + 1}</span>
                        {isTemplate ? (
                          <span className="rounded-sm bg-primary/15 px-1 text-[9px] font-semibold uppercase text-primary">
                            Def
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {COLUMNS.map((col, colIdx) => {
                      if (col.kind === "margin") {
                        return (
                          <td key={col.key} className="px-2 py-1.5 text-right align-top">
                            <span
                              className={cn(
                                "inline-block rounded-md px-1.5 py-1 text-xs font-medium tabular-nums",
                                MARGIN_TONE_CLASS[margin.tone],
                              )}
                              aria-label={
                                margin.pct === null
                                  ? "Margin unavailable until cost and retail are set"
                                  : `Margin ${margin.pct.toFixed(1)} percent`
                              }
                            >
                              {margin.pct === null ? "—" : `${margin.pct.toFixed(1)}%`}
                            </span>
                          </td>
                        );
                      }
                      const err = cellError(rowIdx, col.key);
                      return (
                        <BatchCell
                          key={col.key}
                          col={col}
                          colIdx={colIdx}
                          rowIdx={rowIdx}
                          value={row[col.key] ?? ""}
                          error={err}
                          refs={refs}
                          onChange={(v) => updateCell(rowIdx, col.key, v)}
                          onPaste={(e) => onPaste(e, rowIdx, colIdx)}
                          onKeyDown={(e) => handleCellKeyDown(e, rowIdx)}
                        />
                      );
                    })}
                    <td className="px-1 py-1.5 align-top">
                      <div className="flex items-center justify-end gap-0.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => duplicateRow(rowIdx)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Duplicate row"
                          aria-label={`Duplicate row ${rowIdx + 1}`}
                        >
                          <CopyIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(rowIdx)}
                          disabled={rows.length <= 1}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          title="Delete row"
                          aria-label={`Delete row ${rowIdx + 1}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">
            {batch.length} item{batch.length === 1 ? "" : "s"} ready
          </span>
          <span className="text-muted-foreground tabular-nums">
            retail ${summary.totalRetail.toFixed(2)}
          </span>
          <span className="text-muted-foreground tabular-nums">
            cost ${summary.totalCost.toFixed(2)}
          </span>
          {summary.avgMargin !== null ? (
            <span className={cn("tabular-nums", MARGIN_TONE_CLASS[toneForAvg(summary.avgMargin)])}>
              avg margin {summary.avgMargin.toFixed(1)}%
            </span>
          ) : null}
          {errors.length > 0 ? (
            <span className="text-destructive" aria-live="polite">
              · {errors.length} error{errors.length === 1 ? "" : "s"}
            </span>
          ) : lastValidated === "clean" ? (
            <span className="text-emerald-600 dark:text-emerald-400" aria-live="polite">
              · validated
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={submitting || refsLoading || batch.length === 0}
          >
            {submitting && lastValidated !== "clean" ? (
              <Loader2Icon className="mr-1 size-3.5 animate-spin" aria-hidden />
            ) : null}
            Validate
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && lastValidated === "clean" ? (
              <Loader2Icon className="mr-1 size-3.5 animate-spin" aria-hidden />
            ) : null}
            {submitting
              ? "Working…"
              : batch.length === 0
                ? "Nothing to submit"
                : `Submit ${batch.length} item${batch.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface BatchCellProps {
  col: ColumnDef;
  colIdx: number;
  rowIdx: number;
  value: string;
  error: string | null;
  refs: PrismRefs | null;
  onChange: (value: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

function BatchCell({
  col,
  rowIdx,
  value,
  error,
  refs,
  onChange,
  onPaste,
  onKeyDown,
}: BatchCellProps) {
  const cellId = `batch-${rowIdx}-${col.key}`;
  const errId = `${cellId}-err`;
  const commonAria = {
    "aria-label": `${col.label} for row ${rowIdx + 1}`,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-errormessage": error ? errId : undefined,
  };

  const cellClass = cn("px-2 py-1.5 align-top", error && "bg-destructive/5");

  if (col.kind === "ref" && col.ref) {
    const options = refOptions(col.ref, refs, value);
    return (
      <td className={cellClass}>
        <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
          <SelectTrigger
            id={cellId}
            size="sm"
            className={cn(
              "h-8 w-full",
              error && "border-destructive focus-visible:ring-destructive/30",
            )}
            {...commonAria}
            onKeyDown={onKeyDown}
          >
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--anchor-width)] sm:min-w-80 max-w-[min(32rem,90vw)]">
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? <CellError id={errId} message={error} /> : null}
      </td>
    );
  }

  const isMoney = col.kind === "money";
  const isNumber = col.kind === "number" || isMoney;

  return (
    <td className={cellClass}>
      <div className={cn("relative", isMoney && "flex items-center")}>
        {isMoney ? (
          <span className="pointer-events-none absolute left-2 text-xs text-muted-foreground">
            $
          </span>
        ) : null}
        <Input
          id={cellId}
          name={col.key}
          {...commonAria}
          autoComplete="off"
          spellCheck={false}
          type={isNumber ? "number" : "text"}
          step={isNumber ? "0.01" : undefined}
          min={isNumber ? "0" : undefined}
          inputMode={isNumber ? "decimal" : undefined}
          placeholder={col.placeholder}
          maxLength={col.maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          className={cn(
            "h-8",
            isMoney && "pl-5 text-right tabular-nums",
            error && "border-destructive focus-visible:ring-destructive/30",
          )}
        />
      </div>
      {error ? <CellError id={errId} message={error} /> : null}
    </td>
  );
}

function CellError({ id, message }: { id: string; message: string }) {
  return (
    <div id={id} className="mt-1 text-[11px] leading-snug text-destructive" role="alert">
      {message}
    </div>
  );
}

function ShortcutRow({ keys, hint }: { keys: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">{keys}</kbd>
      <span>{hint}</span>
    </div>
  );
}
