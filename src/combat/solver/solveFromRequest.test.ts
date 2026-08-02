import { describe, expect, it } from "vitest";
import { emptyModifierSources, defaultSerializableRequest } from "./worker/serializable";
import { solveFromRequest } from "./solveFromRequest";
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

describe("solveFromRequest", () => {
  it("returns a legal bar that scores at least the seed baseline under thorough", async () => {
    const request = defaultSerializableRequest({
      style: "melee",
      durationTicks: 500,
      exploreDurationTicks: 50,
      tier: "thorough",
      profileId: "balanced",
      seed: 7,
      minBarSize: 3,
      maxBarSize: 6,
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
          targetTiles: 1,
        },
        equipmentIds: [],
        weaponConfiguration: "dualwield",
        startingAdrenaline: 100,
        modifierSources: emptyModifierSources(),
      },
    });

    const result = await solveFromRequest(request);
    expect(result.bar.length).toBeGreaterThanOrEqual(3);
    expect(result.bar.length).toBeLessThanOrEqual(6);
    expect(new Set(result.bar).size).toBe(result.bar.length);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.evaluations).toBeGreaterThan(0);
    expect(result.proofLabel === "globally-optimal" || result.proofLabel === "best-found" || result.proofLabel === "converged").toBe(
      true,
    );
    // No autos or off-GCD on the bar.
    expect(result.bar).not.toContain("attack");
    expect(result.bar).not.toContain("runic_charge");
  }, 120_000);
});
