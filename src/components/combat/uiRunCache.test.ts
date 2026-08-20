import { describe, expect, it, beforeEach } from "vitest";
import {
  clearUiRunCache,
  getUiRunCache,
  reloadUiRunCacheForTests,
  setUiRunCache,
  UI_RUN_CACHE_KEY,
} from "./uiRunCache";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";

function fakeSummary(n: number): RotationSummary {
  return {
    ok: true,
    totalExpected: n,
    dps: n,
    ticks: 10,
    horizonTicks: 10,
    casts: [],
    damageByTick: {},
    totalMin: n,
    totalMax: n,
    analysis: { byEffect: [], bySource: [] },
  } as unknown as RotationSummary;
}

function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { window?: { localStorage: typeof storage } }).window = {
    localStorage: storage,
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

installMemoryLocalStorage();

describe("uiRunCache", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearUiRunCache();
  });

  it("returns null on miss and stores hits", () => {
    expect(getUiRunCache("a")).toBeNull();
    setUiRunCache("a", {
      summary: fakeSummary(1),
    });
    expect(getUiRunCache("a")?.summary.totalExpected).toBe(1);
  });

  it("restores a cached result from local storage", () => {
    setUiRunCache("persisted", { summary: fakeSummary(42) });
    expect(window.localStorage.getItem(UI_RUN_CACHE_KEY)).not.toBeNull();
    reloadUiRunCacheForTests();
    expect(getUiRunCache("persisted")?.summary.totalExpected).toBe(42);
  });

  it("ignores summaries from the previous combat cache revision", () => {
    window.localStorage.setItem(
      "eq:combat-run-cache:v1",
      JSON.stringify({
        version: 1,
        entries: [{ fingerprint: "legacy", entry: { summary: fakeSummary(99) } }],
      }),
    );
    reloadUiRunCacheForTests();
    expect(getUiRunCache("legacy")).toBeNull();
  });

  it("evicts oldest when over capacity", () => {
    for (let i = 0; i < 14; i++) {
      setUiRunCache(`k${i}`, {
        summary: fakeSummary(i),
      });
    }
    expect(getUiRunCache("k0")).toBeNull();
    expect(getUiRunCache("k1")).toBeNull();
    expect(getUiRunCache("k13")?.summary.totalExpected).toBe(13);
  });
});
