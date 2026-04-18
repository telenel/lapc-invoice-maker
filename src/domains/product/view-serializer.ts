import { EMPTY_FILTERS, OPTIONAL_COLUMNS } from "./constants";
import type { OptionalColumnKey } from "./constants";
import type {
  ProductFilters,
  ProductTab,
  SavedView,
} from "./types";

const BOOL_KEYS: (keyof ProductFilters)[] = [
  "hasBarcode", "hasIsbn",
  "missingBarcode", "missingIsbn", "missingTitle",
  "retailBelowCost", "zeroPrice",
  "lastSaleNever", "editedSinceSync",
];

const NUMERIC_STRING_KEYS: (keyof ProductFilters)[] = [
  "minPrice", "maxPrice", "vendorId",
  "minStock", "maxStock",
  "deptNum", "classNum", "catNum",
  "minMargin", "maxMargin",
];

const TEXT_KEYS: (keyof ProductFilters)[] = [
  "search", "author", "edition", "catalogNumber", "productType",
  "lastSaleDateFrom", "lastSaleDateTo",
];

const ENUM_KEYS: { [K in keyof ProductFilters]?: readonly ProductFilters[K][] } = {
  tab: ["textbooks", "merchandise"],
  sortDir: ["asc", "desc"],
  lastSaleWithin: ["", "30d", "90d", "365d"],
  lastSaleOlderThan: ["", "2y", "5y"],
  editedWithin: ["", "7d"],
  discontinued: ["", "yes", "no"],
  itemType: ["", "textbook", "used_textbook", "general_merchandise", "supplies", "other"],
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
  if (rawTab === "textbooks" || rawTab === "merchandise") {
    out.tab = rawTab as ProductTab;
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

  // Log unknown keys once per parse so schema drift is visible in console
  // without throwing. EMPTY_FILTERS is the allow-list.
  const known = new Set<string>([...Object.keys(EMPTY_FILTERS), "view", "q"]);
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

  return out;
}

export function serializeFiltersToSearchParams(
  filters: ProductFilters,
  extras: { view?: string } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = EMPTY_FILTERS as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(filters)) {
    const def = defaults[key];
    if (value === def) continue;
    if (value === "" || value === false || value === null || value === undefined) continue;
    params.set(key, String(value));
  }

  if (extras.view) params.set("view", extras.view);
  return params;
}

export interface AppliedPreset {
  filters: ProductFilters;
  visibleColumns: OptionalColumnKey[] | null;
}

export function applyPreset(view: SavedView): AppliedPreset {
  const filters: ProductFilters = { ...EMPTY_FILTERS, ...view.filter } as ProductFilters;
  let visibleColumns: OptionalColumnKey[] | null = null;
  if (view.columnPreferences) {
    visibleColumns = view.columnPreferences.visible.filter(
      (k): k is OptionalColumnKey => (OPTIONAL_COLUMNS as readonly string[]).includes(k),
    );
  }
  return { filters, visibleColumns };
}
