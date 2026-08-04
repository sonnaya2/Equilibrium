import { describe, expect, it } from "vitest";
import { EQUIPMENT_SET_ACTIVATION } from "../shared/equipment";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import {
  analyzeSingleCast,
  buildResolvedCombatModel,
  classifyStatefulLimitations,
  overlayAnalysisStatLine,
  type HostCombatResolveInput,
} from "./index";

function minimalInput(patch: Partial<HostCombatResolveInput> = {}): HostCombatResolveInput {
  return {
    style: "melee",
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0.1, disabled: false, damageBonus: 0 },
    equipmentEffects: {
      activation: EQUIPMENT_SET_ACTIVATION,
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
      targetTiles: 1,
    },
    equipmentIds: ["item:drygore-mace"],
    weaponConfiguration: "twohand",
    startingAdrenaline: 100,
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

function byId(id: string): AbilitySpec {
  const a = MELEE_ABILITIES.find((x) => x.id === id);
  if (!a) throw new Error(`missing melee ability ${id}`);
  return a;
}

const volleyPlaceholder: AbilitySpec = {
  id: "volley_of_souls",
  name: "Volley of Souls",
  style: "necromancy",
  category: "enhanced",
  hits: [],
};

describe("overlayAnalysisStatLine", () => {
  it("replaces base / level / accuracy / crit.chance only", () => {
    const model = buildResolvedCombatModel(minimalInput({ base: 1000, level: 99, accuracy: 1 }));
    const next = overlayAnalysisStatLine(model, {
      base: 2500,
      level: 120,
      accuracy: 0.8,
      critChance: 0.42,
    });
    expect(next.base).toBe(2500);
    expect(next.level).toBe(120);
    expect(next.accuracy).toBe(0.8);
    expect(next.crit.chance).toBe(0.42);
    expect(next.crit.disabled).toBe(model.crit.disabled);
    expect(next.crit.damageBonus).toBe(model.crit.damageBonus);
    expect(next.style).toBe(model.style);
    expect(next.equipmentIds).toEqual(model.equipmentIds);
    expect(next.startingAdrenaline).toBe(model.startingAdrenaline);
  });

  it("clamps level and accuracy", () => {
    const model = buildResolvedCombatModel(minimalInput());
    const next = overlayAnalysisStatLine(model, {
      base: -10,
      level: 999,
      accuracy: 2,
      critChance: -1,
    });
    expect(next.base).toBe(0);
    expect(next.level).toBe(145);
    expect(next.accuracy).toBe(1);
    expect(next.crit.chance).toBe(0);
  });
});

describe("classifyStatefulLimitations", () => {
  it("flags bloodlustScale via isMeleeAbility narrowing", () => {
    const model = buildResolvedCombatModel(minimalInput());
    const assault = byId("assault");
    const ids = classifyStatefulLimitations(assault, model).map((l) => l.id);
    expect(ids).toContain("bloodlust_stacks");
  });

  it("flags residual_souls when Volley has no explicit residualSouls", () => {
    const model = buildResolvedCombatModel(minimalInput({ style: "necromancy" }));
    const bare = classifyStatefulLimitations(volleyPlaceholder, model);
    expect(bare.map((l) => l.id)).toContain("residual_souls");

    const withSouls = classifyStatefulLimitations(volleyPlaceholder, model, {
      residualSouls: 3,
    });
    expect(withSouls.map((l) => l.id)).not.toContain("residual_souls");
  });

  it("flags recast chain and spectral scythe stages", () => {
    const model = buildResolvedCombatModel(minimalInput());
    const slaughter = byId("slaughter");
    expect(classifyStatefulLimitations(slaughter, model).map((l) => l.id)).toContain(
      "target_debuff_from_earlier_cast",
    );

    const scythe: AbilitySpec = {
      id: "spectral_scythe_2",
      name: "Spectral Scythe (stage 2)",
      style: "necromancy",
      category: "basic",
      hits: [{ band: { minPct: 100, maxPct: 120 } }],
    };
    expect(classifyStatefulLimitations(scythe, model).map((l) => l.id)).toContain(
      "spectral_scythe_sequence",
    );
  });
});

describe("analyzeSingleCast", () => {
  it("wires residualSouls into startingResidualSouls without throwing", () => {
    const model = buildResolvedCombatModel(
      minimalInput({
        style: "necromancy",
        weaponConfiguration: "necromancy",
        startingAdrenaline: 100,
      }),
    );
    // No explicit souls: limited parity label, no invented damage claim.
    const bare = analyzeSingleCast(model, volleyPlaceholder);
    expect(bare.statefulLimitations.some((l) => l.id === "residual_souls")).toBe(true);
    expect(bare.parity).toBe("limited");

    // Explicit souls: classifier clears residual_souls; path accepts startingResidualSouls.
    const withSouls = analyzeSingleCast(model, volleyPlaceholder, { residualSouls: 3 });
    expect(withSouls.statefulLimitations.some((l) => l.id === "residual_souls")).toBe(false);
    expect(withSouls.error).toBeUndefined();
  });
});

describe("startingResidualSouls honesty", () => {
  it("does not invent soulbound lantern when residualSouls > 3 without gear", async () => {
    const { createRuntime } = await import("../engine/runtime/runtime");
    const { MELEE_ABILITIES } = await import("../styles/melee/abilities");
    const rt = createRuntime({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MELEE_ABILITIES,
      equipmentIds: [],
      startingResidualSouls: 5,
    });
    expect(rt.state.necromancy.resources.lantern).toBe(false);
    expect(rt.state.necromancy.resources.residualSouls).toBe(3);
  });

  it("allows 5 residual souls when soulbound lantern is equipped", async () => {
    const { createRuntime } = await import("../engine/runtime/runtime");
    const { MELEE_ABILITIES } = await import("../styles/melee/abilities");
    const rt = createRuntime({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MELEE_ABILITIES,
      equipmentIds: ["item:soulbound-lantern"],
      startingResidualSouls: 5,
    });
    expect(rt.state.necromancy.resources.lantern).toBe(true);
    expect(rt.state.necromancy.resources.residualSouls).toBe(5);
  });
});
