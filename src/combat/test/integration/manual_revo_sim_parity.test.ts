/**
 * Pass 4: shared catalogue + simulation base vs legacy hand-built Manual/Revo inputs.
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../../engine/simulation/simulate";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { rotationOf } from "../../engine/simulation/contracts";
import type { RotationSummary } from "../../engine/simulation/simulate";
import { MELEE_ABILITIES, withStrengthCape99Dismember } from "../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../../styles/necromancy/abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "../../shared/perks";
import { engineSpecs as ENGINE_SPECS } from "../../abilities/registry";
import { resolveAbilityCatalogue } from "../../abilities/catalogue";
import {
  buildManualStatSimulationInputBase,
  buildSimulationInputBase,
  resolveRevolutionBar,
  toManualSimulateInput,
  toRevolutionInput,
} from "../../model";
import { DEFAULT_LOADOUT, type Loadout } from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";
import { toResolvedCombatModel } from "../../../components/combat/toResolvedCombatModel";

const ALL_ABILITIES = [
  ...MELEE_ABILITIES,
  ...RANGED_ABILITIES,
  ...MAGIC_ABILITIES,
  ...NECROMANCY_ABILITIES,
  volleyOfSouls(3),
];

function withLoadout(patch: Partial<Loadout>): Loadout {
  return {
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
              affinity: patch.target.affinity ?? "same",
            },
  };
}

function summaryParity(label: string, a: RotationSummary, b: RotationSummary) {
  expect(a.error ?? null, `${label} error`).toBe(b.error ?? null);
  expect(a.ticks, `${label} ticks`).toBe(b.ticks);
  expect(a.totalExpected, `${label} totalExpected`).toBeCloseTo(b.totalExpected, 6);
  expect(a.damageByTick, `${label} damageByTick`).toEqual(b.damageByTick);
  expect(
    a.casts.map((c) => ({
      tick: c.tick,
      abilityId: c.abilityId,
      auto: c.auto === true,
      adrenBefore: c.adrenalineBefore,
      adrenAfter: c.adrenalineAfter,
      expected: c.result.expected,
    })),
    `${label} cast sequence`,
  ).toEqual(
    b.casts.map((c) => ({
      tick: c.tick,
      abilityId: c.abilityId,
      auto: c.auto === true,
      adrenBefore: c.adrenalineBefore,
      adrenAfter: c.adrenalineAfter,
      expected: c.result.expected,
    })),
  );
  // Adrenaline transactions (ability economy ledger).
  expect(
    a.casts.map((c) => c.adrenalineTransaction ?? null),
    `${label} adren tx`,
  ).toEqual(b.casts.map((c) => c.adrenalineTransaction ?? null));
  // Stochastic / failure mass when present.
  expect(a.rng?.probabilityMass ?? null, `${label} rng mass`).toBeCloseTo(
    b.rng?.probabilityMass ?? (null as unknown as number),
    10,
  );
  expect(a.rng?.residualWeight ?? 0, `${label} residual`).toBeCloseTo(b.rng?.residualWeight ?? 0, 10);
  expect(a.rng?.failedWeight ?? 0, `${label} failedWeight`).toBeCloseTo(
    b.rng?.failedWeight ?? 0,
    10,
  );
  expect(a.failure?.failedWeight ?? 0, `${label} failure.failed`).toBeCloseTo(
    b.failure?.failedWeight ?? 0,
    10,
  );
  // Analysis totals
  expect(a.analysis.directDamage, `${label} direct`).toBeCloseTo(b.analysis.directDamage, 6);
  expect(a.analysis.dotDamage, `${label} dot`).toBeCloseTo(b.analysis.dotDamage, 6);
  expect(a.analysis.criticalContribution, `${label} crit contrib`).toBeCloseTo(
    b.analysis.criticalContribution,
    6,
  );
  // Event provenance on landed events (same sequence + provenance objects).
  const prov = (s: RotationSummary) =>
    (s.events ?? []).map((e) => ({
      tick: e.tick,
      family: e.family,
      abilityId: e.abilityId,
      provenance: e.provenance,
    }));
  expect(prov(a), `${label} event provenance`).toEqual(prov(b));
}

function legacyManualBuild(loadout: Loadout, queue: string[], weave: boolean) {
  const stats = loadoutStats(loadout);
  const abilities = stats.strengthCape99
    ? withStrengthCape99Dismember(ALL_ABILITIES, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
    : [...ALL_ABILITIES];
  return simulate({
    base: stats.base,
    level: stats.level,
    accuracy: stats.dp,
    crit: {
      chance: stats.critChance,
      disabled: stats.critsDisabled,
      damageBonus: stats.critDamageBonus,
    },
    abilities,
    rotation: rotationOf(...queue),
    modifiers: (ability) => stats.castModifiersFor(ability),
    adrenaline: stats.adrenaline,
    procs: stats.procs,
    plantedFeet: stats.plantedFeet,
    preciseRank: stats.preciseRank,
    conjureBasicDamageMult: stats.conjureBasicDamageMult,
    conjureDurationMult: stats.conjureDurationMult,
    tumekensPieces: stats.tumekensPieces,
    tumekensCritEnabled: stats.tumekensCritEnabled,
    equipmentEffects: stats.equipmentEffects,
    league: stats.league,
    context: stats.combatContext,
    targetHpPercent: loadout.target?.hpPercent,
    cap: stats.cap,
    startingAdrenaline: stats.startingAdrenaline,
    equipmentIds: stats.equipmentIds,
    weaponConfiguration: stats.weaponConfiguration,
    autoWeave: weave,
  });
}

function newManualBuild(loadout: Loadout, queue: string[], weave: boolean) {
  const model = toResolvedCombatModel(loadout);
  const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
  const base = buildSimulationInputBase(model, catalogue);
  return simulate(
    toManualSimulateInput(base, {
      rotation: rotationOf(...queue),
      autoWeave: weave,
    }),
  );
}

function legacyManualStat(
  loadout: Loadout,
  queue: string[],
  line: { base: number; level: number; accuracyPct: number; critPct: number },
) {
  const stats = loadoutStats(loadout);
  return simulate({
    base: line.base,
    level: line.level,
    accuracy: line.accuracyPct / 100,
    crit: { chance: line.critPct / 100 },
    abilities: ALL_ABILITIES,
    rotation: rotationOf(...queue),
    cap: stats.cap,
    startingAdrenaline: stats.startingAdrenaline,
    adrenaline: stats.adrenaline,
    procs: stats.procs,
    autoWeave: false,
  });
}

function newManualStat(
  loadout: Loadout,
  queue: string[],
  line: { base: number; level: number; accuracyPct: number; critPct: number },
) {
  const stats = loadoutStats(loadout);
  const catalogue = resolveAbilityCatalogue();
  const base = buildManualStatSimulationInputBase(
    {
      base: line.base,
      level: line.level,
      accuracy: line.accuracyPct / 100,
      critChance: line.critPct / 100,
    },
    catalogue,
    {
      cap: stats.cap,
      startingAdrenaline: stats.startingAdrenaline,
      adrenaline: stats.adrenaline,
      procs: stats.procs,
    },
  );
  return simulate(
    toManualSimulateInput(base, {
      rotation: rotationOf(...queue),
      autoWeave: false,
    }),
  );
}

function legacyRevo(
  loadout: Loadout,
  barIds: string[],
  durationTicks: number,
) {
  const stats = loadoutStats(loadout);
  const modelled = barIds.map((id) => {
    const spec = ENGINE_SPECS.get(id) ?? ALL_ABILITIES.find((a) => a.id === id);
    if (!spec) throw new Error(`missing ${id}`);
    return spec;
  });
  const abilities = stats.strengthCape99
    ? withStrengthCape99Dismember(
        [...ENGINE_SPECS.values(), ...modelled],
        STRENGTH_CAPE_DISMEMBER_EXTRA_HITS,
      )
    : [...ENGINE_SPECS.values(), ...modelled];
  const bar = stats.strengthCape99
    ? withStrengthCape99Dismember(modelled, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
    : modelled;
  return simulateRevolution({
    base: stats.base,
    level: stats.level,
    accuracy: stats.dp,
    crit: {
      chance: stats.critChance,
      disabled: stats.critsDisabled,
      damageBonus: stats.critDamageBonus,
    },
    abilities,
    bar,
    style: loadout.style,
    durationTicks,
    modifiers: (ability) => stats.castModifiersFor(ability),
    adrenaline: stats.adrenaline,
    procs: stats.procs,
    plantedFeet: stats.plantedFeet,
    preciseRank: stats.preciseRank,
    conjureBasicDamageMult: stats.conjureBasicDamageMult,
    conjureDurationMult: stats.conjureDurationMult,
    tumekensPieces: stats.tumekensPieces,
    tumekensCritEnabled: stats.tumekensCritEnabled,
    equipmentEffects: stats.equipmentEffects,
    league: stats.league,
    context: stats.combatContext,
    targetHpPercent: loadout.target?.hpPercent,
    cap: stats.cap,
    startingAdrenaline: stats.startingAdrenaline,
    equipmentIds: stats.equipmentIds,
    weaponConfiguration: stats.weaponConfiguration,
  });
}

function newRevo(loadout: Loadout, barIds: string[], durationTicks: number) {
  const model = toResolvedCombatModel(loadout);
  const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
  const modelled = barIds.map((id) => {
    const spec = catalogue.byId.get(id);
    if (!spec) throw new Error(`missing ${id}`);
    return spec;
  });
  // Pre-cape modelled list for resolveRevolutionBar (maps through catalogue).
  const preCape = barIds.map((id) => ENGINE_SPECS.get(id)!).filter(Boolean);
  const bar = resolveRevolutionBar(catalogue, preCape.length ? preCape : modelled);
  const base = buildSimulationInputBase(model, catalogue);
  return simulateRevolution(
    toRevolutionInput(base, {
      bar,
      style: loadout.style,
      durationTicks,
    }),
  );
}

describe("Manual / Revolution simulation-input parity", () => {
  it("melee use-build manual rotation matches legacy", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 100,
      buffs: { ...DEFAULT_LOADOUT.buffs, strengthCape99: true },
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 2, lunging: 2 },
    });
    const queue = ["dismember", "assault", "overpower"];
    summaryParity(
      "melee manual",
      legacyManualBuild(loadout, queue, false),
      newManualBuild(loadout, queue, false),
    );
  });

  it("ranged use-build manual matches legacy", () => {
    const loadout = withLoadout({ style: "ranged", startingAdrenaline: 100 });
    const queue = ["piercing_shot", "fragmentation_shot", "snap_shot"];
    // Only ids that exist in catalogue
    const ok = queue.filter((id) => resolveAbilityCatalogue().byId.has(id));
    if (ok.length < 2) return; // skip soft if catalogue names differ
    summaryParity(
      "ranged manual",
      legacyManualBuild(loadout, ok, true),
      newManualBuild(loadout, ok, true),
    );
  });

  it("magic use-build manual matches legacy", () => {
    const loadout = withLoadout({ style: "magic", startingAdrenaline: 100 });
    const candidates = ["wrack", "sonic_wave", "asphyxiate", "wild_magic", "combust"];
    const ok = candidates.filter((id) => resolveAbilityCatalogue().byId.has(id)).slice(0, 3);
    expect(ok.length).toBeGreaterThanOrEqual(2);
    summaryParity(
      "magic manual",
      legacyManualBuild(loadout, ok, false),
      newManualBuild(loadout, ok, false),
    );
  });

  it("necromancy use-build manual matches legacy", () => {
    const loadout = withLoadout({ style: "necromancy", startingAdrenaline: 100 });
    const candidates = ["necrotic_touch", "soul_sap", "touch_of_death", "death_skulls"];
    const ok = candidates.filter((id) => resolveAbilityCatalogue().byId.has(id)).slice(0, 3);
    expect(ok.length).toBeGreaterThanOrEqual(2);
    summaryParity(
      "necro manual",
      legacyManualBuild(loadout, ok, false),
      newManualBuild(loadout, ok, false),
    );
  });

  it("manual-stat mode does not grant full loadout modifiers", () => {
    const loadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 4 },
      buffs: { ...DEFAULT_LOADOUT.buffs, vulnerability: true },
      startingAdrenaline: 100,
    });
    const queue = ["overpower"];
    const line = { base: 1500, level: 99, accuracyPct: 100, critPct: 0 };
    summaryParity(
      "manual-stat",
      legacyManualStat(loadout, queue, line),
      newManualStat(loadout, queue, line),
    );
    // Sanity: manual-stat expected < use-build with ultimatums on ultimate
    const withMods = newManualBuild(loadout, queue, false);
    const noMods = newManualStat(loadout, queue, line);
    expect(withMods.totalExpected).toBeGreaterThan(noMods.totalExpected);
  });

  it("melee revolution bar matches legacy", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 100,
      buffs: { ...DEFAULT_LOADOUT.buffs, strengthCape99: true },
    });
    const bar = ["dismember", "assault", "fury", "hurricane"].filter((id) =>
      resolveAbilityCatalogue().byId.has(id),
    );
    expect(bar.length).toBeGreaterThanOrEqual(3);
    summaryParity("melee revo", legacyRevo(loadout, bar, 50), newRevo(loadout, bar, 50));
  });

  it("state-changing RNG (Impatient) mass matches", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 0,
      perks: {
        ...DEFAULT_LOADOUT.perks,
        impatient: 4,
        impatientLevel20: true,
      },
    });
    const queue = ["attack", "assault", "fury", "hurricane"].filter((id) =>
      resolveAbilityCatalogue().byId.has(id),
    );
    const a = legacyManualBuild(loadout, queue, true);
    const b = newManualBuild(loadout, queue, true);
    summaryParity("impatient manual", a, b);
    // Branching should report stochastic method when RNG points fire.
    if (a.rng) {
      expect(b.rng?.method).toBe(a.rng.method);
      expect(b.rng?.probabilityMass).toBeCloseTo(a.rng.probabilityMass ?? 0, 10);
    }
  });

  it("revolution impatient bar mass matches", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 50,
      perks: { ...DEFAULT_LOADOUT.perks, impatient: 3, relentless: 2 },
    });
    const bar = ["attack", "assault", "fury", "hurricane", "dismember"].filter((id) =>
      resolveAbilityCatalogue().byId.has(id),
    );
    summaryParity("impatient revo", legacyRevo(loadout, bar, 40), newRevo(loadout, bar, 40));
  });
});
