"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { productApi } from "@/domains/product/api-client";
import type { ProductLocationId } from "@/domains/product/location-filters";

export type ProductInlineEditableField =
  | "cost"
  | "retail"
  | "barcode"
  | "discontinue";

export interface ProductInlineEditCell {
  sku: number;
  field: ProductInlineEditableField;
}

export interface ProductInlineEditRowBaseline {
  sku: number;
  barcode: string | null;
  retail: number | null;
  cost: number | null;
  fDiscontinue: 0 | 1;
}

export interface ProductInlineEditController {
  editingCell: ProductInlineEditCell | null;
  draftValue: string;
  pendingSave: boolean;
  primaryLocationId: ProductLocationId;
  rowsBySku: Map<number, ProductInlineEditRowBaseline>;
  startEdit: (
    sku: number,
    field: ProductInlineEditableField,
    currentValue: string,
    fieldOrder?: readonly ProductInlineEditableField[],
  ) => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;
  moveToNextEditableCell: (direction: "next" | "previous") => Promise<void>;
  setDraftValue: (value: string) => void;
}

const EDITABLE_FIELD_ORDER: ProductInlineEditableField[] = [
  "cost",
  "retail",
  "barcode",
];

function normalizeFieldOrder(
  field: ProductInlineEditableField,
  fieldOrder?: readonly ProductInlineEditableField[],
): readonly ProductInlineEditableField[] {
  if (!fieldOrder || fieldOrder.length === 0) return EDITABLE_FIELD_ORDER;

  const uniqueFields = fieldOrder.filter((candidate, index) => fieldOrder.indexOf(candidate) === index);
  if (!uniqueFields.includes(field)) return EDITABLE_FIELD_ORDER;
  return uniqueFields;
}

function getCellValue(row: ProductInlineEditRowBaseline, field: ProductInlineEditableField): string {
  switch (field) {
    case "cost":
      return row.cost == null ? "" : String(row.cost);
    case "retail":
      return row.retail == null ? "" : String(row.retail);
    case "barcode":
      return row.barcode ?? "";
    case "discontinue":
      return row.fDiscontinue ? "1" : "0";
  }
}

function buildBaseline(row: ProductInlineEditRowBaseline): Pick<
  ProductInlineEditRowBaseline,
  "sku" | "barcode" | "retail" | "cost" | "fDiscontinue"
> {
  return {
    sku: row.sku,
    barcode: row.barcode,
    retail: row.retail,
    cost: row.cost,
    fDiscontinue: row.fDiscontinue,
  };
}

export interface UseProductInlineEditArgs {
  rows: ProductInlineEditRowBaseline[];
  primaryLocationId: ProductLocationId;
  onSaveSuccess?: () => void | Promise<void>;
}

export function useProductInlineEdit({
  rows,
  primaryLocationId,
  onSaveSuccess,
}: UseProductInlineEditArgs): ProductInlineEditController {
  const [editingCell, setEditingCell] = useState<ProductInlineEditCell | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [pendingSave, setPendingSave] = useState(false);

  const rowsBySku = useMemo(
    () => new Map(rows.map((row) => [row.sku, row] as const)),
    [rows],
  );

  const rowOrder = useMemo(() => rows.map((row) => row.sku), [rows]);
  const [activeFieldOrder, setActiveFieldOrder] = useState<readonly ProductInlineEditableField[]>(EDITABLE_FIELD_ORDER);

  const startEdit = useCallback(
    (
      sku: number,
      field: ProductInlineEditableField,
      currentValue: string,
      fieldOrder?: readonly ProductInlineEditableField[],
    ) => {
      if (pendingSave) return;
      setActiveFieldOrder(normalizeFieldOrder(field, fieldOrder));
      setEditingCell({ sku, field });
      setDraftValue(currentValue);
    },
    [pendingSave],
  );

  const cancelEdit = useCallback(() => {
    if (pendingSave) return;
    setEditingCell(null);
    setDraftValue("");
  }, [pendingSave]);

  const saveCurrentEdit = useCallback(async () => {
    const activeCell = editingCell;
    if (!activeCell || pendingSave) return false;

    const row = rowsBySku.get(activeCell.sku);
    if (!row) {
      setEditingCell(null);
      setDraftValue("");
      return true;
    }

    const baseline = buildBaseline(row);
    const currentValue = draftValue.trim();
    const originalValue = getCellValue(row, activeCell.field);

    if (currentValue === originalValue) {
      setEditingCell(null);
      setDraftValue("");
      return true;
    }

    let patch: Parameters<typeof productApi.update>[1];

    switch (activeCell.field) {
      case "retail": {
        const parsed = Number(currentValue);
        if (currentValue.length === 0 || Number.isNaN(parsed)) {
          toast.error("Enter a valid retail price.");
          return false;
        }
        patch = {
          mode: "v2",
          patch: {
            primaryInventory: {
              retail: parsed,
            },
          },
          baseline,
        };
        break;
      }
      case "cost": {
        const parsed = Number(currentValue);
        if (currentValue.length === 0 || Number.isNaN(parsed)) {
          toast.error("Enter a valid cost.");
          return false;
        }
        patch = {
          mode: "v2",
          patch: {
            primaryInventory: {
              cost: parsed,
            },
          },
          baseline,
        };
        break;
      }
      case "barcode": {
        patch = {
          mode: "v2",
          patch: {
            item: {
              barcode: currentValue.length === 0 ? null : currentValue,
            },
          },
          baseline,
        };
        break;
      }
      case "discontinue": {
        const normalized = currentValue === "1" || currentValue.toLowerCase() === "true" ? 1 : 0;
        patch = {
          mode: "v2",
          patch: {
            item: {
              fDiscontinue: normalized,
            },
          },
          baseline,
        };
        break;
      }
      default: {
        return false;
      }
    }

    setPendingSave(true);
    try {
      await productApi.update(activeCell.sku, patch);
      setEditingCell(null);
      setDraftValue("");
      await onSaveSuccess?.();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save changes.");
      return false;
    } finally {
      setPendingSave(false);
    }
  }, [draftValue, editingCell, onSaveSuccess, pendingSave, rowsBySku]);

  const moveToNextEditableCell = useCallback(
    async (direction: "next" | "previous") => {
      const activeCell = editingCell;
      if (!activeCell) return;

      const committed = await saveCurrentEdit();
      if (!committed) return;

      const rowIndex = rowOrder.indexOf(activeCell.sku);
      if (rowIndex === -1) return;

      const fieldIndex = activeFieldOrder.indexOf(activeCell.field);
      if (fieldIndex === -1) return;

      let nextCell: ProductInlineEditCell | null = null;
      if (direction === "next") {
        const nextField = activeFieldOrder[fieldIndex + 1];
        if (nextField) {
          nextCell = { sku: activeCell.sku, field: nextField };
        } else {
          const nextSku = rowOrder[rowIndex + 1];
          if (nextSku != null) {
            nextCell = { sku: nextSku, field: activeFieldOrder[0] };
          }
        }
      } else {
        const prevField = activeFieldOrder[fieldIndex - 1];
        if (prevField) {
          nextCell = { sku: activeCell.sku, field: prevField };
        } else {
          const prevSku = rowOrder[rowIndex - 1];
          if (prevSku != null) {
            nextCell = { sku: prevSku, field: activeFieldOrder[activeFieldOrder.length - 1] };
          }
        }
      }

      if (!nextCell) return;
      const nextRow = rowsBySku.get(nextCell.sku);
      if (!nextRow) return;

      setEditingCell(nextCell);
      setDraftValue(getCellValue(nextRow, nextCell.field));
    },
    [activeFieldOrder, editingCell, rowsBySku, rowOrder, saveCurrentEdit],
  );

  const commitEdit = useCallback(async () => {
    await saveCurrentEdit();
  }, [saveCurrentEdit]);

  return {
    editingCell,
    draftValue,
    pendingSave,
    primaryLocationId,
    rowsBySku,
    startEdit,
    cancelEdit,
    commitEdit,
    moveToNextEditableCell,
    setDraftValue,
  };
}
