/**
 * Types shared across the bulk-edit workspace: frontend forms, API routes,
 * transform engine, and preview builder all use these shapes.
 */

import type { PrismRefs } from "@/domains/product/ref-data";
import type { ProductLocationId } from "@/domains/product/location-filters";

/**
 * Product-filter shape. Mirrors the existing products page filters so we
 * can reuse the useProductSearch hook without reshaping data.
 */
export interface ProductFilters {
  q?: string;
  vendorId?: number;
  dccId?: number;
  itemType?: "textbook" | "general_merchandise";
  minRetail?: number;
  maxRetail?: number;
  hasBarcode?: boolean;
}

export const BULK_EDIT_FIELD_GROUPS = ["primary", "inventory", "more", "advanced"] as const;

export type BulkEditFieldGroup = (typeof BULK_EDIT_FIELD_GROUPS)[number];

export type BulkEditFieldId =
  | "description"
  | "vendorId"
  | "dccId"
  | "barcode"
  | "itemTaxTypeId"
  | "catalogNumber"
  | "packageType"
  | "unitsPerPack"
  | "title"
  | "author"
  | "isbn"
  | "edition"
  | "bindingId"
  | "retail"
  | "cost"
  | "expectedCost"
  | "tagTypeId"
  | "statusCodeId"
  | "estSales"
  | "fInvListPriceFlag"
  | "fTxWantListFlag"
  | "fTxBuybackListFlag"
  | "fNoReturns"
  | "fDiscontinue";

export type BulkEditFieldRefOptionKey = keyof PrismRefs;

export type BulkEditFieldValue = string | number | boolean | null;

export type BulkEditFieldValues = Partial<Record<BulkEditFieldId, BulkEditFieldValue>>;

export type BulkEditInventoryScope = ProductLocationId | "primary" | "all" | null;

export interface BulkEditFieldPickerRequest {
  fieldIds: BulkEditFieldId[];
  inventoryScope: BulkEditInventoryScope;
  values: BulkEditFieldValues;
}

export interface BulkEditFieldDefinition {
  id: BulkEditFieldId;
  label: string;
  group: BulkEditFieldGroup;
  fillRateLabel: string;
  requiresLocation: boolean;
  refOptionKey?: BulkEditFieldRefOptionKey;
}

export type BulkEditFieldRegistry = Record<BulkEditFieldId, BulkEditFieldDefinition>;

export interface BulkEditSourceInventoryRow {
  locationId: ProductLocationId;
  retail: number | null;
  cost: number | null;
  expectedCost: number | null;
  tagTypeId: number | null;
  statusCodeId: number | null;
  estSales: number | null;
  estSalesLocked: boolean;
  fInvListPriceFlag: boolean;
  fTxWantListFlag: boolean;
  fTxBuybackListFlag: boolean;
  fNoReturns: boolean;
}

export interface BulkEditFieldPreviewCell {
  fieldId: BulkEditFieldId;
  label: string;
  beforeLabel: string;
  afterLabel: string;
  changed: boolean;
}

export type BulkEditFieldPreviewRow = {
  sku: number;
  description: string;
  changedFields: BulkEditFieldId[];
  cells: BulkEditFieldPreviewCell[];
  warnings: PreviewWarning[];
};

export interface BulkEditFieldPreview {
  changedFieldLabels: string[];
  rows: BulkEditFieldPreviewRow[];
  totals: {
    rowCount: number;
    changedFieldCount: number;
  };
  warnings: PreviewWarning[];
}

/**
 * Bulk-edit selection — either filter-based (evaluated server-side against
 * Supabase products) or SKU-list-based (paste from Excel / external source).
 * If skus is set, filter is ignored.
 */
export interface BulkEditSelection {
  filter?: ProductFilters;
  skus?: number[];
  scope: "pierce" | "district";
}

/**
 * Compound transform: one pricing mode + optional catalog metadata.
 * Only one of pricing + catalog needs to have a real change; pure no-op
 * transforms are rejected at dry-run time.
 */
export type PricingMode =
  | { mode: "none" }
  | { mode: "uplift"; percent: number }                                             // percent: 5 = +5%
  | { mode: "absolute"; retail: number }                                            // dollar amount
  | { mode: "margin"; targetMargin: number }                                        // 0 <= x < 1
  | {
      mode: "cost";
      newCost: { kind: "absolute"; value: number } | { kind: "uplift"; percent: number };
      preserveMargin: boolean;
    };

export interface BulkEditTransform {
  pricing: PricingMode;
  catalog: {
    dccId?: number;
    itemTaxTypeId?: number;
  };
}

export interface BulkEditRequest {
  selection: BulkEditSelection;
  transform: BulkEditTransform;
}

export interface BulkEditFieldEditRequest {
  selection: BulkEditSelection;
  transform: BulkEditFieldPickerRequest;
}

/** Row values that the transform engine operates on. Pulled from Supabase mirror. */
export interface BulkEditSourceRow {
  sku: number;
  description: string;
  barcode: string | null;
  retail: number;
  cost: number;
  vendorId: number | null;
  dccId: number | null;
  itemTaxTypeId: number | null;
  itemType: "textbook" | "used_textbook" | "general_merchandise" | null;
  fDiscontinue: 0 | 1;
  title?: string | null;
  author?: string | null;
  isbn?: string | null;
  edition?: string | null;
  bindingId?: number | null;
  catalogNumber?: string | null;
  packageType?: string | null;
  unitsPerPack?: number | null;
  primaryLocationId?: ProductLocationId | null;
  inventoryByLocation?: BulkEditSourceInventoryRow[];
}

/** One row in the preview grid: before/after values + row-level warnings. */
export interface PreviewRow {
  sku: number;
  description: string;
  before: Pick<BulkEditSourceRow, "retail" | "cost" | "dccId" | "itemTaxTypeId" | "barcode">;
  after: Pick<BulkEditSourceRow, "retail" | "cost" | "dccId" | "itemTaxTypeId" | "barcode">;
  changedFields: Array<"retail" | "cost" | "dccId" | "itemTaxTypeId">;
  warnings: PreviewWarning[];
}

export type PreviewWarningCode =
  | "NEGATIVE_MARGIN"
  | "ZERO_RETAIL_FOR_MARGIN_MODE"
  | "ZERO_COST_FOR_MARGIN_MODE"
  | "LARGE_PRICE_JUMP"
  | "DISCONTINUED_ITEM";

export interface PreviewWarning {
  code: PreviewWarningCode;
  message: string;
}

export interface PreviewResult {
  rows: PreviewRow[];
  totals: {
    rowCount: number;
    pricingDeltaCents: number;   // sum over (after.retail - before.retail) * 100
    districtChangeCount: number; // rows whose dccId or itemTaxTypeId changed
  };
  warnings: PreviewWarning[]; // batch-level (e.g., "selection spans multiple DCCs and you're setting a single DCC")
}

/** Validation errors returned from the server dry-run or commit. */
export interface BulkEditValidationError {
  code:
    | "EMPTY_SELECTION"
    | "NO_OP_TRANSFORM"
    | "MISSING_INVENTORY_SCOPE"
    | "INVALID_MARGIN"
    | "INVALID_PERCENT"
    | "INVALID_RETAIL"
    | "INVALID_COST"
    | "INVALID_DCC"
    | "INVALID_TAX_TYPE";
  field?: string;
  message: string;
}

/** Shape returned from commit-route on success. */
export interface CommitResult {
  runId: string;
  successCount: number;
  affectedSkus: number[];
}
