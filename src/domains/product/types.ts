import type { ProductLocationId } from "./location-filters";

export type { ProductLocationId } from "./location-filters";

export type ProductLocationAbbrev = "PIER" | "PCOP" | "PFS";

export interface ProductLocationSlice {
  locationId: ProductLocationId;
  locationAbbrev: ProductLocationAbbrev;
  retailPrice: number | null;
  cost: number | null;
  stockOnHand: number | null;
  lastSaleDate: string | null;
}

export interface ProductLocationVariance {
  retailPriceVaries: boolean;
  costVaries: boolean;
  stockVaries: boolean;
  lastSaleDateVaries: boolean;
}

/** Raw product row from Supabase products table */
export interface Product {
  sku: number;
  barcode: string | null;
  item_type: string;
  description: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  retail_price: number;
  cost: number;
  stock_on_hand: number | null;
  catalog_number: string | null;
  vendor_id: number;
  dcc_id: number;
  product_type: string | null;
  color_id: number;
  created_at: string | null;
  updated_at: string;
  last_sale_date: string | null;
  synced_at: string;
  dept_num: number | null;
  class_num: number | null;
  cat_num: number | null;
  dept_name: string | null;
  class_name: string | null;
  cat_name: string | null;
  units_sold_30d: number;
  units_sold_90d: number;
  units_sold_1y: number;
  units_sold_3y: number;
  units_sold_lifetime: number;
  revenue_30d: number;
  revenue_90d: number;
  revenue_1y: number;
  revenue_3y: number;
  revenue_lifetime: number;
  txns_1y: number;
  txns_lifetime: number;
  first_sale_date_computed: string | null;
  last_sale_date_computed: string | null;
  sales_aggregates_computed_at: string | null;
  effective_last_sale_date?: string | null;
  aggregates_ready?: boolean;
  edited_since_sync?: boolean;
  margin_ratio?: number | null;
  stock_coverage_days?: number | null;
  trend_direction?: "accelerating" | "decelerating" | "steady" | null;
  discontinued: boolean | null;
}

export interface ProductBrowseRow extends Omit<Product, "retail_price" | "cost" | "vendor_id" | "dcc_id" | "color_id"> {
  retail_price: number | null;
  cost: number | null;
  vendor_id: number | null;
  dcc_id: number | null;
  color_id: number | null;
  primary_location_id: ProductLocationId | null;
  primary_location_abbrev: ProductLocationAbbrev | null;
  selected_inventories: ProductLocationSlice[];
  location_variance: ProductLocationVariance;
}

export type ProductTab = "textbooks" | "merchandise";

export interface ProductFilters {
  search: string;
  tab: ProductTab;
  locationIds: ProductLocationId[];
  minPrice: string;
  maxPrice: string;
  vendorId: string;
  hasBarcode: boolean;
  lastSaleDateFrom: string;
  lastSaleDateTo: string;
  // Textbook-only
  author: string;
  hasIsbn: boolean;
  edition: string;
  // Merchandise-only
  catalogNumber: string;
  productType: string;
  // Sorting
  sortBy: string;
  sortDir: "asc" | "desc";
  // Pagination
  page: number;
  // Stock
  minStock: string;
  maxStock: string;
  // Classification
  deptNum: string;
  classNum: string;
  catNum: string;
  // Data quality
  missingBarcode: boolean;
  missingIsbn: boolean;
  missingTitle: boolean;
  retailBelowCost: boolean;
  zeroPrice: boolean;
  // Pricing / margin
  minMargin: string;
  maxMargin: string;
  // Activity
  lastSaleWithin: "" | "30d" | "90d" | "365d";
  lastSaleNever: boolean;
  lastSaleOlderThan: "" | "2y" | "5y";
  editedWithin: "" | "7d";
  editedSinceSync: boolean;
  // Status
  discontinued: "" | "yes" | "no";
  itemType: "" | "textbook" | "used_textbook" | "general_merchandise" | "supplies" | "other";
  // Transaction-based aggregates
  minUnitsSold: string;
  maxUnitsSold: string;
  unitsSoldWindow: "" | "30d" | "90d" | "1y" | "3y" | "lifetime";
  minRevenue: string;
  maxRevenue: string;
  revenueWindow: "" | "30d" | "90d" | "1y" | "3y" | "lifetime";
  minTxns: string;
  maxTxns: string;
  txnsWindow: "" | "1y" | "lifetime";
  neverSoldLifetime: boolean;
  firstSaleWithin: "" | "90d" | "1y";
  trendDirection: "" | "accelerating" | "decelerating";
  maxStockCoverageDays: string;
}

export type ProductSortField =
  | "sku" | "description" | "title" | "author"
  | "retail_price" | "cost"
  | "last_sale_date" | "barcode" | "catalog_number" | "product_type"
  | "vendor_id" | "isbn" | "edition"
  | "stock_on_hand"
  | "units_sold_30d" | "units_sold_1y" | "units_sold_lifetime"
  | "revenue_30d" | "revenue_1y"
  | "txns_1y"
  | "updated_at"
  | "dept_num"
  // Handled outside ALLOWED_SORT_FIELDS: margin is sorted client-side on
  // the current page; days_since_sale aliases to last_sale_date with
  // inverted direction (see queries.ts).
  | "margin"
  | "days_since_sale";

export interface ProductBrowseSearchResult {
  products: ProductBrowseRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductBrowseCountResult {
  products: [];
  total: number;
  page: number;
  pageSize: number;
}

/** A product selected for cart actions (invoice/quote creation or barcode printing) */
export interface SelectedProduct {
  sku: number;
  description: string;
  retailPrice: number | null;
  cost: number | null;
  barcode: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  catalogNumber: string | null;
  vendorId: number | null;
  vendorLabel?: string | null;
  itemType: string;
}

/** Fields editable on a GM item. Every field is optional — only present fields are applied. */
export interface GmItemPatch {
  description?: string;
  vendorId?: number;
  dccId?: number;
  itemTaxTypeId?: number;
  barcode?: string | null;
  catalogNumber?: string | null;
  comment?: string | null;
  weight?: number;
  imageUrl?: string | null;
  unitsPerPack?: number;
  packageType?: string | null;
  retail?: number;
  cost?: number;
  fDiscontinue?: 0 | 1;
}

/** Fields that live on Prism Item rows for single-item edits. */
export interface ItemPatch {
  barcode?: string | null;
  vendorId?: number;
  dccId?: number;
  itemTaxTypeId?: number;
  comment?: string | null;
  weight?: number;
  fDiscontinue?: 0 | 1;
}

/** Fields that live on Prism GeneralMerchandise rows for single-item edits. */
export interface GmDetailsPatch {
  description?: string;
  catalogNumber?: string | null;
  packageType?: string | null;
  unitsPerPack?: number;
  imageUrl?: string | null;
}

/** Fields that live on Prism Textbook rows for single-item edits. */
export interface TextbookDetailsPatch {
  author?: string | null;
  title?: string | null;
  isbn?: string | null;
  edition?: string | null;
  bindingId?: number | null;
  imprint?: string | null;
  copyright?: string | null;
  textStatusId?: number | null;
  statusDate?: string | null;
}

/** Fields that live on Prism Inventory for the Pierce location. */
export interface PrimaryInventoryPatch {
  retail?: number | null;
  cost?: number | null;
}

/** Fields that live on Prism Inventory for a single location-aware write. */
export interface InventoryPatchPerLocation {
  locationId: ProductLocationId;
  retail?: number | null;
  cost?: number | null;
  expectedCost?: number | null;
  tagTypeId?: number | null;
  statusCodeId?: number | null;
  estSales?: number | null;
  estSalesLocked?: boolean;
  fInvListPriceFlag?: boolean;
  fTxWantListFlag?: boolean;
  fTxBuybackListFlag?: boolean;
  fNoReturns?: boolean;
}

/** Typed write contract for the single-item editor. */
export interface ProductEditPatchV2 {
  item?: ItemPatch;
  gm?: GmDetailsPatch;
  textbook?: TextbookDetailsPatch;
  inventory?: InventoryPatchPerLocation[];
  primaryInventory?: PrimaryInventoryPatch;
}

/** Narrow patch for textbook rows — only fields that live on Item/Inventory. */
export interface TextbookPatch {
  barcode?: string | null;
  retail?: number;
  cost?: number;
  fDiscontinue?: 0 | 1;
}

/** Baseline snapshot captured when an edit dialog opens, sent back on submit for concurrency check. */
export interface ItemSnapshot {
  sku: number;
  barcode: string | null;
  retail: number | null;
  cost: number | null;
  fDiscontinue: 0 | 1;
}

/** Rich single-item snapshot used to hydrate the edit dialog without storing full browse state. */
export interface ProductEditDetails {
  sku: number;
  itemType: string;
  description: string | null;
  author?: string | null;
  title?: string | null;
  isbn?: string | null;
  edition?: string | null;
  bindingId?: number | null;
  imprint?: string | null;
  copyright?: string | null;
  textStatusId?: number | null;
  statusDate?: string | null;
  bookKey?: string | null;
  barcode: string | null;
  vendorId: number | null;
  dccId: number | null;
  itemTaxTypeId: number | null;
  catalogNumber: string | null;
  comment: string | null;
  retail: number | null;
  cost: number | null;
  fDiscontinue: 0 | 1;
  altVendorId: number | null;
  mfgId: number | null;
  weight: number | null;
  packageType: string | null;
  unitsPerPack: number | null;
  orderIncrement: number | null;
  imageUrl: string | null;
  size: string | null;
  sizeId: number | null;
  colorId: number | null;
  styleId: number | null;
  itemSeasonCodeId: number | null;
  fListPriceFlag: boolean;
  fPerishable: boolean;
  fIdRequired: boolean;
  minOrderQtyItem: number | null;
  usedDccId: number | null;
  inventoryByLocation: ProductInventoryEditDetails[];
}

export interface ProductInventoryEditDetails {
  locationId: ProductLocationId;
  locationAbbrev: ProductLocationAbbrev;
  retail: number | null;
  cost: number | null;
  expectedCost: number | null;
  stockOnHand: number | null;
  lastSaleDate: string | null;
  tagTypeId: number | null;
  statusCodeId: number | null;
  estSales: number | null;
  estSalesLocked: boolean;
  fInvListPriceFlag: boolean;
  fTxWantListFlag: boolean;
  fTxBuybackListFlag: boolean;
  fNoReturns: boolean;
}

/** One validation error attached to a batch-add or batch-edit row. */
export interface BatchValidationError {
  rowIndex: number;
  field: string;
  code:
    | "DUPLICATE_BARCODE"
    | "INVALID_VENDOR"
    | "INVALID_DCC"
    | "INVALID_TAX_TYPE"
    | "MISSING_REQUIRED"
    | "NEGATIVE_PRICE"
    | "NEGATIVE_COST"
    | "BARCODE_TOO_LONG"
    | "DESCRIPTION_TOO_LONG"
    | "COMMENT_TOO_LONG"
    | "CATALOG_TOO_LONG"
    | "IMAGE_URL_TOO_LONG"
    | "HAS_HISTORY"
    | "TEXTBOOK_NOT_SUPPORTED";
  message: string;
}

export type BatchAction = "create" | "update" | "discontinue" | "hard-delete";

export interface BatchCreateRow {
  description: string;
  vendorId: number;
  dccId: number;
  itemTaxTypeId?: number;
  barcode?: string | null;
  catalogNumber?: string | null;
  comment?: string | null;
  packageType?: string | null;
  unitsPerPack?: number;
  retail: number;
  cost: number;
}

export interface BatchUpdateRow {
  sku: number;
  patch: GmItemPatch | TextbookPatch;
}

export interface BatchValidationResponse {
  errors: BatchValidationError[];
}

export interface BatchResult {
  action: BatchAction;
  count: number;
  skus: number[];
}

export type PresetGroup =
  | "dead-weight"
  | "movers"
  | "trending"
  | "stock-health"
  | "pricing"
  | "textbook"
  | "data-quality"
  | "recent-activity";

export interface ColumnPreferences {
  visible: string[];
}

export interface SavedView {
  id: string;
  name: string;
  description: string | null;
  filter: Partial<ProductFilters>;
  columnPreferences: ColumnPreferences | null;
  isSystem: boolean;
  slug: string | null;
  presetGroup: PresetGroup | null;
  sortOrder: number | null;
}
