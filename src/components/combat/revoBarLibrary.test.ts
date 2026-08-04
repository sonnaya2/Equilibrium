import { afterEach, describe, expect, it } from "vitest";
import {
  emptyBarLibrary,
  isBarAlreadySaved,
  isScoreVerifiedForContext,
  libraryForStyle,
  loadBarLibrary,
  MAX_RECENT_BARS,
  normalizeBarLibrary,
  REVO_BAR_LIBRARY_KEY,
  resetBarLibraryForTests,
  barScoreContext,
  withPermanentBar,
  withRecentBar,
  withoutRecentBar,
  withoutSavedBar,
  type RevoBarLibrary,
} from "./revoBarLibrary";

const BAR_A = ["slice", "fury", "assault", "destroy", "pulverise"];
const BAR_B = ["slice", "fury", "assault", "destroy", "meteor_strike"];
const BAR_C = ["slice", "fury", "assault", "cleave", "pulverise"];
const BAR_D = ["slice", "fury", "assault", "sever", "pulverise"];
const BAR_E = ["slice", "fury", "assault", "smash", "pulverise"];
const BAR_F = ["slice", "fury", "assault", "havoc", "pulverise"];

const CTX_A = '{"style":"melee","equip":"whip"}';
const CTX_B = '{"style":"melee","equip":"scythe"}';
const V1_KEY = "eq:revo-bars:v1";

function empty(): RevoBarLibrary {
  return emptyBarLibrary();
}

/** Minimal localStorage for load/migrate paths under node vitest. */
function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
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

afterEach(() => {
  resetBarLibraryForTests();
});

describe("revoBarLibrary", () => {
  it("normalizes corrupt storage to empty lists", () => {
    expect(normalizeBarLibrary(null).recents).toEqual([]);
    expect(normalizeBarLibrary({ version: 1, recents: "nope" }).saved).toEqual([]);
    expect(
      normalizeBarLibrary({
        version: 1,
        recents: [{ id: "x", style: "melee", bar: [] }],
        saved: [{ id: "y", style: "melee", bar: ["ok", "ok2"] }],
      }).saved,
    ).toHaveLength(1);
  });

  it("auto-keeps only the last five autosaves (MRU)", () => {
    const bars = [BAR_A, BAR_B, BAR_C, BAR_D, BAR_E, BAR_F];
    let store = empty();
    bars.forEach((bar, i) => {
      store = withRecentBar(store, {
        bar,
        style: "melee",
        score: 1000 + i,
        now: 1_000 + i,
      });
    });
    expect(store.recents).toHaveLength(MAX_RECENT_BARS);
    expect([...store.recents[0]!.bar]).toEqual(BAR_F);
    expect(store.recents.map((e) => e.score)).toEqual([1005, 1004, 1003, 1002, 1001]);
    expect(store.recents.some((e) => e.bar.join() === BAR_A.join())).toBe(false);
  });

  it("re-pushing the same bar bumps it to front with a new score", () => {
    let store = withRecentBar(empty(), { bar: BAR_A, style: "melee", score: 10, now: 1 });
    store = withRecentBar(store, { bar: BAR_B, style: "melee", score: 20, now: 2 });
    store = withRecentBar(store, { bar: BAR_A, style: "melee", score: 99, now: 3 });
    expect(store.recents).toHaveLength(2);
    expect([...store.recents[0]!.bar]).toEqual(BAR_A);
    expect(store.recents[0]!.score).toBe(99);
  });

  it("keeps autosaves per style separate for the style filter", () => {
    let store = withRecentBar(empty(), { bar: BAR_A, style: "melee", score: 1, now: 1 });
    store = withRecentBar(store, { bar: BAR_B, style: "magic", score: 2, now: 2 });
    expect(libraryForStyle(store, "melee").recents).toHaveLength(1);
    expect(libraryForStyle(store, "magic").recents).toHaveLength(1);
    expect([...libraryForStyle(store, "melee").recents[0]!.bar]).toEqual(BAR_A);
  });

  it("permanently saves and does not duplicate the same fingerprint", () => {
    let store = withPermanentBar(empty(), {
      bar: BAR_A,
      style: "melee",
      score: 50,
      now: 1,
      verified: true,
      scoreContext: CTX_A,
    });
    store = withPermanentBar(store, {
      bar: BAR_A,
      style: "melee",
      score: 80,
      name: "Boss bar",
      now: 2,
      verified: true,
      scoreContext: CTX_A,
    });
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]!.score).toBe(80);
    expect(store.saved[0]!.name).toBe("Boss bar");
    expect(store.saved[0]!.verified).toBe(true);
    expect(store.saved[0]!.scoreContext).toBe(CTX_A);
    expect(isBarAlreadySaved(store, "melee", BAR_A)).toBe(true);
    expect(isBarAlreadySaved(store, "melee", BAR_B)).toBe(false);
  });

  it("manual stopped bars save as unverified (no verified score claim)", () => {
    const store = withPermanentBar(empty(), {
      bar: BAR_A,
      style: "melee",
      score: 999,
      now: 1,
      verified: false,
    });
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]!.verified).toBe(false);
    expect(store.saved[0]!.score).toBe(999);
    expect(store.saved[0]!.scoreContext).toBeNull();
    expect(store.saved[0]!.name).toMatch(/^5-slot · ~/);

    const recent = withRecentBar(empty(), {
      bar: BAR_B,
      style: "melee",
      score: 100,
      now: 2,
      verified: true,
      scoreContext: CTX_A,
    });
    expect(recent.recents[0]!.verified).toBe(true);
    expect(recent.recents[0]!.scoreContext).toBe(CTX_A);
    expect(recent.recents[0]!.name).not.toMatch(/~/);
  });

  it("cannot mark verified without scoreContext", () => {
    const recent = withRecentBar(empty(), {
      bar: BAR_A,
      style: "melee",
      score: 100,
      now: 1,
      verified: true,
    });
    expect(recent.recents[0]!.verified).toBe(false);
    expect(recent.recents[0]!.scoreContext).toBeNull();
    expect(recent.recents[0]!.score).toBe(100);
    expect(recent.recents[0]!.name).toMatch(/~/);

    const saved = withPermanentBar(empty(), {
      bar: BAR_B,
      style: "melee",
      score: 200,
      now: 2,
      verified: true,
      scoreContext: "   ",
    });
    expect(saved.saved[0]!.verified).toBe(false);
    expect(saved.saved[0]!.scoreContext).toBeNull();
    expect(saved.saved[0]!.score).toBe(200);
  });

  it("normalize forces verified false when scoreContext is missing", () => {
    const lib = normalizeBarLibrary({
      version: 1,
      recents: [{ id: "r1", style: "melee", bar: BAR_A, score: 1, savedAt: 1 }],
      saved: [
        {
          id: "s1",
          style: "melee",
          bar: BAR_B,
          score: 2,
          savedAt: 2,
          verified: true,
        },
        {
          id: "s2",
          style: "melee",
          bar: BAR_C,
          score: 3,
          savedAt: 3,
          verified: true,
          scoreContext: CTX_A,
        },
      ],
    });
    expect(lib.version).toBe(2);
    expect(lib.recents[0]!.verified).toBe(false);
    expect(lib.recents[0]!.scoreContext).toBeNull();
    expect(lib.saved[0]!.verified).toBe(false);
    expect(lib.saved[0]!.scoreContext).toBeNull();
    expect(lib.saved[1]!.verified).toBe(true);
    expect(lib.saved[1]!.scoreContext).toBe(CTX_A);
  });

  it("isScoreVerifiedForContext matches only when live context equals bound", () => {
    const entry = withRecentBar(empty(), {
      bar: BAR_A,
      style: "melee",
      score: 50,
      now: 1,
      verified: true,
      scoreContext: CTX_A,
    }).recents[0]!;
    expect(isScoreVerifiedForContext(entry, CTX_A)).toBe(true);
    expect(isScoreVerifiedForContext(entry, CTX_B)).toBe(false);
    expect(isScoreVerifiedForContext(entry, null)).toBe(false);
    expect(isScoreVerifiedForContext(entry, undefined)).toBe(false);
    expect(isScoreVerifiedForContext({ ...entry, verified: false }, CTX_A)).toBe(false);
    expect(barScoreContext("  x  ")).toBe("x");
    expect(barScoreContext("")).toBeNull();
    expect(barScoreContext(null)).toBeNull();
  });

  it("verified under loadout context A is not verified under loadout context B", () => {
    // Distinct solve-context payloads (equipment / sim identity), not bar shape.
    const loadoutCtxA = '{"solve":"whip","base":2000,"demon":false}';
    const loadoutCtxB = '{"solve":"scythe","base":2000,"demon":true}';
    const entry = withPermanentBar(empty(), {
      bar: BAR_A,
      style: "melee",
      score: 12_345,
      now: 1,
      verified: true,
      scoreContext: loadoutCtxA,
    }).saved[0]!;
    expect(entry.verified).toBe(true);
    expect(isScoreVerifiedForContext(entry, loadoutCtxA)).toBe(true);
    expect(isScoreVerifiedForContext(entry, loadoutCtxB)).toBe(false);
    // Same bar shape under a different sim identity stays unverified for live UI.
    expect(isScoreVerifiedForContext({ ...entry, scoreContext: loadoutCtxB }, loadoutCtxA)).toBe(
      false,
    );
  });

  it("migrates v1 library: keep all bars and scores, strip verified", () => {
    const v1Payload = {
      version: 1,
      recents: [
        {
          id: "r1",
          style: "melee",
          bar: BAR_A,
          score: 111,
          savedAt: 10,
          verified: true,
          name: "5-slot · 111",
        },
        {
          id: "r2",
          style: "magic",
          bar: BAR_B,
          score: 222,
          savedAt: 11,
          verified: false,
        },
      ],
      saved: [
        {
          id: "s1",
          style: "melee",
          bar: BAR_C,
          score: 333,
          savedAt: 12,
          verified: true,
          name: "Boss",
        },
      ],
    };
    window.localStorage.setItem(V1_KEY, JSON.stringify(v1Payload));

    const migrated = loadBarLibrary();
    expect(migrated.version).toBe(2);
    expect(migrated.recents).toHaveLength(2);
    expect(migrated.saved).toHaveLength(1);
    expect(migrated.recents.map((e) => e.score)).toEqual([111, 222]);
    expect(migrated.saved[0]!.score).toBe(333);
    expect(migrated.saved[0]!.name).toBe("Boss");
    expect([...migrated.recents[0]!.bar]).toEqual(BAR_A);
    expect([...migrated.saved[0]!.bar]).toEqual(BAR_C);
    for (const e of [...migrated.recents, ...migrated.saved]) {
      expect(e.verified).toBe(false);
      expect(e.scoreContext).toBeNull();
    }
    // Persisted under v2; v1 cleared.
    expect(window.localStorage.getItem(V1_KEY)).toBeNull();
    expect(window.localStorage.getItem(REVO_BAR_LIBRARY_KEY)).not.toBeNull();
    const again = loadBarLibrary();
    expect(again.recents).toHaveLength(2);
    expect(again.saved).toHaveLength(1);
  });

  it("Save does not touch autosaves and remove works", () => {
    let store = withRecentBar(empty(), { bar: BAR_A, style: "melee", score: 1, now: 1 });
    store = withPermanentBar(store, { bar: BAR_B, style: "melee", score: 2, now: 2 });
    expect(store.recents).toHaveLength(1);
    expect(store.saved).toHaveLength(1);
    const savedId = store.saved[0]!.id;
    const recentId = store.recents[0]!.id;
    store = withoutSavedBar(store, savedId);
    expect(store.saved).toHaveLength(0);
    expect(store.recents).toHaveLength(1);
    store = withoutRecentBar(store, recentId);
    expect(store.recents).toHaveLength(0);
  });
});
