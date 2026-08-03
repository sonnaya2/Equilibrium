// localStorage-backed persistence for builds, task progress, saved rotations.
// No backend, no accounts - v1 keeps everything client-side.

/**
 * Read JSON from localStorage.

 * When `normalize` is provided it owns all shape validation (e.g. normalizeBuild)
 * and receives the raw parse result - including primitives / null - so callers
 * that already sanitize do not double-gate. Without a normalizer, non-object
 * values (and null) fall back; arrays count as objects and pass through.
 */
export function loadState<T>(key: string, fallback: T, normalize?: (raw: unknown) => T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (normalize) return normalize(parsed);
    // Safer default: reject primitives / null. Arrays and plain objects pass.
    if (parsed === null || typeof parsed !== "object") return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function saveState(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy-mode failures must not break the planner.
  }
}
