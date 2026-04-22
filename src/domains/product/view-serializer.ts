import { EMPTY_FILTERS, OPTIONAL_COLUMNS } from "./constants";
import type { OptionalColumnKey } from "./constants";
import {
  cloneProductLocationIds,
  DEFAULT_PRODUCT_LOCATION_IDS,
  normalizeProductLocationIds,
  parseProductLocationIdsParam,
  serializeProductLocationIdsParam,
} from "./location-filters";
import type {
  ProductFilters,
  SavedView,
} from "./types";

const BOOL_KEYS: (keyof ProductFilters)[] = [
  "hasBarcode", "hasIsbn",
  "missingBarcode", "missingIsbn", "missingTitle",
  "retailBelowCost", "zeroPrice",
  "lastSaleNever", "editedSinceSync", "neverSoldLifetime",
  "allSections",
];

const NUMERIC_STRING_KEYS: (keyof ProductFilters)[] = [
  "minPrice", "maxPrice", "vendorId",
  "minStock", "maxStock",
  "deptNum", "classNum", "catNum",
  "minMargin", "maxMargin",
  "minUnitsSold", "maxUnitsSold",
  "minRevenue", "maxRevenue",
  "minTxns", "maxTxns",
  "maxStockCoverageDays",
];

const TEXT_KEYS: (keyof ProductFilters)[] = [
  "search", "author", "edition", "catalogNumber", "productType",
  "lastSaleDateFrom", "lastSaleDateTo",
  "sectionSlug",
  "dccComposite",
];

const ENUM_KEYS: { [K in keyof ProductFilters]?: readonly ProductFilters[K][] } = {
  tab: ["textbooks", "merchandise", "quickPicks"],
  sortDir: ["asc", "desc"],
  lastSaleWithin: ["", "30d", "90d", "365d"],
  lastSaleOlderThan: ["", "2y", "5y"],
  editedWithin: ["", "7d"],
  discontinued: ["", "yes", "no"],
  itemType: ["", "textbook", "used_textbook", "general_merchandise", "supplies", "other"],
  unitsSoldWindow: ["", "30d", "90d", "1y", "3y", "lifetime"],
  revenueWindow: ["", "30d", "90d", "1y", "3y", "lifetime"],
  txnsWindow: ["", "1y", "lifetime"],
  firstSaleWithin: ["", "90d", "1y"],
  trendDirection: ["", "accelerating", "decelerating"],
};

function coerceNumericString(raw: string): string {
  if (raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return raw;
}

export function parseFiltersFromSearchParams(params: URLSearchParams): ProductFilters {
  const out: ProductFilters = { ...EMPTY_FILTERS };
  const mut = out as unknown as Record<string, unknown>;

  const rawTab = params.get("tab");
  if (rawTab === "textbooks" || rawTab === "merchandise" || rawTab === "quickPicks") {
    out.tab = rawTab;
  }

  for (const key of BOOL_KEYS) {
    const v = params.get(key);
    if (v === "true") mut[key] = true;
  }

  for (const key of NUMERIC_STRING_KEYS) {
    const v = params.get(key);
    if (v !== null) mut[key] = coerceNumericString(v);
  }

  for (const key of TEXT_KEYS) {
    const v = params.get(key);
    if (v !== null) mut[key] = v;
  }

  for (const [key, allowed] of Object.entries(ENUM_KEYS)) {
    const v = params.get(key);
    if (v !== null && (allowed as readonly string[]).includes(v)) {
      mut[key] = v;
    }
  }

  const sortBy = params.get("sortBy");
  if (sortBy) out.sortBy = sortBy;

  const page = Number(params.get("page") ?? "1");
  out.page = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  out.locationIds = parseProductLocationIdsParam(params.get("loc"));

  // Log unknown keys once per parse so schema drift is visible in console
  // without throwing. EMPTY_FILTERS is the allow-list.
  const known = new Set<string>([
    ...Object.keys(EMPTY_FILTERS).filter((key) => key !== "locationIds"),
    "view",
    "q",
    "loc",
  ]);
  const seenKeys: string[] = [];
  params.forEach((_, key) => {
    if (seenKeys.indexOf(key) === -1) seenKeys.push(key);
  });
  for (const key of seenKeys) {
    if (!known.has(key) && typeof console !== "undefined") {
      console.warn(`[products filter] ignoring unknown key: ${key}`);
    }
  }

  // Backward compat: legacy bookmarks used `q` for the search term.
  const legacyQ = params.get("q");
  if (legacyQ && !out.search) {
    out.search = legacyQ;
  }

  // Backfill: legacy saved views stored classification as deptNum/classNum/catNum
  // separately. If the URL carries a full triple with no explicit dccComposite,
  // derive one so the new chip and composite filter work without a destructive
  // migration.
  if (!out.dccComposite && out.deptNum && out.classNum && out.catNum) {
    out.dccComposite = `${out.deptNum}-${out.classNum}-${out.catNum}`;
  }

  return out;
}

export function serializeFiltersToSearchParams(
  filters: ProductFilters,
  extras: { view?: string } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = EMPTY_FILTERS as unknown as Record<string, unknown>;
  const defaultLoc = serializeProductLocationIdsParam(DEFAULT_PRODUCT_LOCATION_IDS);

  for (const [key, value] of Object.entries(filters)) {
    if (key === "locationIds") continue;
    const def = defaults[key];
    if (value === def) continue;
    if (value === "" || value === false || value === null || value === undefined) continue;
    params.set(key, String(value));
  }

  const loc = serializeProductLocationIdsParam(filters.locationIds);
  if (loc !== defaultLoc) {
    params.set("loc", loc);
  }

  if (extras.view) params.set("view", extras.view);
  return params;
}

export interface AppliedPreset {
  filters: ProductFilters;
  visibleColumns: OptionalColumnKey[] | null;
}

export function applyPreset(view: SavedView, current: ProductFilters): AppliedPreset {
  const filters: ProductFilters = {
    ...EMPTY_FILTERS,
    tab: current.tab,
    search: current.search,
    locationIds: cloneProductLocationIds(current.locationIds),
    ...view.filter,
  } as ProductFilters;
  filters.locationIds = normalizeProductLocationIds(filters.locationIds);
  let visibleColumns: OptionalColumnKey[] | null = null;
  if (view.columnPreferences) {
    visibleColumns = view.columnPreferences.visible.filter(
      (k): k is OptionalColumnKey => (OPTIONAL_COLUMNS as readonly string[]).includes(k),
    );
  }
  return { filters, visibleColumns };
}
