import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { loadState, saveState } from "@/lib/storage";

export type UiRunCacheEntry = {
  summary: RotationSummary;
};

type StoredRunCache = {
  version: 2;
  entries: Array<{ fingerprint: string; entry: UiRunCacheEntry }>;
};

const UI_RUN_CACHE_VERSION = 2;
export const UI_RUN_CACHE_KEY = "eq:combat-run-cache:v2";
const MAX = 12;
const order: string[] = [];
const map = new Map<string, UiRunCacheEntry>();
let hydrated = false;

function normalizeStoredRunCache(raw: unknown): StoredRunCache {
  if (
    !raw ||
    typeof raw !== "object" ||
    (raw as { version?: unknown }).version !== UI_RUN_CACHE_VERSION
  ) {
    return { version: UI_RUN_CACHE_VERSION, entries: [] };
  }
  const entries = Array.isArray((raw as { entries?: unknown }).entries)
    ? (raw as { entries: unknown[] }).entries
    : [];
  return {
    version: UI_RUN_CACHE_VERSION,
    entries: entries
      .flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const row = candidate as { fingerprint?: unknown; entry?: unknown };
        if (typeof row.fingerprint !== "string" || !row.fingerprint) return [];
        if (!row.entry || typeof row.entry !== "object") return [];
        const summary = (row.entry as { summary?: unknown }).summary;
        if (!summary || typeof summary !== "object") return [];
        const shape = summary as Partial<RotationSummary>;
        if (
          typeof shape.ok !== "boolean" ||
          typeof shape.totalExpected !== "number" ||
          typeof shape.dps !== "number" ||
          !Array.isArray(shape.casts)
        ) {
          return [];
        }
        return [
          {
            fingerprint: row.fingerprint,
            entry: { summary: shape as RotationSummary },
          },
        ];
      })
      .slice(-MAX),
  };
}

function persist(): void {
  saveState(UI_RUN_CACHE_KEY, {
    version: UI_RUN_CACHE_VERSION,
    entries: order.flatMap((fingerprint) => {
      const entry = map.get(fingerprint);
      return entry ? [{ fingerprint, entry }] : [];
    }),
  } satisfies StoredRunCache);
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const stored = loadState<StoredRunCache>(
    UI_RUN_CACHE_KEY,
    { version: UI_RUN_CACHE_VERSION, entries: [] },
    normalizeStoredRunCache,
  );
  for (const { fingerprint, entry } of stored.entries) {
    map.set(fingerprint, entry);
    order.push(fingerprint);
  }
}

export function getUiRunCache(fingerprint: string): UiRunCacheEntry | null {
  hydrate();
  const hit = map.get(fingerprint);
  if (!hit) return null;
  const index = order.indexOf(fingerprint);
  if (index >= 0) {
    order.splice(index, 1);
    order.push(fingerprint);
    persist();
  }
  return hit;
}

export function setUiRunCache(fingerprint: string, entry: UiRunCacheEntry): void {
  hydrate();
  map.set(fingerprint, entry);
  const index = order.indexOf(fingerprint);
  if (index >= 0) order.splice(index, 1);
  order.push(fingerprint);
  while (order.length > MAX) {
    const oldest = order.shift();
    if (oldest) map.delete(oldest);
  }
  persist();
}

export function clearUiRunCache(): void {
  map.clear();
  order.length = 0;
  hydrated = true;
  try {
    window.localStorage.removeItem(UI_RUN_CACHE_KEY);
  } catch {}
}

export function reloadUiRunCacheForTests(): void {
  map.clear();
  order.length = 0;
  hydrated = false;
}
