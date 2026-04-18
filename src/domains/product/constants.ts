import type { ProductFilters, ProductTab } from "./types";

export const PAGE_SIZE = 50;

export const TABS: { value: ProductTab; label: string }[] = [
  { value: "textbooks", label: "Textbooks" },
  { value: "merchandise", label: "General Merchandise" },
];

/** item_type values that map to each tab */
export const TAB_ITEM_TYPES: Record<ProductTab, string[]> = {
  textbooks: ["textbook", "used_textbook"],
  merchandise: ["general_merchandise", "supplies", "other"],
};

export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  tab: "textbooks",
  minPrice: "",
  maxPrice: "",
  vendorId: "",
  hasBarcode: false,
  lastSaleDateFrom: "",
  lastSaleDateTo: "",
  author: "",
  hasIsbn: false,
  edition: "",
  catalogNumber: "",
  productType: "",
  sortBy: "sku",
  sortDir: "asc",
  page: 1,
  // New in feat/products-interactive
  minStock: "",
  maxStock: "",
  deptNum: "",
  classNum: "",
  catNum: "",
  missingBarcode: false,
  missingIsbn: false,
  missingTitle: false,
  retailBelowCost: false,
  zeroPrice: false,
  minMargin: "",
  maxMargin: "",
  lastSaleWithin: "",
  lastSaleNever: false,
  lastSaleOlderThan: "",
  editedWithin: "",
  editedSinceSync: false,
  discontinued: "",
  itemType: "",
};

/** sessionStorage key for transferring selected products to invoice/quote forms */
export const CATALOG_ITEMS_STORAGE_KEY = "catalog-selected-items";

export const OPTIONAL_COLUMNS = [
  "stock",
  "dcc",
  "est_sales",
  "margin",
  "days_since_sale",
  "updated",
] as const;

export type OptionalColumnKey = typeof OPTIONAL_COLUMNS[number];

export const DEFAULT_COLUMN_SET: OptionalColumnKey[] = ["stock", "dcc"];

export const COLUMN_LABELS: Record<OptionalColumnKey, string> = {
  stock: "Stock",
  dcc: "DCC",
  est_sales: "Est. annual sales",
  margin: "Margin %",
  days_since_sale: "Days since sale",
  updated: "Updated",
};

export const PRESET_GROUPS = [
  { value: "dead-weight", label: "Dead weight", icon: "💀" },
  { value: "movers", label: "Movers", icon: "📊" },
  { value: "data-quality", label: "Data", icon: "🔍" },
  { value: "pricing", label: "Pricing", icon: "💰" },
  { value: "recent-activity", label: "Recent", icon: "📝" },
  { value: "textbook", label: "Textbook", icon: "📚" },
] as const;

export const COLUMN_PREFS_STORAGE_KEY = "products:columns:v1";
