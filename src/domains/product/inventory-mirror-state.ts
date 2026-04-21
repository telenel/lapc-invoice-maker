export const INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT = "1970-01-01T00:00:00.000Z";

const INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT_MS = Date.parse(
  INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT,
);

export function isLiveProductInventoryMirror(
  syncedAt: string | Date | null | undefined,
): boolean {
  if (syncedAt == null) {
    return true;
  }

  const timestamp = syncedAt instanceof Date ? syncedAt.getTime() : Date.parse(syncedAt);
  return Number.isNaN(timestamp) || timestamp > INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT_MS;
}

export function filterLiveProductInventoryRows<T extends { synced_at?: string | Date | null }>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => isLiveProductInventoryMirror(row.synced_at));
}
