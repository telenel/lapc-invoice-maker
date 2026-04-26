import type { ProductEditPatchV2 } from "@/domains/product/types";
import { buildPatch } from "../../edit-item-dialog-legacy";
import type {
  FormState,
  InventoryLocationId,
  InventoryStateByLocation,
} from "./types";
import { INVENTORY_LOCATION_IDS } from "./types";

/**
 * Reduces `""` to `null` (single-item save) or `undefined` (bulk — leaves row
 * unchanged). Centralises the tri-state convention Prism writes expect.
 */
export function optionalString(value: string, isBulk: boolean): string | null | undefined {
  if (value !== "") return value;
  return isBulk ? undefined : null;
}

/** `true` when any own-property of the object is defined (non-`undefined`). */
export function hasPatchFields<T extends object>(value: T): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

/**
 * Builds the `ProductEditPatchV2` item/gm/textbook groups from the current
 * form state. Only fields that differ from the baseline are included. Textbook
 * fields are emitted only when `isTextbookRow` is true.
 */
export function buildV2Patch(
  form: FormState,
  baseline: FormState,
  isBulk: boolean,
  isTextbookRow: boolean,
): ProductEditPatchV2 {
  const rawPatch = buildPatch(baseline as Record<string, unknown>, form as Record<string, unknown>);
  const item: NonNullable<ProductEditPatchV2["item"]> = {};
  const gm: NonNullable<ProductEditPatchV2["gm"]> = {};
  const textbook: NonNullable<ProductEditPatchV2["textbook"]> = {};

  for (const [key, value] of Object.entries(rawPatch)) {
    if (isBulk && value === "") continue;

    switch (key) {
      case "description":
        gm.description = String(value);
        break;
      case "barcode":
        item.barcode = value === "" ? null : String(value);
        break;
      case "vendorId":
        item.vendorId = value === "" ? undefined : Number(value);
        break;
      case "dccId":
        item.dccId = value === "" ? undefined : Number(value);
        break;
      case "itemTaxTypeId":
        item.itemTaxTypeId = value === "" ? undefined : Number(value);
        break;
      case "altVendorId":
        gm.altVendorId = value === "" ? undefined : Number(value);
        break;
      case "mfgId":
        gm.mfgId = value === "" ? undefined : Number(value);
        break;
      case "colorId":
        gm.colorId = value === "" ? undefined : Number(value);
        break;
      case "styleId":
        item.styleId = value === "" ? undefined : Number(value);
        break;
      case "itemSeasonCodeId":
        item.itemSeasonCodeId = value === "" ? undefined : Number(value);
        break;
      case "usedDccId":
        item.usedDccId = value === "" ? undefined : Number(value);
        break;
      case "unitsPerPack":
        gm.unitsPerPack = value === "" ? undefined : Number(value);
        break;
      case "orderIncrement":
        gm.orderIncrement = value === "" ? undefined : Number(value);
        break;
      case "minOrderQtyItem":
        item.minOrderQtyItem = value === "" ? undefined : Number(value);
        break;
      case "weight":
        item.weight = Number(value);
        break;
      case "catalogNumber":
        gm.catalogNumber = optionalString(String(value), isBulk);
        break;
      case "comment":
        item.comment = optionalString(String(value), isBulk);
        break;
      case "imageUrl":
        gm.imageUrl = optionalString(String(value), isBulk);
        break;
      case "packageType":
        gm.packageType = optionalString(String(value), isBulk);
        break;
      case "size":
        gm.size = optionalString(String(value), isBulk);
        break;
      case "fListPriceFlag":
        item.fListPriceFlag = Boolean(value);
        break;
      case "fPerishable":
        item.fPerishable = Boolean(value);
        break;
      case "fIdRequired":
        item.fIdRequired = Boolean(value);
        break;
      case "fDiscontinue":
        item.fDiscontinue = value ? 1 : 0;
        break;
      default:
        break;
    }
  }

  if (isTextbookRow) {
    if (rawPatch.title !== undefined) textbook.title = optionalString(String(rawPatch.title), isBulk);
    if (rawPatch.author !== undefined) textbook.author = optionalString(String(rawPatch.author), isBulk);
    if (rawPatch.isbn !== undefined) textbook.isbn = optionalString(String(rawPatch.isbn), isBulk);
    if (rawPatch.edition !== undefined) textbook.edition = optionalString(String(rawPatch.edition), isBulk);
    if (rawPatch.bindingId !== undefined) textbook.bindingId = rawPatch.bindingId === "" ? null : Number(rawPatch.bindingId);
    if (rawPatch.imprint !== undefined) textbook.imprint = optionalString(String(rawPatch.imprint), isBulk);
    if (rawPatch.copyright !== undefined) textbook.copyright = optionalString(String(rawPatch.copyright), isBulk);
    if (rawPatch.textStatusId !== undefined) textbook.textStatusId = rawPatch.textStatusId === "" ? null : Number(rawPatch.textStatusId);
    if (rawPatch.statusDate !== undefined) textbook.statusDate = optionalString(String(rawPatch.statusDate), isBulk);
  }

  return {
    item: hasPatchFields(item) ? item : undefined,
    gm: hasPatchFields(gm) ? gm : undefined,
    textbook: hasPatchFields(textbook) ? textbook : undefined,
  };
}

/**
 * Builds the `inventory` entry of `ProductEditPatchV2`: per-location diffs
 * against the baseline. Returns `undefined` in bulk mode (inventory editor is
 * hidden) and when nothing changed.
 */
export function buildInventoryPatch(
  form: FormState,
  baselineForm: FormState,
  inventory: InventoryStateByLocation,
  baselineInventory: InventoryStateByLocation,
  primaryLocationId: InventoryLocationId,
  isBulk: boolean,
): NonNullable<ProductEditPatchV2["inventory"]> | undefined {
  if (isBulk) return undefined;

  const patch: NonNullable<ProductEditPatchV2["inventory"]> = [];

  for (const locationId of INVENTORY_LOCATION_IDS) {
    const current = inventory[locationId];
    const baseline = baselineInventory[locationId];
    const entry: Partial<NonNullable<ProductEditPatchV2["inventory"]>[number]> = { locationId };

    const retailSource = locationId === primaryLocationId ? form.retail : current.retail;
    const retailBaseline = locationId === primaryLocationId ? baselineForm.retail : baseline.retail;
    if (retailSource !== retailBaseline) {
      entry.retail = retailSource === "" ? null : Number(retailSource);
    }

    const costSource = locationId === primaryLocationId ? form.cost : current.cost;
    const costBaseline = locationId === primaryLocationId ? baselineForm.cost : baseline.cost;
    if (costSource !== costBaseline) {
      entry.cost = costSource === "" ? null : Number(costSource);
    }

    if (current.stockOnHand !== baseline.stockOnHand) {
      entry.stockOnHand = current.stockOnHand === "" ? null : Number(current.stockOnHand);
    }
    if (current.expectedCost !== baseline.expectedCost) {
      entry.expectedCost = current.expectedCost === "" ? null : Number(current.expectedCost);
    }
    if (current.tagTypeId !== baseline.tagTypeId) {
      entry.tagTypeId = current.tagTypeId === "" ? null : Number(current.tagTypeId);
    }
    if (current.statusCodeId !== baseline.statusCodeId) {
      entry.statusCodeId = current.statusCodeId === "" ? null : Number(current.statusCodeId);
    }
    if (current.estSales !== baseline.estSales) {
      entry.estSales = current.estSales === "" ? null : Number(current.estSales);
    }
    if (current.estSalesLocked !== baseline.estSalesLocked) {
      entry.estSalesLocked = current.estSalesLocked;
    }
    if (current.fInvListPriceFlag !== baseline.fInvListPriceFlag) {
      entry.fInvListPriceFlag = current.fInvListPriceFlag;
    }
    if (current.fTxWantListFlag !== baseline.fTxWantListFlag) {
      entry.fTxWantListFlag = current.fTxWantListFlag;
    }
    if (current.fTxBuybackListFlag !== baseline.fTxBuybackListFlag) {
      entry.fTxBuybackListFlag = current.fTxBuybackListFlag;
    }
    if (current.fNoReturns !== baseline.fNoReturns) {
      entry.fNoReturns = current.fNoReturns;
    }

    if (Object.keys(entry).length > 1) {
      patch.push(entry as NonNullable<ProductEditPatchV2["inventory"]>[number]);
    }
  }

  return patch.length > 0 ? patch : undefined;
}
