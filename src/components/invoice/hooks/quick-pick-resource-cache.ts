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
  if (process.env.NODE_ENV === "test") {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${key}: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing?.promise) {
    return existing.promise;
  }

  if (existing?.data !== undefined && existing.expiresAt > now) {
    return existing.data;
  }

  const promise = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch ${key}: ${response.status}`);
      }
      return response.json();
    })
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
    data: existing?.data,
    expiresAt: existing?.expiresAt ?? 0,
    promise,
  });

  return promise;
}

interface QuickPickResourceOptions {
  includeSavedItems?: boolean;
  includeUserPicks?: boolean;
}

export async function getQuickPickResources(
  department: string,
  options: QuickPickResourceOptions = {},
) {
  const { includeSavedItems = true, includeUserPicks = true } = options;
  const deptParam = department ? `?department=${encodeURIComponent(department)}` : "";

  const [quickPicks, savedItems, userPicks] = await Promise.all([
    getCachedJson<QuickPick[]>(`quick-picks:${department}`, `/api/quick-picks${deptParam}`).catch(() => []),
    includeSavedItems && department
      ? getCachedJson<SavedItem[]>(`saved-items:${department}`, `/api/saved-items${deptParam}`).catch(() => [])
      : Promise.resolve([]),
    includeUserPicks && department
      ? getCachedJson<UserPick[]>(`user-quick-picks:${department}`, `/api/user-quick-picks${deptParam}`).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    quickPicks: Array.isArray(quickPicks) ? quickPicks : [],
    savedItems: Array.isArray(savedItems) ? savedItems : [],
    userPicks: Array.isArray(userPicks) ? userPicks : [],
  };
}
