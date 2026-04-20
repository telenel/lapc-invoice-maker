"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { productApi } from "@/domains/product/api-client";
import type { ProductLocationId } from "@/domains/product/location-filters";

export type ProductInlineEditableField =
  | "cost"
  | "retail"
  | "barcode"
  | "taxType"
  | "discontinue";

export interface ProductInlineEditCell {
  sku: number;
  field: ProductInlineEditableField;
}

export interface ProductInlineEditRowBaseline {
  sku: number;
  barcode: string | null;
  itemTaxTypeId: number | null;
  retail: number | null;
  cost: number | null;
  fDiscontinue: 0 | 1;
}

interface PendingInlineNavigation {
  activeCell: ProductInlineEditCell;
  direction: "next" | "previous";
  fieldOrder: readonly ProductInlineEditableField[];
  rowOrderSnapshot: readonly number[];
  savedValue: string | null;
  waitForFreshRows: boolean;
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
  saveField: (
    sku: number,
    field: ProductInlineEditableField,
    value: string,
  ) => Promise<boolean>;
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
    case "taxType":
      return row.itemTaxTypeId == null ? "" : String(row.itemTaxTypeId);
    case "discontinue":
      return row.fDiscontinue ? "1" : "0";
  }
}

function normalizeDraftValue(field: ProductInlineEditableField, rawValue: string): string | null {
  const currentValue = rawValue.trim();

  switch (field) {
    case "retail":
    case "cost": {
      if (currentValue.length === 0) return null;
      const parsed = Number(currentValue);
      return Number.isNaN(parsed) ? null : String(parsed);
    }
    case "barcode":
      return currentValue.length === 0 ? "" : currentValue;
    case "taxType": {
      if (currentValue.length === 0) return null;
      const parsed = Number(currentValue);
      return Number.isNaN(parsed) || parsed <= 0 ? null : String(parsed);
    }
    case "discontinue":
      return currentValue === "1" || currentValue.toLowerCase() === "true" ? "1" : "0";
  }
}

function hasSameRowOrder(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function setOverlayValue<Key extends keyof ProductInlineEditRowBaseline>(
  target: Partial<ProductInlineEditRowBaseline>,
  key: Key,
  value: ProductInlineEditRowBaseline[Key],
) {
  target[key] = value;
}

function buildBaseline(row: ProductInlineEditRowBaseline): Pick<
  ProductInlineEditRowBaseline,
  "sku" | "barcode" | "itemTaxTypeId" | "retail" | "cost" | "fDiscontinue"
> {
  return {
    sku: row.sku,
    barcode: row.barcode,
    itemTaxTypeId: row.itemTaxTypeId,
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
  const [pendingNavigation, setPendingNavigation] = useState<PendingInlineNavigation | null>(null);
  const [optimisticRowsBySku, setOptimisticRowsBySku] = useState<
    Map<number, Partial<ProductInlineEditRowBaseline>>
  >(new Map());

  const baseRowsBySku = useMemo(
    () => new Map(rows.map((row) => [row.sku, row] as const)),
    [rows],
  );

  const rowOrder = useMemo(() => rows.map((row) => row.sku), [rows]);
  const [activeFieldOrder, setActiveFieldOrder] = useState<readonly ProductInlineEditableField[]>(EDITABLE_FIELD_ORDER);

  useEffect(() => {
    setOptimisticRowsBySku((current) => {
      if (current.size === 0) return current;

      let changed = false;
      const next = new Map<number, Partial<ProductInlineEditRowBaseline>>();
      current.forEach((overlay, sku) => {
        const baseRow = baseRowsBySku.get(sku);
        if (!baseRow) {
          changed = true;
          return;
        }

        const pendingOverlay: Partial<ProductInlineEditRowBaseline> = {};
        (Object.keys(overlay) as Array<keyof ProductInlineEditRowBaseline>).forEach((key) => {
          const overlayValue = overlay[key];
          if (overlayValue !== undefined && overlayValue !== baseRow[key]) {
            setOverlayValue(pendingOverlay, key, overlayValue);
          }
        });

        if (Object.keys(pendingOverlay).length > 0) {
          next.set(sku, pendingOverlay);
          return;
        }

        changed = true;
      });

      return changed ? next : current;
    });
  }, [baseRowsBySku]);

  const rowsBySku = useMemo(() => {
    const merged = new Map(baseRowsBySku);
    optimisticRowsBySku.forEach((overlay, sku) => {
      const baseRow = merged.get(sku);
      if (!baseRow) return;
      merged.set(sku, { ...baseRow, ...overlay });
    });
    return merged;
  }, [baseRowsBySku, optimisticRowsBySku]);

  const startEdit = useCallback(
    (
      sku: number,
      field: ProductInlineEditableField,
      currentValue: string,
      fieldOrder?: readonly ProductInlineEditableField[],
    ) => {
      if (pendingSave) return;
      setPendingNavigation(null);
      setActiveFieldOrder(normalizeFieldOrder(field, fieldOrder));
      setEditingCell({ sku, field });
      setDraftValue(currentValue);
    },
    [pendingSave],
  );

  const cancelEdit = useCallback(() => {
    if (pendingSave) return;
    setPendingNavigation(null);
    setEditingCell(null);
    setDraftValue("");
  }, [pendingSave]);

  const persistField = useCallback(async (
    sku: number,
    field: ProductInlineEditableField,
    rawValue: string,
  ) => {
    if (pendingSave) return false;

    const row = rowsBySku.get(sku);
    if (!row) {
      return true;
    }

    const baseline = buildBaseline(row);
    const currentValue = rawValue.trim();
    const originalValue = getCellValue(row, field);

    if (currentValue === originalValue) {
      return true;
    }

    let patch: Parameters<typeof productApi.update>[1];

    switch (field) {
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
      case "taxType": {
        const parsed = Number(currentValue);
        if (currentValue.length === 0 || Number.isNaN(parsed) || parsed <= 0) {
          toast.error("Select a valid tax type.");
          return false;
        }
        patch = {
          mode: "v2",
          patch: {
            item: {
              itemTaxTypeId: parsed,
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
      await productApi.update(sku, patch);
      await onSaveSuccess?.();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save changes.");
      return false;
    } finally {
      setPendingSave(false);
    }
  }, [onSaveSuccess, pendingSave, rowsBySku]);

  const saveCurrentEdit = useCallback(async () => {
    const activeCell = editingCell;
    if (!activeCell || pendingSave) return false;

    const committed = await persistField(activeCell.sku, activeCell.field, draftValue);
    if (committed) {
      setEditingCell(null);
      setDraftValue("");
    }
    return committed;
  }, [draftValue, editingCell, pendingSave, persistField]);

  useEffect(() => {
    if (!pendingNavigation || pendingSave || editingCell) return;

    if (pendingNavigation.waitForFreshRows) {
      const rowOrderChanged = !hasSameRowOrder(rowOrder, pendingNavigation.rowOrderSnapshot);
      const refreshedRow = rowsBySku.get(pendingNavigation.activeCell.sku);
      const refreshedValue = refreshedRow
        ? getCellValue(refreshedRow, pendingNavigation.activeCell.field)
        : null;

      if (!rowOrderChanged && refreshedValue !== pendingNavigation.savedValue) {
        return;
      }
    }

    const fieldOrder = normalizeFieldOrder(
      pendingNavigation.activeCell.field,
      pendingNavigation.fieldOrder,
    );
    const rowIndex = rowOrder.indexOf(pendingNavigation.activeCell.sku);
    const fieldIndex = fieldOrder.indexOf(pendingNavigation.activeCell.field);

    setPendingNavigation(null);
    if (rowIndex === -1 || fieldIndex === -1) return;

    let nextCell: ProductInlineEditCell | null = null;
    if (pendingNavigation.direction === "next") {
      const nextField = fieldOrder[fieldIndex + 1];
      if (nextField) {
        nextCell = { sku: pendingNavigation.activeCell.sku, field: nextField };
      } else {
        const nextSku = rowOrder[rowIndex + 1];
        if (nextSku != null) {
          nextCell = { sku: nextSku, field: fieldOrder[0] };
        }
      }
    } else {
      const prevField = fieldOrder[fieldIndex - 1];
      if (prevField) {
        nextCell = { sku: pendingNavigation.activeCell.sku, field: prevField };
      } else {
        const prevSku = rowOrder[rowIndex - 1];
        if (prevSku != null) {
          nextCell = { sku: prevSku, field: fieldOrder[fieldOrder.length - 1] };
        }
      }
    }

    if (!nextCell) return;
    const nextRow = rowsBySku.get(nextCell.sku);
    if (!nextRow) return;

    setActiveFieldOrder(fieldOrder);
    setEditingCell(nextCell);
    setDraftValue(getCellValue(nextRow, nextCell.field));
  }, [editingCell, pendingNavigation, pendingSave, rowOrder, rowsBySku]);

  const saveField = useCallback(async (
    sku: number,
    field: ProductInlineEditableField,
    value: string,
  ) => {
    let optimisticOverlay: Partial<ProductInlineEditRowBaseline> | null = null;
    if (field === "taxType") {
      const parsed = Number(value);
      if (value.length > 0 && Number.isFinite(parsed) && parsed > 0) {
        optimisticOverlay = { itemTaxTypeId: parsed };
      }
    } else if (field === "discontinue") {
      optimisticOverlay = {
        fDiscontinue: value === "1" || value.toLowerCase() === "true" ? 1 : 0,
      };
    }

    if (optimisticOverlay) {
      setOptimisticRowsBySku((current) => {
        const next = new Map(current);
        next.set(sku, { ...(next.get(sku) ?? {}), ...optimisticOverlay });
        return next;
      });
    }

    const committed = await persistField(sku, field, value);
    if (committed && editingCell?.sku === sku && editingCell.field === field) {
      setEditingCell(null);
      setDraftValue("");
    }
    if (!committed && optimisticOverlay) {
      setOptimisticRowsBySku((current) => {
        const next = new Map(current);
        const existing = next.get(sku);
        if (!existing) return current;

        const reverted = { ...existing };
        (Object.keys(optimisticOverlay) as Array<keyof ProductInlineEditRowBaseline>).forEach((key) => {
          delete reverted[key];
        });

        if (Object.keys(reverted).length === 0) {
          next.delete(sku);
        } else {
          next.set(sku, reverted);
        }

        return next;
      });
    }
    return committed;
  }, [editingCell, persistField]);

  const moveToNextEditableCell = useCallback(
    async (direction: "next" | "previous") => {
      const activeCell = editingCell;
      if (!activeCell) return;

      const fieldOrder = activeFieldOrder;
      const fieldIndex = fieldOrder.indexOf(activeCell.field);
      if (fieldIndex === -1) return;

      const currentRow = rowsBySku.get(activeCell.sku);
      const originalValue = currentRow
        ? getCellValue(currentRow, activeCell.field)
        : draftValue.trim();
      const savedValue = normalizeDraftValue(activeCell.field, draftValue);
      const waitForFreshRows =
        ((direction === "next" && fieldOrder[fieldIndex + 1] == null)
          || (direction === "previous" && fieldOrder[fieldIndex - 1] == null))
        && savedValue != null
        && savedValue !== originalValue;

      const committed = await saveCurrentEdit();
      if (!committed) {
        setPendingNavigation(null);
        return;
      }

      setPendingNavigation({
        activeCell,
        direction,
        fieldOrder,
        rowOrderSnapshot: rowOrder,
        savedValue,
        waitForFreshRows,
      });
    },
    [activeFieldOrder, draftValue, editingCell, rowOrder, rowsBySku, saveCurrentEdit],
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
    saveField,
    moveToNextEditableCell,
    setDraftValue,
  };
}
