"use client";

import { useEffect, useState } from "react";
import { productApi, type PrismVendorRef } from "./api-client";

type DirectoryState = {
  vendors: PrismVendorRef[];
  byId: Map<number, string>;
  loading: boolean;
  available: boolean;
};

let cached: DirectoryState | null = null;
let pending: Promise<DirectoryState> | null = null;
const listeners = new Set<(state: DirectoryState) => void>();

function emit(state: DirectoryState) {
  cached = state;
  listeners.forEach((fn) => fn(state));
}

async function load(): Promise<DirectoryState> {
  // Only reuse the cached state if it was a successful load. A failed lookup
  // leaves `available: false` but MUST NOT permanently downgrade the UI to
  // raw numeric IDs — later mounts should retry instead.
  if (cached && cached.available) return cached;
  if (pending) return pending;
  pending = productApi
    .refs()
    .then((refs) => {
      const byId = new Map<number, string>(
        refs.vendors.map((v) => [v.vendorId, v.name]),
      );
      const state: DirectoryState = {
        vendors: refs.vendors,
        byId,
        loading: false,
        available: true,
      };
      emit(state);
      return state;
    })
    .catch(() => {
      const state: DirectoryState = {
        vendors: [],
        byId: new Map(),
        loading: false,
        available: false,
      };
      // Emit so any mounted consumers unblock from the loading spinner, but
      // clear the module cache so the next load() triggers a real retry.
      cached = null;
      listeners.forEach((fn) => fn(state));
      return state;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * React hook that returns a cached vendor directory ({ id → name }) sourced
 * from the Prism-backed `/api/products/refs` endpoint. Gracefully degrades to
 * `{ available: false }` when Prism is unreachable.
 */
export function useVendorDirectory(): DirectoryState {
  const [state, setState] = useState<DirectoryState>(
    () =>
      cached ?? {
        vendors: [],
        byId: new Map(),
        loading: true,
        available: false,
      },
  );

  useEffect(() => {
    let mounted = true;
    const listener = (next: DirectoryState) => {
      if (mounted) setState(next);
    };
    listeners.add(listener);
    if (!cached) {
      load();
    }
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  // If the directory is unavailable (Prism blip), retry every 30s so a brief
  // outage doesn't permanently downgrade the vendor UI mid-session.
  useEffect(() => {
    if (state.available || state.loading) return;
    const timer = setTimeout(() => load(), 30_000);
    return () => clearTimeout(timer);
  }, [state.available, state.loading]);

  return state;
}

/** Format a vendor_id into "Name · #id" when name is known, else "#id". */
export function formatVendor(vendorId: number, byId: Map<number, string>): string {
  const name = byId.get(vendorId);
  return name ? name : `#${vendorId}`;
}
