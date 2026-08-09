import { describe, expect, it } from "vitest";
import { EQUIPMENT_SET_ACTIVATION } from "../shared/equipment";
import { buildResolvedCombatModel, type HostCombatResolveInput } from "./index";

function minimalInput(patch: Partial<HostCombatResolveInput> = {}): HostCombatResolveInput {
  return {
    style: "melee",
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0.1, disabled: false, damageBonus: 0 },
    equipmentEffects: {
      activation: EQUIPMENT_SET_ACTIVATION,
      setCritChance: { unconditional: 0.03, conditional: { sunshine: 0.045 } },
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
    },
    league: {
      ruleset: "base",
      blessings: [],
      blessingIds: [],
      relics: [],
      totalArmour: 0,
      maximumLife: 9900,
      powerburstUntilTick: 0,
      targetSize: 1,
      occupiedTiles: 1,
    },
    equipmentIds: ["item:drygore-mace"],
    weaponConfiguration: "twohand",
    diagnostics: {
      slayerHelmet: null,
      salve: null,
      berserkersFury: {
        active: false,
        bonus: 0,
        currentLifePoints: 5000,
        maximumLifePoints: 9900,
        currentHealthPercent: 50,
      },
      powerburstRemainingTicks: 0,
      ringOfVigourActive: false,
      ringOfVigourSources: [],
      archaeologySelectedIds: [],
      maxAdrenaline: 100,
    },
    ...patch,
  };
}

describe("ResolvedCombatModel immutability", () => {
  it("freezes model and nested arrays", () => {
    const model = buildResolvedCombatModel(minimalInput());
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.equipmentIds)).toBe(true);
    expect(Object.isFrozen(model.modifierSources)).toBe(true);
    expect(Object.isFrozen(model.modifierSources.setCounts)).toBe(true);
    expect(Object.isFrozen(model.league.blessingIds)).toBe(true);
    expect(Object.isFrozen(model.diagnostics)).toBe(true);
  });

  it("rejects mutation in strict mode", () => {
    const model = buildResolvedCombatModel(minimalInput());
    expect(() => {
      // @ts-expect-error intentional freeze probe
      model.base = 1;
    }).toThrow();
    expect(() => {
      // @ts-expect-error intentional freeze probe
      model.equipmentIds.push("x");
    }).toThrow();
  });

  it("structuredClone preserves equality of plain projection fields", () => {
    const model = buildResolvedCombatModel(
      minimalInput({
        vulnerability: true,
        ultimatums: 4,
        target: { undead: true },
        targetHpPercent: 40,
      }),
    );
    const clone = structuredClone(model);
    expect(clone.base).toBe(model.base);
    expect(clone.modifierSources.ultimatums).toBe(4);
    expect(clone.modifierSources.vulnerability).toBe(true);
    expect(clone.target.undead).toBe(true);
    expect(clone.target.hpPercent).toBe(40);
    expect(clone.equipmentEffects.setCritChance).toEqual({
      unconditional: 0.03,
      conditional: { sunshine: 0.045 },
    });
  });
});
