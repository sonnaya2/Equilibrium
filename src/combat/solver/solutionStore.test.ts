import { describe, expect, it } from "vitest";
import {
  clampSolverBarSizes,
  fingerprintSolveContext,
  MIN_SOLVER_BAR_SIZE,
  normalizeSolveCache,
  solveContextPayload,
  sha256Hex,
  upsertSolveEntry,
  type CachedSolveEntry,
  type SolveCacheStore,
} from "./solutionStore";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  isSerializableSimBase,
} from "./worker/serializable";
import type { ActiveEquipmentEffects } from "../shared/equipment";

const emptyEffects: ActiveEquipmentEffects = {
  activation: "pre-activated-static-loadout",
  passiveIds: [],
  enchantments: [],
  weaponClass: null,
  defenderEquipped: false,
  passage: { active: false, agonyActive: false },
  amZiFlatDamage: 0,
  amHejDamageBonus: 0,
  vestments: {
    pieces: 0,
    heraldOfChaos: false,
    berserkExtension: false,
    increasedAdrenalineCap: false,
  },
};

function sampleRequest(overrides: { equipmentIds?: string[]; style?: "melee" | "magic" } = {}) {
  return defaultSerializableRequest({
    style: overrides.style ?? "melee",
    durationTicks: 500,
    minBarSize: 6,
    maxBarSize: 10,
    tier: "thorough",
    profileId: "balanced",
    unlockedRegions: ["misthalin", "karamja"],
    loadout: {
      base: 1200,
      level: 99,
      accuracy: 0.85,
      crit: { chance: 0.12 },
      equipmentEffects: emptyEffects,
      league: {
        ruleset: "base",
        blessings: [],
        blessingIds: [],
        totalArmour: 0,
        maximumLife: 10_000,
        powerburstUntilTick: 0,
        targetTiles: 1,
      },
      equipmentIds: overrides.equipmentIds ?? ["abyssal_whip"],
      weaponConfiguration: "dualwield",
      startingAdrenaline: 100,
      modifierSources: emptyModifierSources(),
    },
  });
}

describe("solutionStore", () => {
  it("clamps bar sizes to the product floor", () => {
    expect(clampSolverBarSizes(4, 10)).toEqual({ minBarSize: 6, maxBarSize: 10 });
    expect(clampSolverBarSizes(8, 7)).toEqual({ minBarSize: 8, maxBarSize: 8 });
    expect(clampSolverBarSizes(undefined, undefined).minBarSize).toBe(MIN_SOLVER_BAR_SIZE);
  });

  it("fingerprints loadout changes and is stable for the same request", async () => {
    const a = sampleRequest();
    const b = sampleRequest();
    expect(await fingerprintSolveContext(a)).toBe(await fingerprintSolveContext(b));
    const c = sampleRequest({ equipmentIds: ["different_weapon"] });
    expect(await fingerprintSolveContext(c)).not.toBe(await fingerprintSolveContext(a));
    // Compact SHA-256 hex (64 chars).
    expect(await fingerprintSolveContext(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores powerburst remaining ticks so cache hits while the buff is merely counting down", async () => {
    const a = sampleRequest();
    if (!isSerializableSimBase(a.loadout)) throw new Error("expected sim base");
    const b = structuredClone(a);
    if (!isSerializableSimBase(b.loadout)) throw new Error("expected sim base");
    a.loadout = {
      ...a.loadout,
      league: { ...a.loadout.league, powerburstUntilTick: 10 },
    };
    b.loadout = {
      ...b.loadout,
      league: { ...b.loadout.league, powerburstUntilTick: 3 },
    };
    expect(await fingerprintSolveContext(a)).toBe(await fingerprintSolveContext(b));
    const off = structuredClone(a);
    if (!isSerializableSimBase(off.loadout)) throw new Error("expected sim base");
    off.loadout = {
      ...off.loadout,
      league: { ...off.loadout.league, powerburstUntilTick: 0 },
    };
    expect(await fingerprintSolveContext(off)).not.toBe(await fingerprintSolveContext(a));
  });

  it("fingerprints includeBigBonedOutgoingDamage so experimental scoring cannot share cache", async () => {
    const safe = sampleRequest();
    if (!isSerializableSimBase(safe.loadout)) throw new Error("expected sim base");
    const experimental = structuredClone(safe);
    if (!isSerializableSimBase(experimental.loadout)) throw new Error("expected sim base");
    experimental.loadout = {
      ...experimental.loadout,
      league: {
        ...experimental.loadout.league,
        blessingIds: ["big-boned"],
        includeBigBonedOutgoingDamage: true,
      },
    };
    expect(await fingerprintSolveContext(experimental)).not.toBe(
      await fingerprintSolveContext(safe),
    );
  });

  it("sha256Hex is deterministic and compact", async () => {
    const h = await sha256Hex("equilibrium");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("equilibrium")).toBe(h);
    expect(await sha256Hex("other")).not.toBe(h);
  });

  it("canonical payload is much smaller than a raw request dump for storage keys", () => {
    const req = sampleRequest();
    const payload = solveContextPayload(req);
    // Payload is stable JSON; the key is only its hash (64 chars), not this string.
    expect(payload.length).toBeLessThan(4_000);
    expect(payload.includes("powerburstUntilTick")).toBe(false);
    expect(payload.includes("powerburstActive")).toBe(true);
  });

  it("normalizes corrupt cache payloads", () => {
    expect(normalizeSolveCache(null).entries).toEqual([]);
    expect(normalizeSolveCache({ version: 2, entries: [{ key: "x" }] }).entries).toEqual([]);
    const ok = normalizeSolveCache({
      version: 2,
      entries: [
        {
          key: "a".repeat(64),
          style: "melee",
          bar: ["a", "b", "c", "d", "e", "f"],
          score: 12_000,
          top: [{ bar: ["a", "b", "c", "d", "e", "g"], score: 11_000 }],
          savedAt: 1,
        },
      ],
    });
    expect(ok.entries).toHaveLength(1);
    expect(ok.entries[0]!.bar).toHaveLength(6);
    expect(ok.entries[0]!.top).toHaveLength(1);
  });

  it("upserts most-recent first", () => {
    const entry = (key: string, style: string, bar: string[]): CachedSolveEntry => ({
      key,
      style,
      profileId: "balanced",
      tier: "thorough",
      minBarSize: 6,
      maxBarSize: 10,
      bar,
      score: 1,
      top: [],
      savedAt: 1,
    });
    let store: SolveCacheStore = { version: 2, entries: [] };
    store = upsertSolveEntry(store, entry("old", "melee", ["1", "2", "3", "4", "5", "6"]));
    store = upsertSolveEntry(store, entry("new", "melee", ["a", "b", "c", "d", "e", "f"]));
    expect(store.entries[0]!.key).toBe("new");
    expect(store.entries.map((e) => e.key)).toEqual(["new", "old"]);
  });
});
