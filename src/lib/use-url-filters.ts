"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const val = searchParams.get(key);
      if (val !== null) (result as Record<string, string>)[key] = val;
    }
    return result;
  }, [searchParams, defaults]);

  const setFilter = useCallback(
    (key: keyof T, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== defaults[key as string]) {
        params.set(key as string, value);
      } else {
        params.delete(key as string);
      }
      if (key !== "page") params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [searchParams, router, pathname, defaults, startTransition],
  );

  const setFilters = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== defaults[key]) {
          params.set(key, value as string);
        } else {
          params.delete(key);
        }
      }
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [searchParams, router, pathname, defaults, startTransition],
  );

  const resetFilters = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [router, pathname, startTransition]);

  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of Object.keys(defaults)) {
      if (["page", "pageSize", "sortBy", "sortOrder"].includes(key)) continue;
      if (filters[key as keyof T] && filters[key as keyof T] !== defaults[key])
        count++;
    }
    return count;
  }, [filters, defaults]);

  return { filters, setFilter, setFilters, resetFilters, activeCount };
}
