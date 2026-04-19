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
  discontinued: boolean | null;
}

export type ProductTab = "textbooks" | "merchandise";

export interface ProductFilters {
  search: string;
  tab: ProductTab;
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

export interface ProductSearchResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

/** A product selected for cart actions (invoice/quote creation or barcode printing) */
export interface SelectedProduct {
  sku: number;
  description: string;
  retailPrice: number;
  cost: number;
  barcode: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  catalogNumber: string | null;
  vendorId: number;
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
  retail: number;
  cost: number;
  fDiscontinue: 0 | 1;
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
