"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productApi } from "@/domains/product/api-client";
import type { BatchCreateRow, BatchValidationError } from "@/domains/product/types";

export function parsePastedGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.length > 0);
  return lines.map((l) => l.split("\t"));
}

const COLUMNS = [
  { key: "description", label: "Description", type: "text" as const, width: "min-w-60" },
  { key: "vendorId",    label: "Vendor ID",   type: "number" as const, width: "w-28" },
  { key: "dccId",       label: "DCC ID",      type: "number" as const, width: "w-32" },
  { key: "itemTaxTypeId", label: "Tax",       type: "number" as const, width: "w-20" },
  { key: "barcode",     label: "Barcode",     type: "text" as const, width: "w-40" },
  { key: "catalogNumber", label: "Catalog #", type: "text" as const, width: "w-32" },
  { key: "comment",     label: "Comment",     type: "text" as const, width: "w-32" },
  { key: "retail",      label: "Retail",      type: "number" as const, width: "w-24" },
  { key: "cost",        label: "Cost",        type: "number" as const, width: "w-24" },
];

interface GridRow {
  [key: string]: string;
}

function emptyRow(): GridRow {
  return Object.fromEntries(COLUMNS.map((c) => [c.key, ""])) as GridRow;
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

interface BatchAddGridProps {
  onSubmitted?: (skus: number[]) => void;
}

export function BatchAddGrid({ onSubmitted }: BatchAddGridProps) {
  const [rows, setRows] = useState<GridRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [useDefaults, setUseDefaults] = useState(true);
  const [errors, setErrors] = useState<BatchValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function updateCell(rowIdx: number, key: string, value: string) {
    setRows((r) => r.map((row, i) => (i === rowIdx ? { ...row, [key]: value } : row)));
    setErrors((e) => e.filter((err) => err.rowIndex !== rowIdx || err.field !== key));
  }

  function addRow() { setRows((r) => [...r, emptyRow()]); }

  function removeLastRow() {
    setRows((r) => r.length > 1 ? r.slice(0, -1) : r);
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={addRow} variant="outline" size="sm">Add row</Button>
        <Button onClick={removeLastRow} variant="outline" size="sm">Remove last</Button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useDefaults} onChange={(e) => setUseDefaults(e.target.checked)} />
          Use row 1 as defaults for blank cells
        </label>
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} rows</span>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`px-2 py-2 text-left font-medium ${c.width}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t">
                {COLUMNS.map((col, colIdx) => {
                  const err = cellError(rowIdx, col.key);
                  return (
                    <td key={col.key} className={`p-1 ${err ? "border-l-2 border-destructive" : ""}`} title={err ?? undefined}>
                      <Input
                        type={col.type}
                        step={col.type === "number" ? "0.01" : undefined}
                        value={row[col.key] ?? ""}
                        onPaste={(e) => onPaste(e, rowIdx, colIdx)}
                        onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                        className={`h-8 ${err ? "border-destructive" : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length > 0 ? (
        <p className="text-sm text-destructive">
          {errors.length} error{errors.length !== 1 ? "s" : ""} — fix before submitting.
        </p>
      ) : null}
      {toast ? <p className="text-sm text-green-700">{toast}</p> : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleValidate} disabled={submitting}>Validate</Button>
        <Button onClick={handleSubmit} disabled={submitting || errors.length > 0}>
          {submitting ? "Working…" : `Submit ${rowsToBatch().length} items`}
        </Button>
      </div>
    </div>
  );
}
