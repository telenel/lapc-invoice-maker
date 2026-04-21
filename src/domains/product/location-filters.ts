export type ProductLocationId = 2 | 3 | 4;

const CANONICAL_PRODUCT_LOCATION_IDS = [2, 3, 4] as const;
export const PRODUCT_LOCATION_ABBREV_BY_ID: Record<ProductLocationId, "PIER" | "PCOP" | "PFS"> = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
};

export const DEFAULT_PRODUCT_LOCATION_IDS: readonly ProductLocationId[] = CANONICAL_PRODUCT_LOCATION_IDS;

export function cloneProductLocationIds(ids: readonly ProductLocationId[]): ProductLocationId[] {
  return [...ids];
}

function isProductLocationId(value: number): value is ProductLocationId {
  return value === 2 || value === 3 || value === 4;
}

export function normalizeProductLocationIds(ids: readonly number[]): ProductLocationId[] {
  const valid = new Set(ids.filter(isProductLocationId));
  const normalized = CANONICAL_PRODUCT_LOCATION_IDS.filter((id) => valid.has(id));
  return normalized.length > 0 ? normalized : cloneProductLocationIds(DEFAULT_PRODUCT_LOCATION_IDS);
}

export function parseProductLocationIdsParam(raw: string | null): ProductLocationId[] {
  if (!raw) return cloneProductLocationIds(DEFAULT_PRODUCT_LOCATION_IDS);

  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => Number(value));

  return normalizeProductLocationIds(ids);
}

export function serializeProductLocationIdsParam(ids: readonly ProductLocationId[]): string {
  return normalizeProductLocationIds(ids).join(",");
}

export function getPrimaryProductLocationId(ids: readonly ProductLocationId[]): ProductLocationId {
  return normalizeProductLocationIds(ids)[0];
}

export function formatProductLocationList(ids: readonly number[]): string {
  return normalizeProductLocationIds(ids).map((id) => PRODUCT_LOCATION_ABBREV_BY_ID[id]).join(", ");
}
