/**
 * Pass 6: analyzeSingleCast / overlay / stateful limitations vs one-cast simulate.
 */
import { describe, expect, it } from "vitest";
import { toResolvedCombatModel } from "../../../components/combat/toResolvedCombatModel";
import { loadoutStats } from "../../../components/combat/loadoutStats";
import {
  DEFAULT_LOADOUT,
  normalizeLoadout,
  type Loadout,
} from "../../../components/combat/loadout/model";
import {
  analyzeSingleCast,
  overlayAnalysisStatLine,
  classifyStatefulLimitations,
  modifiersForResolvedModel,
  buildSimulationInputBase,
  toManualSimulateInput,
} from "../../model";
import { resolveAbilityCatalogue } from "../../abilities/catalogue";
import { simulate } from "../../engine/simulation/simulate";
import { rotationOf } from "../../engine/simulation/contracts";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../../styles/necromancy/abilities";
import { FULL_SLAYER_HELMET_ITEM_ID } from "../../shared/slayerHelmet";
import { SALVE_AMULET_E_ITEM_ID } from "../../shared/salveAmulet";
import { FURY_OF_THE_SMALL_ID } from "../../shared/furyOfTheSmall";
import type { AbilitySpec } from "../../pipeline/calculateAbility";

const NOW = 1_700_000_000_000;
const CHAMPIONS_RING_ITEM_ID = "item:champions-ring";

function withLoadout(patch: Partial<Loadout> = {}): Loadout {
  return normalizeLoadout({
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    archaeology: patch.archaeology
      ? { ...DEFAULT_LOADOUT.archaeology, ...patch.archaeology }
      : DEFAULT_LOADOUT.archaeology,
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
    target:
      patch.target === undefined
        ? DEFAULT_LOADOUT.target
        : patch.target === null
          ? null
          : {
              ...patch.target,
              defenceLevel: patch.target.defenceLevel ?? 80,
              affinity: patch.target.affinity ?? 60,
            },
  });
}

function abilityById(id: string, style: "melee" | "magic" | "necromancy" = "melee"): AbilitySpec {
  const pool =
    style === "necromancy"
      ? NECROMANCY_ABILITIES
      : style === "magic"
        ? MAGIC_ABILITIES
        : MELEE_ABILITIES;
  const found = pool.find((a) => a.id === id);
  if (!found) throw new Error(`missing ability ${id}`);
  return found;
}

function oneCastSummary(
  model: ReturnType<typeof toResolvedCombatModel>,
  id: string,
  opts: { residualSouls?: number; abilityOverlay?: AbilitySpec } = {},
) {
  const catalogue = resolveAbilityCatalogue({
    strengthCape99: model.strengthCape99,
    overlays: opts.abilityOverlay ? [opts.abilityOverlay] : undefined,
  });
  const base = buildSimulationInputBase(model, catalogue);
  return simulate({
    ...toManualSimulateInput(base, {
      rotation: rotationOf(id),
      autoWeave: false,
    }),
    ...(opts.residualSouls != null ? { startingResidualSouls: opts.residualSouls } : {}),
  });
}

function expectAnalysisMatchesOneCast(
  label: string,
  model: ReturnType<typeof toResolvedCombatModel>,
  ability: AbilitySpec,
  opts: { residualSouls?: number; abilityOverlay?: AbilitySpec } = {},
) {
  const analysis = analyzeSingleCast(model, ability, opts);
  const summary = oneCastSummary(model, ability.id, opts);
  if (!summary.ok) {
    expect(analysis.ok, `${label} analysis ok mirrors failed sim`).toBe(false);
    expect(analysis.expected, `${label} no fake EV on fail`).toBe(0);
    expect(analysis.min, `${label} no fake min on fail`).toBe(0);
    expect(analysis.max, `${label} no fake max on fail`).toBe(0);
    return analysis;
  }
  const cast = summary.casts.find((c) => c.auto !== true) ?? summary.casts[0];
  expect(analysis.ok, `${label} ok`).toBe(true);
  expect(analysis.expected, `${label} expected`).toBeCloseTo(summary.damage.expectedDamage, 6);
  expect(analysis.min, `${label} min`).toBeCloseTo(summary.damage.supportMinDamage, 6);
  expect(analysis.max, `${label} max`).toBeCloseTo(summary.damage.supportMaxDamage, 6);
  expect(analysis.criticalContribution, `${label} crit contrib`).toBeCloseTo(
    summary.analysis.criticalContribution,
    6,
  );
  expect(analysis.capLoss, `${label} capLoss`).toBeCloseTo(summary.analysis.capLoss, 6);
  const adrenDelta =
    cast?.result.adrenalineDelta ??
    (cast != null ? cast.adrenalineAfter - cast.adrenalineBefore : 0);
  expect(analysis.adrenalineDelta, `${label} adrenDelta`).toBeCloseTo(adrenDelta, 6);
  return analysis;
}

describe("analyzeSingleCast simple-cast parity", () => {
  it("matches one-cast simulate for Attack, Dismember, Assault on default melee loadout", () => {
    const model = toResolvedCombatModel(withLoadout({ style: "melee" }), { now: NOW });
    for (const id of ["attack", "dismember", "assault"] as const) {
      const ability = abilityById(id);
      expectAnalysisMatchesOneCast(id, model, ability);
    }
  });

  it("matches one-cast simulate for zero-stack Icy Tempest and labels Leng state", () => {
    const model = toResolvedCombatModel(
      withLoadout({
        style: "melee",
        startingAdrenaline: 100,
        equipmentSlots: { amulet: "item:essence-of-finality" },
      }),
      { now: NOW },
    );
    const analysis = expectAnalysisMatchesOneCast("icy_tempest", model, abilityById("icy_tempest"));
    expect(analysis.statefulLimitations.some((l) => l.id === "primordial_ice_stacks")).toBe(true);
  });

  it("carries Tuska set crit from loadout stats through model and simulation", () => {
    const loadout = withLoadout({
      style: "magic",
      startingAdrenaline: 100,
      equipmentSlots: {
        helmet: "item:warpriest-of-tuska-helm",
        body: "item:warpriest-of-tuska-cuirass",
        legs: "item:warpriest-of-tuska-robe-legs",
      },
    });
    const stats = loadoutStats(loadout, { now: NOW });
    const model = toResolvedCombatModel(loadout, { now: NOW }, stats);
    const directAbility = abilityById("magic_attack", "magic");
    const direct = analyzeSingleCast(model, directAbility);
    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const simulationInput = toManualSimulateInput(buildSimulationInputBase(model, catalogue), {
      rotation: rotationOf("magic_attack", "magic_attack"),
      autoWeave: false,
    });
    const full = simulate(simulationInput);

    expect(stats.equipmentEffects.setCritChance).toEqual({
      unconditional: 0.03,
      conditional: {},
    });
    expect(model.equipmentEffects.setCritChance).toEqual(stats.equipmentEffects.setCritChance);
    expect(model.crit.chance).toBeCloseTo(stats.critChance, 10);
    expect(direct.ok).toBe(true);
    expect(direct.hits[0]!.critChance).toBeCloseTo(stats.critChance, 10);
    expect(full.ok).toBe(true);
    const fullHits = full.casts.flatMap((cast) => cast.result.hits);
    expect(fullHits.length).toBeGreaterThan(0);
    expect(fullHits.every((hit) => hit.critChance === stats.critChance)).toBe(true);

    const ineligible = analyzeSingleCast(model, abilityById("magma_tempest", "magic"));
    expect(ineligible.ok).toBe(true);
    expect(ineligible.hits.every((hit) => hit.critChance === 0)).toBe(true);
  });
});

describe("analyzeSingleCast modifiers still resolve", () => {
  it("Ultimatums ultimate / Lunging dismember / slayer helm on-task / salve undead", () => {
    const cases: Array<{ loadout: Loadout; abilityId: string }> = [
      {
        loadout: withLoadout({
          perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 4 },
        }),
        abilityId: "overpower",
      },
      {
        loadout: withLoadout({
          perks: { ...DEFAULT_LOADOUT.perks, lunging: 4 },
        }),
        abilityId: "dismember",
      },
      {
        loadout: withLoadout({
          equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
          target: { defenceLevel: 80, affinity: 60, onSlayerTask: true },
        }),
        abilityId: "assault",
      },
      {
        loadout: withLoadout({
          equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
          target: { defenceLevel: 80, affinity: 60, undead: true },
        }),
        abilityId: "assault",
      },
    ];

    for (const { loadout, abilityId } of cases) {
      const model = toResolvedCombatModel(loadout, { now: NOW });
      const ability = abilityById(abilityId);
      const mods = modifiersForResolvedModel(model, ability);
      expect(mods.length, `${abilityId} has modifiers`).toBeGreaterThan(0);
      const analysis = analyzeSingleCast(model, ability);
      expect(analysis.abilityId).toBe(abilityId);
      // Successful basics/thresholds/ults should produce damage or honest fail.
      if (analysis.ok) {
        expect(analysis.expected, `${abilityId} EV`).toBeGreaterThan(0);
      }
    }
  });
});

describe("overlayAnalysisStatLine", () => {
  it("changes only base / level / accuracy / crit.chance", () => {
    const model = toResolvedCombatModel(
      withLoadout({
        perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 2, lunging: 2 },
        equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
        target: { defenceLevel: 80, affinity: 60, undead: true },
      }),
      { now: NOW },
    );
    const line = {
      base: model.base + 250,
      level: Math.min(145, model.level + 5),
      accuracy: Math.max(0, model.accuracy - 0.1),
      critChance: Math.min(1, model.crit.chance + 0.05),
    };
    const overlaid = overlayAnalysisStatLine(model, line);

    expect(overlaid.base).toBe(line.base);
    expect(overlaid.level).toBe(line.level);
    expect(overlaid.accuracy).toBeCloseTo(line.accuracy, 10);
    expect(overlaid.crit.chance).toBeCloseTo(line.critChance, 10);

    expect(overlaid.equipmentIds).toEqual([...model.equipmentIds]);
    expect(overlaid.modifierSources).toEqual(model.modifierSources);
    expect(overlaid.league).toEqual(model.league);
    expect(overlaid.adrenaline).toEqual(model.adrenaline);
    expect(overlaid.startingAdrenaline).toBe(model.startingAdrenaline);
    expect(overlaid.crit.disabled).toBe(model.crit.disabled);
    expect(overlaid.crit.damageBonus).toBe(model.crit.damageBonus);
  });

  it("caps a 100% Critual line-B chance and replaces prior converted excess", () => {
    const model = toResolvedCombatModel(withLoadout({ critChance: 40 }), {
      now: NOW,
      blessingPicks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
    });
    const modelB = overlayAnalysisStatLine(model, {
      base: model.base,
      level: model.level,
      accuracy: model.accuracy,
      critChance: 1,
    });
    const ability = abilityById("attack");
    const analysis = analyzeSingleCast(modelB, ability);
    const summary = oneCastSummary(modelB, ability.id);
    const infernos = summary.events.filter((event) => event.blessingId === "unholy-critual");

    expect(model.crit.critualConvertedDamageBonus).toBeCloseTo(0.05, 10);
    expect(modelB.crit.chance).toBeCloseTo(0.5, 10);
    expect(modelB.crit.damageBonus).toBeCloseTo(0.5, 10);
    expect(modelB.crit.critualConvertedDamageBonus).toBeCloseTo(0.5, 10);
    expect(analysis.hits[0]?.critChance).toBeCloseTo(0.5, 10);
    expect(analysis.expected).toBeCloseTo(summary.totalExpected, 6);
    expect(Number.isFinite(analysis.expected)).toBe(true);
    expect(
      summary.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak")?.expectedActivations,
    ).toBeCloseTo(1, 0);
    for (const inferno of infernos) {
      expect(inferno.occurrenceModel).toBeUndefined();
      expect(inferno.expectedOccurrences).toBe(1);
      expect(inferno.expectedActivations).toBe(1);
      expect(inferno.expectedSeparateHits).toBe(1);
    }
  });
});

describe("classifyStatefulLimitations (no invented state)", () => {
  it("flags command_skeleton_warrior as conjure_already_active", () => {
    const model = toResolvedCombatModel(withLoadout({ style: "necromancy" }), { now: NOW });
    const ability = abilityById("command_skeleton_warrior", "necromancy");
    const limits = classifyStatefulLimitations(ability, model);
    expect(limits.some((l) => l.id === "conjure_already_active")).toBe(true);
  });

  it("flags icy_tempest as primordial_ice_stacks", () => {
    const model = toResolvedCombatModel(withLoadout({ style: "melee" }), { now: NOW });
    const ability = abilityById("icy_tempest");
    const limits = classifyStatefulLimitations(ability, model);
    expect(limits.some((l) => l.id === "primordial_ice_stacks")).toBe(true);
  });

  it("flags champion-ring equipped as active_bleed_count", () => {
    const model = toResolvedCombatModel(
      withLoadout({
        equipmentSlots: { ring: CHAMPIONS_RING_ITEM_ID },
      }),
      { now: NOW },
    );
    expect(model.equipmentEffects.passiveIds).toContain("champion-ring");
    const ability = abilityById("dismember");
    const limits = classifyStatefulLimitations(ability, model);
    expect(limits.some((l) => l.id === "active_bleed_count")).toBe(true);
  });

  it("volley residualSouls: missing option flags; residualSouls:3 may cast", () => {
    const model = toResolvedCombatModel(withLoadout({ style: "necromancy" }), { now: NOW });
    const overlay = volleyOfSouls(3);
    const without = classifyStatefulLimitations(overlay, model);
    expect(without.some((l) => l.id === "residual_souls")).toBe(true);

    const withSouls = classifyStatefulLimitations(overlay, model, { residualSouls: 3 });
    expect(withSouls.some((l) => l.id === "residual_souls")).toBe(false);

    const analysis = analyzeSingleCast(model, overlay, {
      residualSouls: 3,
      abilityOverlay: overlay,
    });
    // Loadout allows cast when souls are seeded; ok true when sim succeeds.
    if (analysis.ok) {
      expect(analysis.expected).toBeGreaterThan(0);
      expect(analysis.statefulLimitations.some((l) => l.id === "residual_souls")).toBe(false);
    }
  });
});

describe("analyzeSingleCast adrenaline + failed cast honesty", () => {
  it("FotS-like adren rules: transaction present on successful basic", () => {
    const model = toResolvedCombatModel(
      withLoadout({
        style: "melee",
        startingAdrenaline: 50,
        archaeology: {
          selectedIds: [FURY_OF_THE_SMALL_ID],
          energyCap: 500,
        },
      }),
      { now: NOW },
    );
    expect(model.adrenaline?.basicAdrenalineFlatBonus).toBe(1);

    const ability = abilityById("attack");
    const analysis = analyzeSingleCast(model, ability);
    expect(analysis.ok).toBe(true);
    expect(analysis.adrenalineTransaction).not.toBeNull();
    expect(analysis.adrenalineTransaction!.furyOfTheSmallGain).toBe(1);
    expect(analysis.adrenalineDelta).toBeGreaterThan(0);
    expectAnalysisMatchesOneCast("attack+FotS", model, ability);
  });

  it("command without conjure: ok false / limited, no fake full EV", () => {
    const model = toResolvedCombatModel(withLoadout({ style: "necromancy" }), { now: NOW });
    const ability = abilityById("command_skeleton_warrior", "necromancy");
    const analysis = analyzeSingleCast(model, ability);

    expect(analysis.ok).toBe(false);
    expect(analysis.parity).toBe("limited");
    expect(analysis.statefulLimitations.some((l) => l.id === "conjure_already_active")).toBe(true);
    expect(analysis.expected).toBe(0);
    expect(analysis.min).toBe(0);
    expect(analysis.max).toBe(0);
    expect(analysis.criticalContribution).toBe(0);
    expect(analysis.hits).toEqual([]);
  });
});
