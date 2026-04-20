export type ProductLocationId = 2 | 3 | 4;

const CANONICAL_PRODUCT_LOCATION_IDS: ProductLocationId[] = [2, 3, 4];

export const DEFAULT_PRODUCT_LOCATION_IDS: ProductLocationId[] = [...CANONICAL_PRODUCT_LOCATION_IDS];

function isProductLocationId(value: number): value is ProductLocationId {
  return value === 2 || value === 3 || value === 4;
}

export function normalizeProductLocationIds(ids: number[]): ProductLocationId[] {
  const valid = new Set(ids.filter(isProductLocationId));
  const normalized = CANONICAL_PRODUCT_LOCATION_IDS.filter((id) => valid.has(id));
  return normalized.length > 0 ? normalized : [...DEFAULT_PRODUCT_LOCATION_IDS];
}

export function parseProductLocationIdsParam(raw: string | null): ProductLocationId[] {
  if (!raw) return [...DEFAULT_PRODUCT_LOCATION_IDS];

  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => Number(value));

  return normalizeProductLocationIds(ids);
}

export function serializeProductLocationIdsParam(ids: ProductLocationId[]): string {
  return normalizeProductLocationIds(ids).join(",");
}

export function getPrimaryProductLocationId(ids: ProductLocationId[]): ProductLocationId {
  return normalizeProductLocationIds(ids)[0];
}
