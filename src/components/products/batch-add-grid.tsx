"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { BatchCreateRow, BatchValidationError } from "@/domains/product/types";

export function parsePastedGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.length > 0);
  return lines.map((l) => l.split("\t"));
}

type ColumnKind = "text" | "number" | "ref";
type RefKind = "vendor" | "dcc" | "tax";

interface ColumnDef {
  key: string;
  label: string;
  kind: ColumnKind;
  /** Only set when kind="ref" */
  ref?: RefKind;
  width: string;
  placeholder?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "description",   label: "Description",          kind: "text",   width: "min-w-60",   placeholder: "PIERCE LOGO MUG 12OZ…" },
  { key: "vendorId",      label: "Vendor",               kind: "ref", ref: "vendor", width: "min-w-48" },
  { key: "dccId",         label: "Department / Class",   kind: "ref", ref: "dcc",    width: "min-w-56" },
  { key: "itemTaxTypeId", label: "Tax",                  kind: "ref", ref: "tax",    width: "min-w-44" },
  { key: "barcode",       label: "Barcode",              kind: "text",   width: "w-40",       placeholder: "UPC…" },
  { key: "catalogNumber", label: "Catalog #",            kind: "text",   width: "w-32",       placeholder: "vendor part #" },
  { key: "comment",       label: "Comment",              kind: "text",   width: "w-32",       placeholder: "note…" },
  { key: "retail",        label: "Retail",               kind: "number", width: "w-24",       placeholder: "0.00" },
  { key: "cost",          label: "Cost",                 kind: "number", width: "w-24",       placeholder: "0.00" },
];

const NUMERIC_NON_MONEY = new Set(["vendorId", "dccId", "itemTaxTypeId"]);

interface GridRow {
  [key: string]: string;
}

function emptyRow(defaults?: Record<string, string | undefined>): GridRow {
  const base: GridRow = Object.fromEntries(COLUMNS.map((c) => [c.key, ""])) as GridRow;
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

/**
 * Build the list of options for a ref column, combining the current cell
 * value with the available refs. If the cell has a value that isn't in the
 * refs (e.g. pasted an unknown ID), it's still shown as "Unknown (id)" so
 * the user can see what they typed and correct it.
 */
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
  // Surface unknown value so user sees what's set
  if (currentValue && !options.some((o) => o.value === currentValue)) {
    options.unshift({ value: currentValue, label: `Unknown (${currentValue})` });
  }
  return options;
}

interface BatchAddGridProps {
  onSubmitted?: (skus: number[]) => void;
}

export function BatchAddGrid({ onSubmitted }: BatchAddGridProps) {
  const [refs, setRefs] = useState<PrismRefs | null>(null);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [rows, setRows] = useState<GridRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [useDefaults, setUseDefaults] = useState(true);
  const [errors, setErrors] = useState<BatchValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    productApi
      .refs()
      .then((r) => {
        setRefs(r);
        // Default tax to "9.75% CA Sales Tax" (id 6) on each row if the user
        // hasn't set it yet — matches the default in the single-item dialog.
        setRows((prev) =>
          prev.map((row) => (row.itemTaxTypeId ? row : { ...row, itemTaxTypeId: "6" })),
        );
      })
      .catch((err) => setRefsError(err instanceof Error ? err.message : String(err)));
  }, []);

  function updateCell(rowIdx: number, key: string, value: string) {
    setRows((r) => r.map((row, i) => (i === rowIdx ? { ...row, [key]: value } : row)));
    setErrors((e) => e.filter((err) => err.rowIndex !== rowIdx || err.field !== key));
  }

  function addRow() {
    setRows((r) => {
      // Carry the last-row's vendor/DCC/tax as defaults — removes re-selection
      // fatigue when adding many items from the same vendor/category.
      const last = r[r.length - 1];
      return [
        ...r,
        emptyRow({
          vendorId: last?.vendorId ?? "",
          dccId: last?.dccId ?? "",
          itemTaxTypeId: last?.itemTaxTypeId ?? "6",
        }),
      ];
    });
  }

  function removeLastRow() {
    setRows((r) => (r.length > 1 ? r.slice(0, -1) : r));
  }

  function onPaste(e: React.ClipboardEvent<HTMLElement>, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // single cell paste — let default
    e.preventDefault();
    const grid = parsePastedGrid(text);
    setRows((existing) => {
      const next = [...existing];
      for (let i = 0; i < grid.length; i++) {
        const targetIdx = rowIdx + i;
        if (targetIdx >= next.length) next.push(emptyRow());
        const target = { ...next[targetIdx] };
        for (let j = 0; j < grid[i].length; j++) {
          const targetCol = COLUMNS[colIdx + j];
          if (!targetCol) break;
          target[targetCol.key] = grid[i][j];
        }
        next[targetIdx] = target;
      }
      return next;
    });
  }

  function rowsToBatch(): BatchCreateRow[] {
    const defaults = useDefaults ? rows[0] : undefined;
    return rows.map((r) => toBatchRow(r, defaults)).filter((r): r is BatchCreateRow => r !== null);
  }

  async function handleValidate() {
    setSubmitting(true);
    try {
      const batch = rowsToBatch();
      const result = await productApi.validateBatch({ action: "create", rows: batch });
      setErrors(result.errors);
      setToast(result.errors.length === 0 ? "No errors — ready to submit" : null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrors([]);
    try {
      const batch = rowsToBatch();
      const result = await productApi.batch({ action: "create", rows: batch });
      if ("errors" in result && result.errors.length > 0) {
        setErrors(result.errors);
        return;
      }
      if ("count" in result) {
        onSubmitted?.(result.skus);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function cellError(rowIdx: number, key: string): string | null {
    const e = errors.find((x) => x.rowIndex === rowIdx && x.field === key);
    return e ? e.message : null;
  }

  const batchCount = rowsToBatch().length;
  const refsLoading = refs === null && !refsError;
  const selectClass =
    "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "dark:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4">
      {refsError ? (
        <div role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Couldn&apos;t load vendor / department / tax lookups: {refsError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={addRow} variant="outline" size="sm" disabled={refsLoading}>Add Row</Button>
        <Button onClick={removeLastRow} variant="outline" size="sm" disabled={refsLoading}>Remove Last Row</Button>
        <label className="flex items-center gap-2 text-sm" title="When on, any cell you leave blank in rows 2+ is filled at submit time with the value from row 1 in the same column.">
          <input
            type="checkbox"
            checked={useDefaults}
            onChange={(e) => setUseDefaults(e.target.checked)}
          />
          Copy row 1 into blank cells on submit
        </label>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {refsLoading ? (
        <div role="status" aria-live="polite" className="rounded border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Loading vendor, department, and tax lookups…
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto rounded border max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th scope="col" className="sticky left-0 z-20 bg-muted px-2 py-2 text-right font-medium text-muted-foreground w-10">#</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className={`px-2 py-2 text-left font-medium ${c.width}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-t">
                  <td className="sticky left-0 bg-background px-2 py-1 text-right text-xs tabular-nums text-muted-foreground">
                    {rowIdx + 1}
                  </td>
                  {COLUMNS.map((col, colIdx) => {
                    const err = cellError(rowIdx, col.key);
                    const cellId = `batch-${rowIdx}-${col.key}`;
                    const errId = `${cellId}-err`;
                    const isMoney = col.key === "retail" || col.key === "cost";
                    const commonAria = {
                      "aria-label": `${col.label} for row ${rowIdx + 1}`,
                      "aria-invalid": err ? (true as const) : undefined,
                      "aria-errormessage": err ? errId : undefined,
                    };

                    return (
                      <td key={col.key} className={`p-1 ${err ? "border-l-2 border-destructive" : ""}`}>
                        {col.kind === "ref" && col.ref ? (
                          <select
                            id={cellId}
                            name={col.key}
                            {...commonAria}
                            value={row[col.key] ?? ""}
                            onPaste={(e) => onPaste(e, rowIdx, colIdx)}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            className={`${selectClass} ${err ? "border-destructive" : ""}`}
                          >
                            <option value="">Select…</option>
                            {refOptions(col.ref, refs, row[col.key] ?? "").map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={cellId}
                            name={col.key}
                            {...commonAria}
                            autoComplete="off"
                            spellCheck={false}
                            type={col.kind === "number" ? "number" : "text"}
                            step={col.kind === "number" ? "0.01" : undefined}
                            min={NUMERIC_NON_MONEY.has(col.key) || isMoney ? "0" : undefined}
                            inputMode={col.kind === "number" ? "decimal" : undefined}
                            placeholder={col.placeholder}
                            value={row[col.key] ?? ""}
                            onPaste={(e) => onPaste(e, rowIdx, colIdx)}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            className={`h-8 ${isMoney ? "tabular-nums" : ""} ${err ? "border-destructive" : ""}`}
                          />
                        )}
                        {err ? (
                          <span id={errId} className="sr-only">{err}</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div aria-live="polite" className="min-h-[1.25rem] text-sm">
        {errors.length > 0 ? (
          <span className="text-destructive">
            {errors.length} error{errors.length === 1 ? "" : "s"} — fix the red cells and re-validate.
          </span>
        ) : toast ? (
          <span className="text-emerald-700 dark:text-emerald-400">{toast}</span>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleValidate} disabled={submitting || refsLoading}>Validate</Button>
        <Button onClick={handleSubmit} disabled={submitting || refsLoading || errors.length > 0 || batchCount === 0}>
          {submitting ? "Working…" : batchCount === 0 ? "Nothing to submit" : `Submit ${batchCount} Item${batchCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
