import { bulkEditFieldRegistry } from "./field-registry";
import { buildBulkPatchForRow } from "./patch-builder";
import { applyTransform } from "./transform-engine";
import { buildProductRefMaps, EMPTY_REFS, type PrismRefs } from "@/domains/product/ref-data";
import type { ProductLocationId } from "@/domains/product/location-filters";
import type { InventoryPatchPerLocation, ProductEditPatchV2 } from "@/domains/product/types";
import type {
  BulkEditFieldId,
  BulkEditFieldPickerRequest,
  BulkEditFieldPreview,
  BulkEditFieldPreviewCell,
  BulkEditFieldPreviewRow,
  BulkEditSourceRow,
  BulkEditTransform,
  PreviewResult,
  PreviewWarning,
} from "./types";

function dedupeFieldIds(fieldIds: BulkEditFieldId[]): BulkEditFieldId[] {
  return Array.from(new Set(fieldIds));
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
    fInvListPriceFlag: inventoryRow?.fInvListPriceFlag ?? false,
    fTxWantListFlag: inventoryRow?.fTxWantListFlag ?? false,
    fTxBuybackListFlag: inventoryRow?.fTxBuybackListFlag ?? false,
    fNoReturns: inventoryRow?.fNoReturns ?? false,
  };
}

function hasOwnPatchField<T extends object, K extends keyof T>(patch: T | undefined, key: K): boolean {
  return patch !== undefined && Object.prototype.hasOwnProperty.call(patch, key);
}

function getPatchedInventoryEntry(
  patch: ProductEditPatchV2,
  locationId: ProductLocationId,
): InventoryPatchPerLocation | undefined {
  return patch.inventory?.find((entry) => entry.locationId === locationId);
}

function getInventoryFieldValueForLocation(
  row: BulkEditSourceRow,
  patch: ProductEditPatchV2,
  fieldId:
    | "retail"
    | "cost"
    | "expectedCost"
    | "tagTypeId"
    | "statusCodeId"
    | "estSales"
    | "fInvListPriceFlag"
    | "fTxWantListFlag"
    | "fTxBuybackListFlag"
    | "fNoReturns",
  locationId: ProductLocationId,
): unknown {
  const patchedEntry = getPatchedInventoryEntry(patch, locationId);
  if (patchedEntry && hasOwnPatchField(patchedEntry, fieldId)) {
    return patchedEntry[fieldId] ?? null;
  }

  const inventorySnapshot = getInventorySnapshot(row, locationId);
  return inventorySnapshot[fieldId];
}

function formatInventoryFieldLabel(
  row: BulkEditSourceRow,
  patch: ProductEditPatchV2,
  fieldId:
    | "retail"
    | "cost"
    | "expectedCost"
    | "tagTypeId"
    | "statusCodeId"
    | "estSales"
    | "fInvListPriceFlag"
    | "fTxWantListFlag"
    | "fTxBuybackListFlag"
    | "fNoReturns",
  inventoryTargets: ProductLocationId[],
  refs: ReturnType<typeof buildProductRefMaps>,
): { beforeLabel: string; afterLabel: string } {
  const beforeParts: string[] = [];
  const afterParts: string[] = [];

  for (const locationId of inventoryTargets) {
    const beforeValue = getInventorySnapshot(row, locationId)[fieldId];
    const afterValue = getInventoryFieldValueForLocation(row, patch, fieldId, locationId);
    const prefix = `${locationId}: `;
    beforeParts.push(`${prefix}${formatFieldPreviewValue(fieldId, beforeValue, refs)}`);
    afterParts.push(`${prefix}${formatFieldPreviewValue(fieldId, afterValue, refs)}`);
  }

  return {
    beforeLabel: beforeParts.join(", "),
    afterLabel: afterParts.join(", "),
  };
}

const EMPTY_PATCH = {
  item: {},
  gm: {},
  textbook: {},
} as ProductEditPatchV2;

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatLookupFallback(value: unknown): string {
  if (typeof value === "number") return `#${value}`;
  return formatPreviewValue(value);
}

function formatFieldPreviewValue(
  fieldId: BulkEditFieldId,
  value: unknown,
  refs: ReturnType<typeof buildProductRefMaps>,
): string {
  if (value === null || value === undefined) return "—";

  switch (fieldId) {
    case "vendorId":
      return refs.vendorNames.get(Number(value)) ?? formatLookupFallback(value);
    case "dccId":
      return refs.dccLabels.get(Number(value)) ?? formatLookupFallback(value);
    case "usedDccId":
      return refs.dccLabels.get(Number(value)) ?? formatLookupFallback(value);
    case "itemTaxTypeId":
      return refs.taxTypeLabels.get(Number(value)) ?? formatLookupFallback(value);
    case "bindingId":
      return refs.bindingLabels.get(Number(value)) ?? formatLookupFallback(value);
    case "colorId":
      return refs.colorLabels.get(Number(value)) ?? formatLookupFallback(value);
    case "tagTypeId":
      return refs.tagTypeLabels.get(Number(value)) ?? formatLookupFallback(value);
    case "statusCodeId":
      return refs.statusCodeLabels.get(Number(value)) ?? formatLookupFallback(value);
    case "packageType":
      return refs.packageTypeLabels.get(String(value)) ?? formatPreviewValue(value);
    default:
      return formatPreviewValue(value);
  }
}

function getSelectedFieldValue(
  row: BulkEditSourceRow,
  patch: ProductEditPatchV2,
  fieldId: BulkEditFieldId,
  inventoryTargets: ProductLocationId[],
  refs: ReturnType<typeof buildProductRefMaps>,
): unknown {
  const primaryInventoryLocationId = inventoryTargets[0] ?? row.primaryLocationId ?? row.inventoryByLocation?.[0]?.locationId ?? null;
  const inventorySnapshot = primaryInventoryLocationId == null ? null : getInventorySnapshot(row, primaryInventoryLocationId);

  switch (fieldId) {
    case "barcode":
      return hasOwnPatchField(patch.item, "barcode") ? patch.item?.barcode ?? null : row.barcode;
    case "vendorId":
    case "dccId":
    case "itemTaxTypeId":
      return hasOwnPatchField(patch.item, fieldId) ? patch.item?.[fieldId] ?? null : row[fieldId];
    case "usedDccId":
      return hasOwnPatchField(patch.item, "usedDccId") ? patch.item?.usedDccId ?? null : row.usedDccId ?? null;
    case "fDiscontinue":
      return hasOwnPatchField(patch.item, "fDiscontinue") ? patch.item?.fDiscontinue ?? 0 : row.fDiscontinue;
    case "comment":
      return hasOwnPatchField(patch.item, "comment") ? patch.item?.comment ?? null : row.comment ?? null;
    case "weight":
      return hasOwnPatchField(patch.item, "weight") ? patch.item?.weight ?? null : row.weight ?? null;
    case "styleId":
      return hasOwnPatchField(patch.item, "styleId") ? patch.item?.styleId ?? null : row.styleId ?? null;
    case "itemSeasonCodeId":
      return hasOwnPatchField(patch.item, "itemSeasonCodeId") ? patch.item?.itemSeasonCodeId ?? null : row.itemSeasonCodeId ?? null;
    case "minOrderQtyItem":
      return hasOwnPatchField(patch.item, "minOrderQtyItem") ? patch.item?.minOrderQtyItem ?? null : row.minOrderQtyItem ?? null;
    case "fListPriceFlag":
      return hasOwnPatchField(patch.item, "fListPriceFlag") ? patch.item?.fListPriceFlag ?? false : row.fListPriceFlag ?? false;
    case "fPerishable":
      return hasOwnPatchField(patch.item, "fPerishable") ? patch.item?.fPerishable ?? false : row.fPerishable ?? false;
    case "fIdRequired":
      return hasOwnPatchField(patch.item, "fIdRequired") ? patch.item?.fIdRequired ?? false : row.fIdRequired ?? false;
    case "description":
      return hasOwnPatchField(patch.gm, "description") ? patch.gm?.description ?? null : row.description;
    case "catalogNumber":
      return hasOwnPatchField(patch.gm, "catalogNumber") ? patch.gm?.catalogNumber ?? null : row.catalogNumber ?? null;
    case "packageType":
      return hasOwnPatchField(patch.gm, "packageType") ? patch.gm?.packageType ?? null : row.packageType ?? null;
    case "unitsPerPack":
      return hasOwnPatchField(patch.gm, "unitsPerPack") ? patch.gm?.unitsPerPack ?? null : row.unitsPerPack ?? null;
    case "imageUrl":
      return hasOwnPatchField(patch.gm, "imageUrl") ? patch.gm?.imageUrl ?? null : row.imageUrl ?? null;
    case "altVendorId":
      return hasOwnPatchField(patch.gm, "altVendorId") ? patch.gm?.altVendorId ?? null : row.altVendorId ?? null;
    case "mfgId":
      return hasOwnPatchField(patch.gm, "mfgId") ? patch.gm?.mfgId ?? null : row.mfgId ?? null;
    case "size":
      return hasOwnPatchField(patch.gm, "size") ? patch.gm?.size ?? null : row.size ?? null;
    case "colorId":
      return hasOwnPatchField(patch.gm, "colorId") ? patch.gm?.colorId ?? null : row.colorId ?? null;
    case "orderIncrement":
      return hasOwnPatchField(patch.gm, "orderIncrement") ? patch.gm?.orderIncrement ?? null : row.orderIncrement ?? null;
    case "title":
      return hasOwnPatchField(patch.textbook, "title") ? patch.textbook?.title ?? null : row.title ?? null;
    case "author":
      return hasOwnPatchField(patch.textbook, "author") ? patch.textbook?.author ?? null : row.author ?? null;
    case "isbn":
      return hasOwnPatchField(patch.textbook, "isbn") ? patch.textbook?.isbn ?? null : row.isbn ?? null;
    case "edition":
      return hasOwnPatchField(patch.textbook, "edition") ? patch.textbook?.edition ?? null : row.edition ?? null;
    case "bindingId":
      return hasOwnPatchField(patch.textbook, "bindingId") ? patch.textbook?.bindingId ?? null : row.bindingId ?? null;
    case "retail":
    case "cost": {
      if (inventoryTargets.length > 1) {
        return formatInventoryFieldLabel(row, patch, fieldId, inventoryTargets, refs).afterLabel;
      }
      if (primaryInventoryLocationId == null) {
        return inventorySnapshot?.[fieldId] ?? null;
      }
      return getInventoryFieldValueForLocation(row, patch, fieldId, primaryInventoryLocationId);
    }
    case "expectedCost":
    case "tagTypeId":
    case "statusCodeId":
    case "estSales":
    case "fInvListPriceFlag":
    case "fTxWantListFlag":
    case "fTxBuybackListFlag":
    case "fNoReturns": {
      if (inventoryTargets.length > 1) {
        return formatInventoryFieldLabel(row, patch, fieldId, inventoryTargets, refs).afterLabel;
      }
      if (primaryInventoryLocationId == null) {
        return inventorySnapshot?.[fieldId] ?? null;
      }
      return getInventoryFieldValueForLocation(row, patch, fieldId, primaryInventoryLocationId);
    }
    default:
      return null;
  }
}

function buildFieldPreviewCell(
  row: BulkEditSourceRow,
  patch: ProductEditPatchV2,
  fieldId: BulkEditFieldId,
  changedFields: BulkEditFieldId[],
  inventoryTargets: ProductLocationId[],
  refs: ReturnType<typeof buildProductRefMaps>,
): BulkEditFieldPreviewCell {
  const changed = changedFields.includes(fieldId);
  const beforeValue = getSelectedFieldValue(row, EMPTY_PATCH, fieldId, inventoryTargets, refs);
  const afterValue = getSelectedFieldValue(row, patch, fieldId, inventoryTargets, refs);

  return {
    fieldId,
    label: bulkEditFieldRegistry[fieldId].label,
    beforeLabel: formatFieldPreviewValue(fieldId, beforeValue, refs),
    afterLabel: formatFieldPreviewValue(fieldId, afterValue, refs),
    changed,
  };
}

export function buildBulkFieldPreview(
  sourceRows: BulkEditSourceRow[],
  request: BulkEditFieldPickerRequest,
  refsSource: PrismRefs | null = null,
): BulkEditFieldPreview {
  const fieldIds = dedupeFieldIds(request.fieldIds);
  const refs = buildProductRefMaps(refsSource ?? EMPTY_REFS);
  const rows: BulkEditFieldPreviewRow[] = sourceRows.map((row) => {
    const inventoryTargets = resolveInventoryTargets(row, request.inventoryScope);
    const { patch, changedFields } = buildBulkPatchForRow(row, request);
    const cells = fieldIds.map((fieldId) => buildFieldPreviewCell(row, patch, fieldId, changedFields, inventoryTargets, refs));

    return {
      sku: row.sku,
      description: row.description,
      changedFields,
      cells,
      warnings: [],
    };
  });

  const changedFieldLabels = fieldIds
    .filter((fieldId) => rows.some((row) => row.changedFields.includes(fieldId)))
    .map((fieldId) => bulkEditFieldRegistry[fieldId].label);

  return {
    changedFieldLabels,
    rows,
    totals: {
      rowCount: rows.length,
      changedFieldCount: rows.reduce((count, row) => count + row.changedFields.length, 0),
    },
    warnings: [],
  };
}

/**
 * Build a full preview payload from source rows + a compound transform.
 * Aggregates per-row results into totals and batch-level warnings.
 * Pure; callers are responsible for loading the source rows.
 */
export function buildPreview(
  sourceRows: BulkEditSourceRow[],
  transform: BulkEditTransform,
): PreviewResult {
  const rows = sourceRows.map((r) => applyTransform(r, transform));

  let pricingDeltaCents = 0;
  let districtChangeCount = 0;
  for (const r of rows) {
    pricingDeltaCents += Math.round((r.after.retail - r.before.retail) * 100);
    if (r.changedFields.includes("dccId") || r.changedFields.includes("itemTaxTypeId")) {
      districtChangeCount += 1;
    }
  }

  const batchWarnings: PreviewWarning[] = [];

  // If the transform forces a single DCC but the selection spans multiple distinct
  // starting DCCs, surface that — it's often intentional (recategorization pass),
  // but worth confirming.
  if (transform.catalog.dccId !== undefined) {
    const distinctStartingDccs = new Set(sourceRows.map((r) => r.dccId));
    if (distinctStartingDccs.size > 1) {
      batchWarnings.push({
        code: "NEGATIVE_MARGIN", // reuse existing code — batch warnings don't need a new category
        message: `Selection spans multiple (${distinctStartingDccs.size}) Department/Classes and you're collapsing them into one. Review the preview carefully.`,
      });
    }
  }

  return {
    rows,
    totals: {
      rowCount: rows.length,
      pricingDeltaCents,
      districtChangeCount,
    },
    warnings: batchWarnings,
  };
}
