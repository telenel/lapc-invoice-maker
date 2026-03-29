// In-memory sliding window rate limiter for login attempts and other endpoints.
// Keyed by IP or username. Entries auto-expire.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Check if the key has exceeded the rate limit.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  key: string,
  options?: { maxAttempts?: number; windowMs?: number }
): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { timestamps: [now] });
    return { allowed: true };
  }

  const valid = entry.timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= maxAttempts) {
    const oldest = valid[0];
    const retryAfterMs = windowMs - (now - oldest);
    store.set(key, { timestamps: valid });
    return { allowed: false, retryAfterMs };
  }

  store.set(key, { timestamps: [...valid, now] });
  return { allowed: true };
}

/** Periodically clean up entries older than the longest supported window to prevent memory leaks. */
const CLEANUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour — covers all rate limit windows
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    const valid = entry.timestamps.filter((t) => now - t < CLEANUP_WINDOW_MS);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, { timestamps: valid });
    }
  });
}, 60 * 1000);
