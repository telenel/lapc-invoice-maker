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
  one_year_sales: number | null;
  look_back_sales: number | null;
  sales_to_avg_ratio: number | null;
  est_sales_calc: number | null;
  est_sales_prev: number | null;
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
}

export type ProductSortField = "sku" | "description" | "title" | "author" | "retail_price" | "cost" | "last_sale_date" | "barcode" | "catalog_number" | "product_type" | "vendor_id" | "isbn" | "edition";

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
  | "data-quality"
  | "pricing"
  | "recent-activity"
  | "textbook";

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
