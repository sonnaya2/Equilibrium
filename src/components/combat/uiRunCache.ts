/**
 * Session memo for identical Revolution Runs (fingerprint -> last result).
 * Main-thread only; does not share across tabs.
 */
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import type { BranchFidelityMeta } from "./RevoRunResults";

export type UiRunCacheEntry = {
  summary: RotationSummary;
  meta: BranchFidelityMeta;
};

const MAX = 12;
const order: string[] = [];
const map = new Map<string, UiRunCacheEntry>();

export function getUiRunCache(fingerprint: string): UiRunCacheEntry | null {
  const hit = map.get(fingerprint);
  if (!hit) return null;
  // LRU touch
  const i = order.indexOf(fingerprint);
  if (i >= 0) {
    order.splice(i, 1);
    order.push(fingerprint);
  }
  return hit;
}

export function setUiRunCache(fingerprint: string, entry: UiRunCacheEntry): void {
  if (map.has(fingerprint)) {
    map.set(fingerprint, entry);
    const i = order.indexOf(fingerprint);
    if (i >= 0) {
      order.splice(i, 1);
      order.push(fingerprint);
    }
    return;
  }
  map.set(fingerprint, entry);
  order.push(fingerprint);
  while (order.length > MAX) {
    const old = order.shift();
    if (old) map.delete(old);
  }
}

export function clearUiRunCache(): void {
  map.clear();
  order.length = 0;
}
