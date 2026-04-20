import type { BulkEditFieldId, BulkEditFieldPickerRequest, BulkEditFieldValue, BulkEditSourceRow } from "./types";
import type { InventoryPatchPerLocation, ProductEditPatchV2 } from "@/domains/product/types";
import type { ProductLocationId } from "@/domains/product/location-filters";

const INVENTORY_FIELD_IDS = new Set<BulkEditFieldId>([
  "retail",
  "cost",
  "expectedCost",
  "tagTypeId",
  "statusCodeId",
  "estSales",
  "fInvListPriceFlag",
  "fTxWantListFlag",
  "fTxBuybackListFlag",
  "fNoReturns",
]);

function hasOwnFieldValue(values: BulkEditFieldPickerRequest["values"], fieldId: BulkEditFieldId): boolean {
  return Object.prototype.hasOwnProperty.call(values, fieldId);
}

function isTextbookRow(row: BulkEditSourceRow): boolean {
  return row.itemType === "textbook" || row.itemType === "used_textbook";
}

function dedupeLocationIds(locationIds: Array<ProductLocationId | null | undefined>): ProductLocationId[] {
  const seen = new Set<ProductLocationId>();
  const result: ProductLocationId[] = [];

  for (const locationId of locationIds) {
    if (locationId == null || seen.has(locationId)) continue;
    seen.add(locationId);
    result.push(locationId);
  }

  return result;
}

function resolveInventoryTargets(row: BulkEditSourceRow, scope: BulkEditFieldPickerRequest["inventoryScope"]): ProductLocationId[] {
  if (typeof scope === "number") {
    return [scope];
  }

  const inventoryLocationIds = row.inventoryByLocation?.map((entry) => entry.locationId) ?? [];
  const primaryLocationId = row.primaryLocationId ?? inventoryLocationIds[0] ?? null;

  if (scope === "all") {
    return dedupeLocationIds([...inventoryLocationIds, primaryLocationId]);
  }

  if (scope === "primary" || scope === null) {
    return primaryLocationId == null ? [] : [primaryLocationId];
  }

  return [];
}

function getInventorySnapshot(row: BulkEditSourceRow, locationId: ProductLocationId) {
  const inventoryRow = row.inventoryByLocation?.find((entry) => entry.locationId === locationId);
  const isPrimaryLocation = row.primaryLocationId === locationId;

  return {
    retail: inventoryRow?.retail ?? (isPrimaryLocation ? row.retail : null),
    cost: inventoryRow?.cost ?? (isPrimaryLocation ? row.cost : null),
    expectedCost: inventoryRow?.expectedCost ?? null,
    tagTypeId: inventoryRow?.tagTypeId ?? null,
    statusCodeId: inventoryRow?.statusCodeId ?? null,
    estSales: inventoryRow?.estSales ?? null,
    estSalesLocked: inventoryRow?.estSalesLocked ?? false,
    fInvListPriceFlag: inventoryRow?.fInvListPriceFlag ?? false,
    fTxWantListFlag: inventoryRow?.fTxWantListFlag ?? false,
    fTxBuybackListFlag: inventoryRow?.fTxBuybackListFlag ?? false,
    fNoReturns: inventoryRow?.fNoReturns ?? false,
  };
}

function normalizeTextValue(value: BulkEditFieldValue): string | null | undefined {
  if (value == null) return null;
  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeRequiredTextValue(value: BulkEditFieldValue): string | undefined {
  if (value == null) return undefined;
  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNumberValue(value: BulkEditFieldValue): number | null | undefined {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return Number.isFinite(Number(value)) ? Number(value) : undefined;
}

function normalizeRequiredNumberValue(value: BulkEditFieldValue): number | undefined {
  const normalized = normalizeNumberValue(value);
  return normalized == null ? undefined : normalized;
}

function normalizeBooleanValue(value: BulkEditFieldValue): boolean | undefined {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "") return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }

  return Boolean(value);
}

function hasMeaningfulPatchValue(value: unknown): boolean {
  return value !== undefined;
}

function hasPatchFields<T extends object>(value: T): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

function setChangedField(changedFields: BulkEditFieldId[], fieldId: BulkEditFieldId): void {
  if (!changedFields.includes(fieldId)) {
    changedFields.push(fieldId);
  }
}

function applyInventoryPatchValue(
  entry: Partial<InventoryPatchPerLocation>,
  fieldId: BulkEditFieldId,
  value: BulkEditFieldValue,
): void {
  switch (fieldId) {
    case "retail":
    case "cost":
    case "expectedCost":
    case "tagTypeId":
    case "statusCodeId":
    case "estSales": {
      const normalized = normalizeNumberValue(value);
      if (normalized !== undefined) {
        entry[fieldId] = normalized;
      }
      break;
    }
    case "fInvListPriceFlag":
    case "fTxWantListFlag":
    case "fTxBuybackListFlag":
    case "fNoReturns":
      entry[fieldId] = normalizeBooleanValue(value);
      break;
  }
}

function applyFieldToPatch(
  row: BulkEditSourceRow,
  fieldId: BulkEditFieldId,
  value: BulkEditFieldValue,
  patch: {
    item: NonNullable<ProductEditPatchV2["item"]>;
    gm: NonNullable<ProductEditPatchV2["gm"]>;
    textbook: NonNullable<ProductEditPatchV2["textbook"]>;
    inventoryByLocation: Map<ProductLocationId, Partial<InventoryPatchPerLocation>>;
  },
  changedFields: BulkEditFieldId[],
  inventoryTargets: ProductLocationId[],
): void {
  const currentInventoryByLocation = new Map(
    (row.inventoryByLocation ?? []).map((entry) => [entry.locationId, entry] as const),
  );

  switch (fieldId) {
    case "barcode": {
      const currentValue = row.barcode;
      const nextValue = normalizeTextValue(value);
      if (nextValue !== undefined && nextValue !== currentValue) {
        patch.item.barcode = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    case "vendorId":
    case "dccId":
    case "itemTaxTypeId": {
      const currentValue = row[fieldId];
      const nextValue = normalizeRequiredNumberValue(value);
      if (nextValue !== undefined && nextValue !== currentValue) {
        patch.item[fieldId] = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    case "fDiscontinue": {
      const currentValue = row.fDiscontinue;
      const nextValue = normalizeBooleanValue(value) ? 1 : 0;
      if (nextValue !== currentValue) {
        patch.item.fDiscontinue = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    case "description": {
      const currentValue = row.description;
      const nextValue = normalizeRequiredTextValue(value);
      if (nextValue !== undefined && nextValue !== currentValue) {
        patch.gm.description = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    case "catalogNumber":
    case "packageType": {
      const currentValue = row[fieldId];
      const nextValue = normalizeTextValue(value);
      if (nextValue !== undefined && nextValue !== currentValue) {
        patch.gm[fieldId] = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    case "unitsPerPack": {
      const currentValue = row.unitsPerPack;
      const nextValue = normalizeRequiredNumberValue(value);
      if (nextValue !== undefined && nextValue !== currentValue) {
        patch.gm.unitsPerPack = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    case "title":
    case "author":
    case "isbn":
    case "edition": {
      if (!isTextbookRow(row)) {
        break;
      }

      const currentValue = row[fieldId];
      const nextValue = normalizeTextValue(value);
      if (nextValue !== undefined && nextValue !== currentValue) {
        patch.textbook[fieldId] = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    case "bindingId": {
      if (!isTextbookRow(row)) {
        break;
      }

      const currentValue = row.bindingId ?? null;
      const nextValue = normalizeNumberValue(value);
      if (nextValue !== undefined && nextValue !== currentValue) {
        patch.textbook.bindingId = nextValue;
        setChangedField(changedFields, fieldId);
      }
      break;
    }
    default: {
      if (!INVENTORY_FIELD_IDS.has(fieldId)) {
        break;
      }

      for (const locationId of inventoryTargets) {
        const currentInventory = currentInventoryByLocation.get(locationId);
        const entry = patch.inventoryByLocation.get(locationId) ?? { locationId };
        const before = currentInventory ?? getInventorySnapshot(row, locationId);
        applyInventoryPatchValue(entry, fieldId, value);

        const nextValue = entry[fieldId as keyof InventoryPatchPerLocation];
        const currentValue = before[fieldId as keyof typeof before];

        if (hasMeaningfulPatchValue(nextValue) && nextValue !== currentValue) {
          patch.inventoryByLocation.set(locationId, entry);
          setChangedField(changedFields, fieldId);
        }
      }
    }
  }
}

export function buildBulkPatchForRow(
  row: BulkEditSourceRow,
  transform: BulkEditFieldPickerRequest,
): { patch: ProductEditPatchV2; changedFields: BulkEditFieldId[] } {
  const selectedFieldIds = Array.from(new Set(transform.fieldIds));
  const changedFields: BulkEditFieldId[] = [];
  const patch = {
    item: {} as NonNullable<ProductEditPatchV2["item"]>,
    gm: {} as NonNullable<ProductEditPatchV2["gm"]>,
    textbook: {} as NonNullable<ProductEditPatchV2["textbook"]>,
    inventoryByLocation: new Map<ProductLocationId, Partial<InventoryPatchPerLocation>>(),
  };

  const inventoryTargets = resolveInventoryTargets(row, transform.inventoryScope);

  for (const fieldId of selectedFieldIds) {
    const hasValue = hasOwnFieldValue(transform.values, fieldId);
    if (!hasValue) continue;

    const value = transform.values[fieldId];
    if (value === undefined) continue;

    applyFieldToPatch(row, fieldId, value, patch, changedFields, inventoryTargets);
  }

  const inventory = Array.from(patch.inventoryByLocation.values()).filter((entry) => Object.keys(entry).length > 1);

  return {
    patch: {
      item: hasPatchFields(patch.item) ? patch.item : undefined,
      gm: hasPatchFields(patch.gm) ? patch.gm : undefined,
      textbook: hasPatchFields(patch.textbook) ? patch.textbook : undefined,
      inventory: inventory.length > 0 ? (inventory as InventoryPatchPerLocation[]) : undefined,
    },
    changedFields,
  };
}
