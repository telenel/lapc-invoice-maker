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
  catalog_number: string | null;
  vendor_id: number;
  dcc_id: number;
  product_type: string | null;
  color_id: number;
  created_at: string | null;
  last_sale_date: string | null;
  synced_at: string;
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
