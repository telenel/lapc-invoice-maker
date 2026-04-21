/**
 * Shared types, constants, and empty-state factories for the product edit
 * dialog v2. Extracted from the original monolith as part of Phase 1 (see
 * docs/superpowers/specs and the project plan file). Behavior is identical
 * to the pre-extract implementation — this module is pure definitions.
 */

export type FormState = {
  title: string;
  author: string;
  isbn: string;
  edition: string;
  bindingId: string;
  imprint: string;
  copyright: string;
  textStatusId: string;
  statusDate: string;
  description: string;
  barcode: string;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  retail: string;
  cost: string;
  catalogNumber: string;
  comment: string;
  fDiscontinue: boolean;
  packageType: string;
  unitsPerPack: string;
  imageUrl: string;
  weight: string;
  altVendorId: string;
  mfgId: string;
  size: string;
  colorId: string;
  styleId: string;
  itemSeasonCodeId: string;
  orderIncrement: string;
  fListPriceFlag: boolean;
  fPerishable: boolean;
  fIdRequired: boolean;
  minOrderQtyItem: string;
  usedDccId: string;
};

export const EMPTY_FORM: FormState = {
  title: "",
  author: "",
  isbn: "",
  edition: "",
  bindingId: "",
  imprint: "",
  copyright: "",
  textStatusId: "",
  statusDate: "",
  description: "",
  barcode: "",
  vendorId: "",
  dccId: "",
  itemTaxTypeId: "",
  retail: "",
  cost: "",
  catalogNumber: "",
  comment: "",
  fDiscontinue: false,
  packageType: "",
  unitsPerPack: "",
  imageUrl: "",
  weight: "",
  altVendorId: "",
  mfgId: "",
  size: "",
  colorId: "",
  styleId: "",
  itemSeasonCodeId: "",
  orderIncrement: "",
  fListPriceFlag: false,
  fPerishable: false,
  fIdRequired: false,
  minOrderQtyItem: "",
  usedDccId: "",
};

export const INVENTORY_LOCATION_IDS = [2, 3, 4] as const;
export type InventoryLocationId = (typeof INVENTORY_LOCATION_IDS)[number];

export type InventoryFieldKey =
  | "retail"
  | "cost"
  | "expectedCost"
  | "tagTypeId"
  | "statusCodeId"
  | "estSales"
  | "estSalesLocked"
  | "fInvListPriceFlag"
  | "fTxWantListFlag"
  | "fTxBuybackListFlag"
  | "fNoReturns";

export const EDITABLE_INVENTORY_FIELDS = [
  "retail",
  "cost",
  "expectedCost",
  "tagTypeId",
  "statusCodeId",
  "estSales",
  "estSalesLocked",
  "fInvListPriceFlag",
  "fTxWantListFlag",
  "fTxBuybackListFlag",
  "fNoReturns",
] as const satisfies readonly InventoryFieldKey[];

export type InventoryFormState = {
  retail: string;
  cost: string;
  expectedCost: string;
  tagTypeId: string;
  statusCodeId: string;
  estSales: string;
  estSalesLocked: boolean;
  fInvListPriceFlag: boolean;
  fTxWantListFlag: boolean;
  fTxBuybackListFlag: boolean;
  fNoReturns: boolean;
  stockOnHand: string;
  lastSaleDate: string;
};

export type InventoryStateByLocation = Record<InventoryLocationId, InventoryFormState>;
export type DirtyInventoryFields = Record<InventoryLocationId, Set<InventoryFieldKey>>;

export const EMPTY_INVENTORY_LOCATION: InventoryFormState = {
  retail: "",
  cost: "",
  expectedCost: "",
  tagTypeId: "",
  statusCodeId: "",
  estSales: "",
  estSalesLocked: false,
  fInvListPriceFlag: false,
  fTxWantListFlag: false,
  fTxBuybackListFlag: false,
  fNoReturns: false,
  stockOnHand: "",
  lastSaleDate: "",
};

export const INVENTORY_LOCATION_LABELS: Record<InventoryLocationId, "PIER" | "PCOP" | "PFS"> = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
};

export function makeEmptyInventoryState(): InventoryStateByLocation {
  return {
    2: { ...EMPTY_INVENTORY_LOCATION },
    3: { ...EMPTY_INVENTORY_LOCATION },
    4: { ...EMPTY_INVENTORY_LOCATION },
  };
}

export function makeEmptyDirtyInventoryFields(): DirtyInventoryFields {
  return {
    2: new Set<InventoryFieldKey>(),
    3: new Set<InventoryFieldKey>(),
    4: new Set<InventoryFieldKey>(),
  };
}
