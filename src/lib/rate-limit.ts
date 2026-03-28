// In-memory sliding window rate limiter for login attempts.
// Keyed by IP or username. Entries auto-expire.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/** Remove expired timestamps from the window. */
function pruneEntry(entry: RateLimitEntry, now: number): number[] {
  return entry.timestamps.filter((t) => now - t < WINDOW_MS);
}

/**
 * Check if the key has exceeded the rate limit.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { timestamps: [now] });
    return { allowed: true };
  }

  const valid = pruneEntry(entry, now);

  if (valid.length >= MAX_ATTEMPTS) {
    const oldest = valid[0];
    const retryAfterMs = WINDOW_MS - (now - oldest);
    store.set(key, { timestamps: valid });
    return { allowed: false, retryAfterMs };
  }

  store.set(key, { timestamps: [...valid, now] });
  return { allowed: true };
}

/** Periodically clean up expired entries to prevent memory leaks. */
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    const valid = pruneEntry(entry, now);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, { timestamps: valid });
    }
  });
}, 60 * 1000);
