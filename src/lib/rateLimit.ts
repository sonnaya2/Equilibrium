/**
 * In-memory sliding-window rate limiter (per key, typically client IP).
 * Process-local only - fine for single-instance / serverless warm isolates.
 */

export type RateLimitResult = {
  allowed: boolean;
  /** Requests remaining in the current window after this check. */
  remaining: number;
  /** Seconds until the oldest hit leaves the window (0 when allowed). */
  retryAfterSec: number;
  limit: number;
  windowMs: number;
};

export type RateLimitOptions = {
  /** Max hits per window. Default 30. */
  limit?: number;
  /** Window length in ms. Default 60_000 (1 min). */
  windowMs?: number;
  /** Injectable clock for tests. */
  now?: number;
};

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;

/** key → hit timestamps (ms), oldest first */
const store = new Map<string, number[]>();

function prune(hits: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  // Hits are append-only chronological; drop prefix.
  let i = 0;
  while (i < hits.length && hits[i]! <= cutoff) i += 1;
  return i === 0 ? hits : hits.slice(i);
}

/**
 * Record a hit for `key` and return whether it is within the limit.
 * Call once per request (side-effect: stores the hit when allowed).
 */
export function rateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.now ?? Date.now();
  const safeKey = key.trim() || "unknown";

  let hits = prune(store.get(safeKey) ?? [], now, windowMs);

  if (hits.length >= limit) {
    store.set(safeKey, hits);
    const oldest = hits[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      limit,
      windowMs,
    };
  }

  hits = [...hits, now];
  store.set(safeKey, hits);

  return {
    allowed: true,
    remaining: Math.max(0, limit - hits.length),
    retryAfterSec: 0,
    limit,
    windowMs,
  };
}

/** Peek without recording a hit (tests / diagnostics). */
export function rateLimitPeek(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.now ?? Date.now();
  const safeKey = key.trim() || "unknown";
  const hits = prune(store.get(safeKey) ?? [], now, windowMs);
  store.set(safeKey, hits);

  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      limit,
      windowMs,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - hits.length),
    retryAfterSec: 0,
    limit,
    windowMs,
  };
}

/** Clear all keys (unit tests). */
export function resetRateLimitStore(): void {
  store.clear();
}

/**
 * Client IP from proxy headers. Prefers first X-Forwarded-For hop, then X-Real-IP.
 * Falls back to `"unknown"` when nothing usable is present.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}
