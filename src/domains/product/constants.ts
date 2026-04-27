import type { ProductFilters, ProductTab } from "./types";
import { cloneProductLocationIds, DEFAULT_PRODUCT_LOCATION_IDS } from "./location-filters";

export const PAGE_SIZE = 50;

export const TABS: { value: ProductTab; label: string }[] = [
  { value: "textbooks", label: "Textbooks" },
  { value: "merchandise", label: "General Merchandise" },
  { value: "quickPicks", label: "Quick Picks" },
];

/** item_type values that map to each tab */
export const TAB_ITEM_TYPES: Record<Exclude<ProductTab, "quickPicks">, string[]> = {
  textbooks: ["textbook", "used_textbook"],
  merchandise: ["general_merchandise", "supplies", "other"],
};

export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  tab: "textbooks",
  sectionSlug: undefined,
  allSections: false,
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
  dccComposite: "",
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

export const DEFAULT_COLUMN_SET: OptionalColumnKey[] = ["units_1y", "margin"];

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

/** Row density modes for the product table. Audit is the count-cycle
 * variant — narrowest row, ideal when sweeping rows during inventory. */
export const TABLE_DENSITIES = [
  { value: "compact", label: "Compact", rowH: 28, fontPx: 12 },
  { value: "comfy",   label: "Comfy",   rowH: 38, fontPx: 13 },
  { value: "roomy",   label: "Roomy",   rowH: 46, fontPx: 13 },
  { value: "audit",   label: "Audit",   rowH: 24, fontPx: 12, stripe: true },
] as const;

export type TableDensity = typeof TABLE_DENSITIES[number]["value"];

export const DEFAULT_TABLE_DENSITY: TableDensity = "comfy";

export const TABLE_DENSITY_STORAGE_KEY = "products:density:v1";

/** Column preset bundles. Each preset names which OPTIONAL_COLUMNS should
 * be visible — the always-on base columns (SKU, Description, Vendor, etc.)
 * are not in this list and remain visible regardless. */
export const COLUMN_PRESETS = [
  {
    value: "default",
    label: "Default",
    description: "Balanced view — units sold and margin.",
    columns: ["units_1y", "margin"] as OptionalColumnKey[],
  },
  {
    value: "pricing",
    label: "Pricing",
    description: "Margin and revenue for pricing decisions.",
    columns: ["margin", "revenue_1y"] as OptionalColumnKey[],
  },
  {
    value: "inventory",
    label: "Inventory",
    description: "Department/class/category for stock work.",
    columns: ["dcc"] as OptionalColumnKey[],
  },
  {
    value: "movers",
    label: "Movers",
    description: "Sales velocity — units, revenue, receipts.",
    columns: ["units_1y", "revenue_1y", "txns_1y"] as OptionalColumnKey[],
  },
  {
    value: "recency",
    label: "Recency",
    description: "Days since sale and last-edit timestamps.",
    columns: ["days_since_sale", "updated"] as OptionalColumnKey[],
  },
  {
    value: "all",
    label: "All",
    description: "Every optional column visible.",
    columns: [...OPTIONAL_COLUMNS],
  },
] as const;

export type ColumnPresetKey = typeof COLUMN_PRESETS[number]["value"];
