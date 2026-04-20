import type { ProductFilters, ProductTab } from "./types";
import { cloneProductLocationIds, DEFAULT_PRODUCT_LOCATION_IDS } from "./location-filters";

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
  locationIds: cloneProductLocationIds(DEFAULT_PRODUCT_LOCATION_IDS),
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
  minUnitsSold: "",
  maxUnitsSold: "",
  unitsSoldWindow: "",
  minRevenue: "",
  maxRevenue: "",
  revenueWindow: "",
  minTxns: "",
  maxTxns: "",
  txnsWindow: "",
  neverSoldLifetime: false,
  firstSaleWithin: "",
  trendDirection: "",
  maxStockCoverageDays: "",
};

/** sessionStorage key for transferring selected products to invoice/quote forms */
export const CATALOG_ITEMS_STORAGE_KEY = "catalog-selected-items";

export const OPTIONAL_COLUMNS = [
  "dcc",
  "units_1y",
  "revenue_1y",
  "txns_1y",
  "margin",
  "days_since_sale",
  "updated",
] as const;

export type OptionalColumnKey = typeof OPTIONAL_COLUMNS[number];

export const DEFAULT_COLUMN_SET: OptionalColumnKey[] = ["units_1y", "dcc", "margin"];

export const COLUMN_LABELS: Record<OptionalColumnKey, string> = {
  dcc: "DCC",
  units_1y: "Units 1y",
  revenue_1y: "Revenue 1y",
  txns_1y: "Receipts 1y",
  margin: "Margin %",
  days_since_sale: "Days since sale",
  updated: "Updated",
};

/** Responsive hiding tier for each optional column.
 * Stays in sync with the CSS @container breakpoints in product-table.css.
 * If you change one, change both. */
export const COLUMN_PRIORITY: Record<OptionalColumnKey, "high" | "medium" | "low"> = {
  dcc: "medium",
  units_1y: "high",
  revenue_1y: "high",
  txns_1y: "medium",
  margin: "medium",
  days_since_sale: "low",
  updated: "low",
};

export const PRESET_GROUPS = [
  { value: "dead-weight",     label: "Dead weight",  icon: "💀" },
  { value: "movers",          label: "Movers",       icon: "📊" },
  { value: "trending",        label: "Trending",     icon: "📈" },
  { value: "stock-health",    label: "Stock health", icon: "📦" },
  { value: "pricing",         label: "Pricing",      icon: "💰" },
  { value: "textbook",        label: "Textbook",     icon: "📚" },
  { value: "data-quality",    label: "Data",         icon: "🔍" },
  { value: "recent-activity", label: "Recent",       icon: "📝" },
] as const;

// Bumped to v2 when the default column set gained "margin" — prior v1 payloads
// would pin existing browsers to the old defaults, hiding the Margin column.
export const COLUMN_PREFS_STORAGE_KEY = "products:columns:v2";
