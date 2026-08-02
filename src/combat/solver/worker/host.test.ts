import { describe, expect, it, beforeEach } from "vitest";
import {
  isSolverPreferringMainThread,
  resetSolverHostForTests,
  runOptimize,
  runSolverOnMainThread,
} from "./host";
import { defaultSerializableRequest, emptyModifierSources } from "./serializable";
import type { ActiveEquipmentEffects } from "../../shared/equipment";

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

function tinyRequest() {
  return defaultSerializableRequest({
    style: "melee",
    durationTicks: 30,
    exploreDurationTicks: 20,
    tier: "thorough",
    profileId: "balanced",
    seed: 3,
    minBarSize: 3,
    maxBarSize: 5,
    unlockedRegions: ["misthalin", "havenhythe", "karamja"],
    loadout: {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
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
      equipmentIds: [],
      weaponConfiguration: "dualwield",
      startingAdrenaline: 100,
      modifierSources: emptyModifierSources(),
    },
  });
}

describe("runOptimize host", () => {
  beforeEach(() => {
    resetSolverHostForTests();
  });

  it("forceMainThread solves without Worker", async () => {
    const result = await runOptimize(tinyRequest(), undefined, { forceMainThread: true });
    expect(result.bar.length).toBeGreaterThanOrEqual(3);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.evaluations).toBeGreaterThan(0);
  }, 60_000);

  it("main-thread path matches runSolverOnMainThread shape", async () => {
    const a = await runSolverOnMainThread(tinyRequest());
    const b = await runOptimize(tinyRequest(), undefined, { forceMainThread: true });
    expect(b.bar.length).toBeGreaterThanOrEqual(3);
    expect(a.tier).toBe(b.tier);
    expect(isSolverPreferringMainThread()).toBe(false);
  }, 120_000);
});
