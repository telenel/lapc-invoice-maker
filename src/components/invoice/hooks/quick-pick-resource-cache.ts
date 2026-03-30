"use client";

interface QuickPick {
  id: string;
  department: string;
  description: string;
  defaultPrice: number;
  usageCount: number;
}

interface SavedItem {
  id: string;
  description: string;
  unitPrice: number;
  usageCount: number;
}

interface UserPick {
  id: string;
  description: string;
  unitPrice: number;
  department: string;
  usageCount: number;
  isCurrentDept: boolean;
}

interface CacheEntry<T> {
  data?: T;
  expiresAt: number;
  promise?: Promise<T>;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry<unknown>>();

async function getCachedJson<T>(key: string, url: string): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing?.data !== undefined && existing.expiresAt > now) {
    return existing.data;
  }

  if (existing?.promise) {
    return existing.promise;
  }

  const promise = fetch(url)
    .then((response) => (response.ok ? response.json() : []))
    .then((data) => {
      cache.set(key, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return data as T;
    })
    .catch(() => {
      cache.delete(key);
      throw new Error(`Failed to fetch ${key}`);
    });

  cache.set(key, {
    ...existing,
    expiresAt: now + CACHE_TTL_MS,
    promise,
  });

  return promise;
}

export async function getQuickPickResources(department: string) {
  const deptParam = department ? `?department=${encodeURIComponent(department)}` : "";

  const [quickPicks, savedItems, userPicks] = await Promise.all([
    getCachedJson<QuickPick[]>(`quick-picks:${department}`, `/api/quick-picks${deptParam}`).catch(() => []),
    department
      ? getCachedJson<SavedItem[]>(`saved-items:${department}`, `/api/saved-items${deptParam}`).catch(() => [])
      : Promise.resolve([]),
    department
      ? getCachedJson<UserPick[]>(`user-quick-picks:${department}`, `/api/user-quick-picks${deptParam}`).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    quickPicks: Array.isArray(quickPicks) ? quickPicks : [],
    savedItems: Array.isArray(savedItems) ? savedItems : [],
    userPicks: Array.isArray(userPicks) ? userPicks : [],
  };
}
