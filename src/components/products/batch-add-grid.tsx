"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Columns3Icon,
  CopyIcon,
  EyeOffIcon,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useColumnState,
  type ColumnDef,
  type ColumnRuntimeState,
} from "@/hooks/use-column-state";
import { cn } from "@/lib/utils";
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { BatchCreateRow, BatchValidationError } from "@/domains/product/types";
import { ItemRefSelects } from "./item-ref-selects";

interface DefaultsState {
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
}

const EMPTY_DEFAULTS: DefaultsState = {
  vendorId: "",
  dccId: "",
  itemTaxTypeId: "6",
};

type ColumnKind = "text" | "money" | "ref" | "margin";
type RefKind = "vendor" | "dcc" | "tax";

interface BatchColumn extends ColumnDef {
  kind: ColumnKind;
  ref?: RefKind;
  placeholder?: string;
  maxLength?: number;
}

const COLUMNS: BatchColumn[] = [
  { key: "description",   label: "Description",  kind: "text",   defaultWidth: 260, placeholder: "PIERCE LOGO MUG 12OZ", maxLength: 128, required: true },
  { key: "retail",        label: "Retail",       kind: "money",  defaultWidth: 104, placeholder: "0.00", required: true },
  { key: "cost",          label: "Cost",         kind: "money",  defaultWidth: 104, placeholder: "0.00", required: true },
  { key: "margin",        label: "Margin",       kind: "margin", defaultWidth: 92 },
  { key: "vendorId",      label: "Vendor",       kind: "ref",    defaultWidth: 170, ref: "vendor" },
  { key: "dccId",         label: "Dept / Class", kind: "ref",    defaultWidth: 200, ref: "dcc" },
  { key: "itemTaxTypeId", label: "Tax",          kind: "ref",    defaultWidth: 140, ref: "tax" },
  { key: "barcode",       label: "Barcode",      kind: "text",   defaultWidth: 140, placeholder: "UPC", maxLength: 20 },
  { key: "catalogNumber", label: "Catalog #",    kind: "text",   defaultWidth: 128, placeholder: "vendor part #", maxLength: 30 },
  { key: "comment",       label: "Comment",      kind: "text",   defaultWidth: 128, placeholder: "note", maxLength: 25 },
];

const COLUMN_STORAGE_KEY = "laportal.batch-add.columns";

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

const INPUTTABLE_COLS = COLUMNS.filter((c) => c.kind !== "margin");

interface GridRow {
  [key: string]: string;
}

function emptyRow(): GridRow {
  return Object.fromEntries(INPUTTABLE_COLS.map((c) => [c.key, ""])) as GridRow;
}

function toBatchRow(r: GridRow, defaults: DefaultsState): BatchCreateRow | null {
  function v(key: string): string {
    const own = r[key]?.trim();
    if (own) return own;
    if (key in defaults) return (defaults[key as keyof DefaultsState] ?? "").trim();
    return "";
  }
  const description = r.description?.trim() ?? "";
  if (!description) return null;
  return {
    description,
    vendorId: Number(v("vendorId")) || 0,
    dccId: Number(v("dccId")) || 0,
    itemTaxTypeId: v("itemTaxTypeId") ? Number(v("itemTaxTypeId")) : undefined,
    barcode: (r.barcode?.trim() || null) as string | null,
    catalogNumber: (r.catalogNumber?.trim() || null) as string | null,
    comment: (r.comment?.trim() || null) as string | null,
    retail: Number(r.retail) || 0,
    cost: Number(r.cost) || 0,
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

const MARGIN_TONE_BG: Record<MarginTone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-destructive",
  idle: "bg-muted-foreground/20",
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
  const [defaults, setDefaults] = useState<DefaultsState>(EMPTY_DEFAULTS);
  const [errors, setErrors] = useState<BatchValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastValidated, setLastValidated] = useState<"clean" | "dirty" | "idle">("idle");
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  const {
    state: colState,
    visible: visibleCols,
    setWidth,
    toggleHidden,
    reset: resetCols,
  } = useColumnState(COLUMNS, COLUMN_STORAGE_KEY);

  const hiddenCount = useMemo(
    () => colState.filter((c) => c.hidden).length,
    [colState],
  );

  useEffect(() => {
    productApi
      .refs()
      .then(setRefs)
      .catch((err) => setRefsError(err instanceof Error ? err.message : String(err)));
  }, []);

  const updateCell = useCallback((rowIdx: number, key: string, value: string) => {
    setRows((r) => r.map((row, i) => (i === rowIdx ? { ...row, [key]: value } : row)));
    setErrors((e) => e.filter((err) => err.rowIndex !== rowIdx || err.field !== key));
    setLastValidated("dirty");
  }, []);

  const addRow = useCallback((count = 1) => {
    setRows((r) => {
      const next = [...r];
      for (let i = 0; i < count; i++) next.push(emptyRow());
      return next;
    });
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

  const focusCell = useCallback((rowIdx: number, key: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(`batch-${rowIdx}-${key}`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  // Paste spreads clipboard cells across the *visible* inputtable columns,
  // skipping the computed margin column. Starting position is the cell the
  // user pasted into; matches the spreadsheet-ish mental model.
  function onPaste(e: React.ClipboardEvent<HTMLElement>, rowIdx: number, visibleColIdx: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const grid = parsePastedGrid(text);
    const inputtableVisible = visibleCols.filter((c) => c.def.kind !== "margin");
    // Translate the starting visible index into the filtered (non-margin) list.
    const startCol = visibleCols[visibleColIdx];
    if (!startCol) return;
    const startInputtableIdx = inputtableVisible.findIndex((c) => c.def.key === startCol.def.key);
    if (startInputtableIdx === -1) return;
    setRows((existing) => {
      const next = [...existing];
      for (let i = 0; i < grid.length; i++) {
        const targetIdx = rowIdx + i;
        if (targetIdx >= next.length) next.push(emptyRow());
        const target = { ...next[targetIdx] };
        for (let j = 0; j < grid[i].length; j++) {
          const targetCol = inputtableVisible[startInputtableIdx + j];
          if (!targetCol) break;
          target[targetCol.def.key] = grid[i][j];
        }
        next[targetIdx] = target;
      }
      return next;
    });
    setLastValidated("dirty");
  }

  const rowsToBatch = useCallback((): BatchCreateRow[] => {
    return rows.map((r) => toBatchRow(r, defaults)).filter((r): r is BatchCreateRow => r !== null);
  }, [rows, defaults]);

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

  const filledCount = useMemo(
    () => rows.filter((r) => (r.description ?? "").trim().length > 0).length,
    [rows],
  );

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
      {/* Breadcrumb header */}
      <header className="flex items-end justify-between gap-3 pb-1">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/products" className="hover:text-foreground">
              Products
            </Link>
            <ChevronRightIcon className="size-3" aria-hidden />
            <span className="font-medium text-foreground">Batch add</span>
          </nav>
          <h1 className="mt-1.5 text-[22px] font-bold tracking-tight">
            Batch add items
            <span className="ml-2.5 text-sm font-normal tabular-nums text-muted-foreground">
              · {rows.length} row{rows.length === 1 ? "" : "s"} · {filledCount} filled
            </span>
          </h1>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/products" />}>
          Back to products
        </Button>
      </header>

      {refsError ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          Couldn&apos;t load vendor / department / tax lookups: {refsError}
        </div>
      ) : null}

      {/* Paste hint + hidden-column affordance */}
      <div className="flex items-center gap-2.5 border-b border-dashed pb-3 text-xs text-muted-foreground">
        <SparklesIcon className="size-3 text-primary" aria-hidden />
        <span>Tip — paste a range from Excel or Sheets. Tabs split columns; newlines split rows.</span>
        {hiddenCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px]">
            <EyeOffIcon className="size-3" aria-hidden />
            Pasting fills visible columns only
            <button
              type="button"
              onClick={resetCols}
              className="underline underline-offset-2 hover:text-foreground"
            >
              show all
            </button>
          </span>
        )}
      </div>

      {/* Toolbar → error strip → table flow as one seamless card. */}
      <div>
        <div className="grid items-center gap-3 rounded-t-lg border bg-card px-3.5 py-2.5 md:grid-cols-[auto_1fr_auto_auto_auto]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Apply to all
          </div>
          <ItemRefSelects
            refs={refs}
            vendorId={defaults.vendorId}
            dccId={defaults.dccId}
            itemTaxTypeId={defaults.itemTaxTypeId}
            disabled={refsLoading}
            bulkMode
            layout="inline"
            onChange={(field, value) => {
              setDefaults((d) => ({ ...d, [field]: value }));
              setLastValidated("dirty");
            }}
          />
          <div className="hidden h-5 w-px bg-border md:block" />
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => addRow(1)} disabled={refsLoading}>
              <PlusIcon className="mr-1 size-3.5" aria-hidden /> Add row
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addRow(5)} disabled={refsLoading}>
              +5
            </Button>
          </div>
          <ColumnsMenuButton
            state={colState}
            defs={COLUMNS}
            onToggle={toggleHidden}
            onReset={resetCols}
            hiddenCount={hiddenCount}
          />
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            aria-live="polite"
            className="flex flex-wrap items-center gap-2 border-x border-b border-destructive/25 bg-destructive/[0.04] px-3.5 py-2 text-xs"
          >
            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
              <AlertCircleIcon className="size-3.5" aria-hidden />
              {errors.length} issue{errors.length === 1 ? "" : "s"} to fix
            </span>
            <span className="text-muted-foreground">·</span>
            {errors.map((e, i) => (
              <button
                key={`${e.rowIndex}-${e.field}-${i}`}
                type="button"
                onClick={() => focusCell(e.rowIndex, e.field)}
                className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-card px-2 py-0.5 text-[11px] hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:outline-none"
              >
                <span className="font-mono text-muted-foreground">row {e.rowIndex + 1}</span>
                <span className="text-foreground">{e.message}</span>
              </button>
            ))}
          </div>
        )}

        {refsLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 rounded-b-lg border border-t-0 bg-muted/30 px-4 py-10 text-sm text-muted-foreground"
          >
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Loading vendor, department, and tax lookups…
          </div>
        ) : (
          <div className="overflow-hidden rounded-b-lg border border-t-0 bg-card">
          <div className="max-h-[62vh] overflow-auto">
            <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-sm">
              <colgroup>
                <col style={{ width: 34 }} />
                {visibleCols.map((c) => (
                  <col key={c.def.key} style={{ width: c.width }} />
                ))}
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr>
                  <Th className="pr-2 text-right" align="right">
                    #
                  </Th>
                  {visibleCols.map((c) => (
                    <ResizableTh
                      key={c.def.key}
                      label={c.def.label}
                      width={c.width}
                      align={
                        c.def.kind === "money" || c.def.kind === "margin" ? "right" : "left"
                      }
                      onResize={(w) => setWidth(c.def.key, w)}
                    />
                  ))}
                  <Th align="left" aria-label="Row actions" />
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {rows.map((row, rowIdx) => {
                  const margin = computeMargin(row.cost, row.retail);
                  return (
                    <tr key={rowIdx} className="even:bg-muted/20">
                      <td className="border-b border-border/55 px-2 py-1.5 text-right align-top text-xs tabular-nums text-muted-foreground">
                        <span className="inline-block pt-1.5">{rowIdx + 1}</span>
                      </td>
                      {visibleCols.map((c, colIdx) => {
                        const col = c.def;
                        if (col.kind === "margin") {
                          return (
                            <td
                              key={col.key}
                              className="border-b border-border/55 px-2 py-1.5 text-right align-top"
                            >
                              <MarginMeter margin={margin} />
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
                      <td className="border-b border-border/55 px-1 py-1.5 align-top">
                        <div className="flex items-center justify-end gap-0.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => duplicateRow(rowIdx)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Duplicate row"
                            aria-label={`Duplicate row ${rowIdx + 1}`}
                          >
                            <CopyIcon className="size-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(rowIdx)}
                            disabled={rows.length <= 1}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                            title="Delete row"
                            aria-label={`Delete row ${rowIdx + 1}`}
                          >
                            <Trash2Icon className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Sticky summary with stat blocks */}
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-4 rounded-xl border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <StatBlock label="Ready" value={batch.length} strong />
        <div className="h-6 w-px bg-border" />
        <StatBlock label="Total retail" value={`$${summary.totalRetail.toFixed(2)}`} />
        <StatBlock label="Total cost" value={`$${summary.totalCost.toFixed(2)}`} />
        {summary.avgMargin !== null ? (
          <StatBlock
            label="Avg margin"
            value={`${summary.avgMargin.toFixed(1)}%`}
            className={MARGIN_TONE_CLASS[toneForAvg(summary.avgMargin)]}
          />
        ) : null}
        {errors.length > 0 ? (
          <span className="text-xs text-destructive" aria-live="polite">
            {errors.length} error{errors.length === 1 ? "" : "s"}
          </span>
        ) : lastValidated === "clean" ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400" aria-live="polite">
            validated
          </span>
        ) : null}
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

function Th({
  children,
  align,
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-10 border-b bg-muted/70 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

function ResizableTh({
  label,
  width,
  align,
  onResize,
}: {
  label: string;
  width: number;
  align: "left" | "right";
  onResize: (width: number) => void;
}) {
  const startX = useRef(0);
  const startW = useRef(width);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startW.current = width;
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      onResize(startW.current + (ev.clientX - startX.current));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <th
      scope="col"
      className={cn(
        "relative sticky top-0 z-10 border-b bg-muted/70 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <span className="block truncate">{label}</span>
      <span
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} column`}
        className="absolute top-0 -right-[3px] bottom-0 z-20 flex w-[7px] cursor-col-resize items-stretch justify-center group"
      >
        <span
          className={cn(
            "my-[6px] w-[2px] rounded-sm transition-colors",
            dragging ? "bg-primary" : "bg-transparent group-hover:bg-primary/60",
          )}
        />
      </span>
    </th>
  );
}

function ColumnsMenuButton({
  state,
  defs,
  onToggle,
  onReset,
  hiddenCount,
}: {
  state: ColumnRuntimeState[];
  defs: BatchColumn[];
  onToggle: (key: string) => void;
  onReset: () => void;
  hiddenCount: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Columns3Icon className="mr-1 size-3.5" aria-hidden />
            Columns
            {hiddenCount > 0 && (
              <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {hiddenCount}
              </span>
            )}
            <ChevronDownIcon className="ml-0.5 size-3" aria-hidden />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-60 p-1.5">
        <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Columns</span>
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Reset
          </button>
        </div>
        {state.map((c) => {
          const def = defs.find((d) => d.key === c.key);
          if (!def) return null;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onToggle(c.key)}
              disabled={def.required}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Checkbox checked={!c.hidden} className="pointer-events-none" />
              <span className="flex-1">{def.label}</span>
              {def.required ? (
                <span className="text-[10px] text-muted-foreground">required</span>
              ) : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function MarginMeter({
  margin,
}: {
  margin: { pct: number | null; tone: MarginTone };
}) {
  if (margin.pct === null) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }
  const fill = Math.min(100, Math.max(0, margin.pct));
  return (
    <div className="inline-flex min-w-14 flex-col items-end gap-1">
      <span
        className={cn(
          "text-[11px] font-medium tabular-nums",
          MARGIN_TONE_CLASS[margin.tone],
        )}
      >
        {margin.pct.toFixed(1)}%
      </span>
      <div className="h-[3px] w-14 overflow-hidden rounded-sm bg-muted">
        <div
          className={cn("h-full rounded-sm", MARGIN_TONE_BG[margin.tone])}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  strong,
  className,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-bold" : "text-sm font-medium",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}

interface BatchCellProps {
  col: BatchColumn;
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

  const cellClass = cn(
    "border-b border-border/55 px-2 py-1.5 align-top",
    error && "bg-destructive/5",
  );

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
          type={isMoney ? "number" : "text"}
          step={isMoney ? "0.01" : undefined}
          min={isMoney ? "0" : undefined}
          inputMode={isMoney ? "decimal" : undefined}
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
