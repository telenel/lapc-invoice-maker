import type { ProductEditDetails } from "@/domains/product/types";
import type { EditItemDialogProps } from "../../edit-item-dialog-legacy";
import type {
  FormState,
  InventoryFormState,
  InventoryLocationId,
  InventoryStateByLocation,
  InventoryFieldKey,
} from "./types";

/**
 * Hydrates an `InventoryFormState` for one location from a `ProductEditDetails`
 * payload. Missing rows collapse to empty strings / `false` so the form can
 * render without null checks on every field.
 */
export function toInventoryLocationState(
  detail: ProductEditDetails | null | undefined,
  locationId: InventoryLocationId,
): InventoryFormState {
  const row = detail?.inventoryByLocation.find((entry) => entry.locationId === locationId);
  return {
    retail: row?.retail != null ? String(row.retail) : "",
    cost: row?.cost != null ? String(row.cost) : "",
    expectedCost: row?.expectedCost != null ? String(row.expectedCost) : "",
    tagTypeId: row?.tagTypeId != null ? String(row.tagTypeId) : "",
    statusCodeId: row?.statusCodeId != null ? String(row.statusCodeId) : "",
    estSales: row?.estSales != null ? String(row.estSales) : "",
    estSalesLocked: row?.estSalesLocked ?? false,
    fInvListPriceFlag: row?.fInvListPriceFlag ?? false,
    fTxWantListFlag: row?.fTxWantListFlag ?? false,
    fTxBuybackListFlag: row?.fTxBuybackListFlag ?? false,
    fNoReturns: row?.fNoReturns ?? false,
    stockOnHand: row?.stockOnHand != null ? String(row.stockOnHand) : "",
    lastSaleDate: row?.lastSaleDate ?? "",
  };
}

/** Hydrates the full `InventoryStateByLocation` map for all Pierce locations. */
export function toInventoryState(detail: ProductEditDetails | null | undefined): InventoryStateByLocation {
  return {
    2: toInventoryLocationState(detail, 2),
    3: toInventoryLocationState(detail, 3),
    4: toInventoryLocationState(detail, 4),
  };
}

/** Looks up a single per-location inventory number (retail or cost). */
export function getPrimaryInventoryField(
  detail: ProductEditDetails | null | undefined,
  primaryLocationId: InventoryLocationId,
  field: "retail" | "cost",
): number | null | undefined {
  return detail?.inventoryByLocation.find((entry) => entry.locationId === primaryLocationId)?.[field];
}

/**
 * Builds the initial `FormState` from a selected item row and its optional
 * hydrated `ProductEditDetails`. Primary-location retail/cost prefer the
 * hydrated inventory value once available; otherwise we fall back to the row's
 * pre-hydration values so inputs stay populated during the fetch.
 */
export function toFormState(
  item: EditItemDialogProps["items"][number] | undefined,
  detail: ProductEditDetails | null | undefined,
  primaryLocationId: InventoryLocationId,
): FormState {
  const hasHydratedPrimaryInventory = detail?.inventoryByLocation.some((entry) => entry.locationId === primaryLocationId) === true;
  const primaryRetail = getPrimaryInventoryField(detail, primaryLocationId, "retail");
  const primaryCost = getPrimaryInventoryField(detail, primaryLocationId, "cost");

  return {
    title: detail?.title ?? "",
    author: detail?.author ?? "",
    isbn: detail?.isbn ?? "",
    edition: detail?.edition ?? "",
    bindingId: detail?.bindingId != null ? String(detail.bindingId) : "",
    imprint: detail?.imprint ?? "",
    copyright: detail?.copyright ?? "",
    textStatusId: detail?.textStatusId != null ? String(detail.textStatusId) : "",
    statusDate: detail?.statusDate ? detail.statusDate.slice(0, 10) : "",
    description: detail?.description ?? item?.description ?? "",
    barcode: detail?.barcode ?? item?.barcode ?? "",
    vendorId: detail?.vendorId ? String(detail.vendorId) : item?.vendorId ? String(item.vendorId) : "",
    dccId: detail?.dccId ? String(detail.dccId) : item?.dccId ? String(item.dccId) : "",
    itemTaxTypeId: detail?.itemTaxTypeId ? String(detail.itemTaxTypeId) : item?.itemTaxTypeId ? String(item.itemTaxTypeId) : "",
    retail: hasHydratedPrimaryInventory ? (primaryRetail != null ? String(primaryRetail) : "") : item?.retail != null ? String(item.retail) : "",
    cost: hasHydratedPrimaryInventory ? (primaryCost != null ? String(primaryCost) : "") : item?.cost != null ? String(item.cost) : "",
    catalogNumber: detail?.catalogNumber ?? item?.catalogNumber ?? "",
    comment: detail?.comment ?? item?.comment ?? "",
    fDiscontinue: (detail?.fDiscontinue ?? item?.fDiscontinue ?? 0) === 1,
    packageType: detail?.packageType ?? item?.packageType ?? "",
    unitsPerPack: detail?.unitsPerPack != null ? String(detail.unitsPerPack) : item?.unitsPerPack != null ? String(item.unitsPerPack) : "",
    imageUrl: detail?.imageUrl ?? "",
    weight: detail?.weight != null ? String(detail.weight) : "",
    altVendorId: detail?.altVendorId ? String(detail.altVendorId) : "",
    mfgId: detail?.mfgId ? String(detail.mfgId) : "",
    size: detail?.size ?? "",
    colorId: detail?.colorId ? String(detail.colorId) : "",
    styleId: detail?.styleId ? String(detail.styleId) : "",
    itemSeasonCodeId: detail?.itemSeasonCodeId ? String(detail.itemSeasonCodeId) : "",
    orderIncrement: detail?.orderIncrement != null ? String(detail.orderIncrement) : "",
    fListPriceFlag: detail?.fListPriceFlag ?? false,
    fPerishable: detail?.fPerishable ?? false,
    fIdRequired: detail?.fIdRequired ?? false,
    minOrderQtyItem: detail?.minOrderQtyItem != null ? String(detail.minOrderQtyItem) : "",
    usedDccId: detail?.usedDccId ? String(detail.usedDccId) : "",
  };
}

/**
 * Copies one editable inventory field from `source` to `target`, mutating
 * `target` in place when the value changes. Returns true if a mutation
 * happened. Used by the re-hydration effect to merge server updates into
 * state without clobbering user-dirty fields.
 */
export function syncInventoryField<K extends InventoryFieldKey>(
  target: InventoryFormState,
  source: InventoryFormState,
  key: K,
): boolean {
  if (target[key] === source[key]) {
    return false;
  }

  target[key] = source[key];
  return true;
}
