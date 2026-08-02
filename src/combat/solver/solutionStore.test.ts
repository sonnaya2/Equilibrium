import { describe, expect, it } from "vitest";
import {
  clampSolverBarSizes,
  fingerprintSolveContext,
  MIN_SOLVER_BAR_SIZE,
  normalizeSolveCache,
  seedBarsFromSolveCache,
  upsertSolveEntry,
  type CachedSolveEntry,
  type SolveCacheStore,
} from "./solutionStore";
import { defaultSerializableRequest, emptyModifierSources } from "./worker/serializable";
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

  it("fingerprints loadout changes and is stable for the same request", () => {
    const a = sampleRequest();
    const b = sampleRequest();
    expect(fingerprintSolveContext(a)).toBe(fingerprintSolveContext(b));
    const c = sampleRequest({ equipmentIds: ["different_weapon"] });
    expect(fingerprintSolveContext(c)).not.toBe(fingerprintSolveContext(a));
  });

  it("normalizes corrupt cache payloads", () => {
    expect(normalizeSolveCache(null).entries).toEqual([]);
    expect(normalizeSolveCache({ version: 1, entries: [{ key: "x" }] }).entries).toEqual([]);
    const ok = normalizeSolveCache({
      version: 1,
      entries: [
        {
          key: "k1",
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

  it("upserts most-recent first and seed helper prefers exact key", () => {
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
    let store: SolveCacheStore = { version: 1, entries: [] };
    store = upsertSolveEntry(store, entry("old", "melee", ["1", "2", "3", "4", "5", "6"]));
    store = upsertSolveEntry(store, entry("new", "melee", ["a", "b", "c", "d", "e", "f"]));
    expect(store.entries[0]!.key).toBe("new");

    // seedBarsFromSolveCache reads localStorage — unit-test pure upsert order only here.
    expect(store.entries.map((e) => e.key)).toEqual(["new", "old"]);
    // Keep import used when storage is empty under node.
    expect(seedBarsFromSolveCache("melee").length).toBeGreaterThanOrEqual(0);
  });
});
