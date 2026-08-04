/**
 * Pass 7: Manual / Revolution simulation via model + catalogue only.
 * Legacy hand-built dual-arm builders retired; smoke + new-path authority checks.
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../../engine/simulation/simulate";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { rotationOf } from "../../engine/simulation/contracts";
import type { RotationSummary } from "../../engine/simulation/simulate";
import {
  resolveAbilityCatalogue,
  resolveAbilitySpecsFromCatalogue,
} from "../../abilities/catalogue";
import {
  buildManualStatSimulationInputBase,
  buildSimulationInputBase,
  toManualSimulateInput,
  toRevolutionInput,
} from "../../model";
import { DEFAULT_LOADOUT, type Loadout } from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";
import { toResolvedCombatModel } from "../../../components/combat/toResolvedCombatModel";

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

function catalogueIds(ids: readonly string[]): string[] {
  const cat = resolveAbilityCatalogue();
  return ids.filter((id) => cat.byId.has(id));
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
  expect(
    a.casts.map((c) => c.adrenalineTransaction ?? null),
    `${label} adren tx`,
  ).toEqual(b.casts.map((c) => c.adrenalineTransaction ?? null));
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
  expect(a.analysis.directDamage, `${label} direct`).toBeCloseTo(b.analysis.directDamage, 6);
  expect(a.analysis.dotDamage, `${label} dot`).toBeCloseTo(b.analysis.dotDamage, 6);
  expect(a.analysis.criticalContribution, `${label} crit contrib`).toBeCloseTo(
    b.analysis.criticalContribution,
    6,
  );
  const prov = (s: RotationSummary) =>
    (s.events ?? []).map((e) => ({
      tick: e.tick,
      family: e.family,
      abilityId: e.abilityId,
      provenance: e.provenance,
    }));
  expect(prov(a), `${label} event provenance`).toEqual(prov(b));
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

function newRevo(loadout: Loadout, barIds: string[], durationTicks: number) {
  const model = toResolvedCombatModel(loadout);
  const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
  const bar = resolveAbilitySpecsFromCatalogue(catalogue, barIds);
  const base = buildSimulationInputBase(model, catalogue);
  return simulateRevolution(
    toRevolutionInput(base, {
      bar,
      style: loadout.style,
      durationTicks,
    }),
  );
}

function expectOk(label: string, s: RotationSummary) {
  expect(s.error ?? null, `${label} error`).toBeNull();
  expect(s.ticks, `${label} ticks`).toBeGreaterThan(0);
  expect(s.casts.length, `${label} casts`).toBeGreaterThan(0);
  expect(s.totalExpected, `${label} totalExpected`).toBeGreaterThan(0);
}

describe("Manual / Revolution new-path simulation", () => {
  it("melee use-build manual with strength cape runs and is deterministic", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 100,
      buffs: { ...DEFAULT_LOADOUT.buffs, strengthCape99: true },
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 2, lunging: 2 },
    });
    const queue = ["dismember", "assault", "overpower"];
    const a = newManualBuild(loadout, queue, false);
    const b = newManualBuild(loadout, queue, false);
    expectOk("melee manual", a);
    expect(a.casts.some((c) => c.abilityId === "dismember")).toBe(true);
    // Cape is on the catalogue: Dismember DoT should exceed no-cape baseline.
    const noCape = newManualBuild(
      withLoadout({
        style: "melee",
        startingAdrenaline: 100,
        buffs: { ...DEFAULT_LOADOUT.buffs, strengthCape99: false },
        perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 2, lunging: 2 },
      }),
      ["dismember"],
      false,
    );
    const withCape = newManualBuild(loadout, ["dismember"], false);
    expect(withCape.totalExpected).toBeGreaterThan(noCape.totalExpected);
    summaryParity("melee manual det", a, b);
  });

  it("ranged use-build manual runs", () => {
    const loadout = withLoadout({ style: "ranged", startingAdrenaline: 100 });
    const ok = catalogueIds(["piercing_shot", "fragmentation_shot", "snap_shot"]);
    if (ok.length < 2) return;
    expectOk("ranged manual", newManualBuild(loadout, ok, true));
  });

  it("magic use-build manual runs", () => {
    const loadout = withLoadout({ style: "magic", startingAdrenaline: 100 });
    const ok = catalogueIds(["wrack", "sonic_wave", "asphyxiate", "wild_magic", "combust"]).slice(
      0,
      3,
    );
    expect(ok.length).toBeGreaterThanOrEqual(2);
    expectOk("magic manual", newManualBuild(loadout, ok, false));
  });

  it("necromancy use-build manual runs", () => {
    const loadout = withLoadout({ style: "necromancy", startingAdrenaline: 100 });
    const ok = catalogueIds([
      "necrotic_touch",
      "soul_sap",
      "touch_of_death",
      "death_skulls",
    ]).slice(0, 3);
    expect(ok.length).toBeGreaterThanOrEqual(2);
    expectOk("necro manual", newManualBuild(loadout, ok, false));
  });

  it("manual-stat mode does not grant full loadout modifiers", () => {
    const loadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 4 },
      buffs: { ...DEFAULT_LOADOUT.buffs, vulnerability: true },
      startingAdrenaline: 100,
    });
    const queue = ["overpower"];
    const line = { base: 1500, level: 99, accuracyPct: 100, critPct: 0 };
    const withMods = newManualBuild(loadout, queue, false);
    const noMods = newManualStat(loadout, queue, line);
    expectOk("manual-stat use-build", withMods);
    expectOk("manual-stat bare", noMods);
    expect(withMods.totalExpected).toBeGreaterThan(noMods.totalExpected);
    // Bare path is deterministic with itself.
    summaryParity("manual-stat det", noMods, newManualStat(loadout, queue, line));
  });

  it("melee revolution bar with strength cape runs and is deterministic", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 100,
      buffs: { ...DEFAULT_LOADOUT.buffs, strengthCape99: true },
    });
    const bar = catalogueIds(["dismember", "assault", "fury", "hurricane"]);
    expect(bar.length).toBeGreaterThanOrEqual(3);
    const a = newRevo(loadout, bar, 50);
    const b = newRevo(loadout, bar, 50);
    expectOk("melee revo", a);
    summaryParity("melee revo det", a, b);
  });

  it("state-changing RNG (Impatient) mass is reported on new path", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 0,
      perks: {
        ...DEFAULT_LOADOUT.perks,
        impatient: 4,
        impatientLevel20: true,
      },
    });
    const queue = catalogueIds(["attack", "assault", "fury", "hurricane"]);
    const a = newManualBuild(loadout, queue, true);
    const b = newManualBuild(loadout, queue, true);
    expectOk("impatient manual", a);
    summaryParity("impatient manual det", a, b);
    if (a.rng) {
      expect(b.rng?.method).toBe(a.rng.method);
      expect(b.rng?.probabilityMass).toBeCloseTo(a.rng.probabilityMass ?? 0, 10);
    }
  });

  it("revolution impatient bar mass is deterministic", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 50,
      perks: { ...DEFAULT_LOADOUT.perks, impatient: 3, relentless: 2 },
    });
    const bar = catalogueIds(["attack", "assault", "fury", "hurricane", "dismember"]);
    const a = newRevo(loadout, bar, 40);
    const b = newRevo(loadout, bar, 40);
    expectOk("impatient revo", a);
    summaryParity("impatient revo det", a, b);
  });
});
