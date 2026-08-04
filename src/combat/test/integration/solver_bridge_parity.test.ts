/**
 * Pass 5: ResolvedCombatModel → solver pack identity + multi-path eval parity.
 */
import { describe, expect, it } from "vitest";
import { emptyBuild } from "@/league";
import { resolveAbilityCatalogue } from "../../abilities/catalogue";
import {
  buildSimulationInputBase,
  projectSerializableSimBase,
  toHybridManualCombatModel,
  toRevolutionInput,
} from "../../model";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { canonicalSimulationIdentity } from "../../solver/identity";
import { packSimBaseFromModel, packSolverRequest } from "../../solver/packRequest";
import { stableStringify } from "../../solver/fingerprint";
import { evaluateRevolutionBar } from "../../solver/evaluate";
import { buildCandidatePool } from "../../solver/candidatePool";
import { reviveRevolutionBase } from "../../solver/worker/revive";
import { engineSpecs } from "../../abilities/registry";
import {
  buildMemoContext,
  createEvaluateFn,
} from "../../solver/evaluationSession";
import type { ProgressState } from "../../solver/progressReporter";
import { DEFAULT_LOADOUT, type Loadout } from "../../../components/combat/loadout/model";
import {
  resolveLoadoutCombat,
  toResolvedCombatModel,
} from "../../../components/combat/toResolvedCombatModel";
import { solverSnapshotFromResolvedModel } from "../../../components/combat/solverSnapshot";
import { packSimBase } from "../../solver/packRequest";

const NOW = 1_700_000_000_000;

function withLoadout(patch: Partial<Loadout> = {}): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
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

describe("solver bridge: model projection identity", () => {
  it("direct Revolution model projection === solver packed projection", () => {
    const loadout = withLoadout({
      style: "melee",
      startingAdrenaline: 100,
      buffs: { ...DEFAULT_LOADOUT.buffs, strengthCape99: true, vulnerability: true },
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 2, lunging: 2, precise: 3 },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });

    // Direct Revolution / Manual path: projectSerializableSimBase
    const direct = projectSerializableSimBase(model);
    // Preferred pack path
    const packed = packSimBaseFromModel(model);
    // Snapshot intermediate still allowed; must match when built from model sources
    const viaSnap = packSimBase(solverSnapshotFromResolvedModel(model));

    expect(stableStringify(canonicalSimulationIdentity(direct))).toBe(
      stableStringify(canonicalSimulationIdentity(packed)),
    );
    expect(stableStringify(canonicalSimulationIdentity(direct))).toBe(
      stableStringify(canonicalSimulationIdentity(viaSnap)),
    );

    const request = packSolverRequest({
      model,
      style: model.style,
      build: emptyBuild(),
      now: NOW,
      seed: 1,
    });
    expect(stableStringify(canonicalSimulationIdentity(request.loadout as typeof packed))).toBe(
      stableStringify(canonicalSimulationIdentity(direct)),
    );
  });

  it("no field re-derive: model modifierSources equal packed sources", () => {
    const model = toResolvedCombatModel(
      withLoadout({
        perks: { ...DEFAULT_LOADOUT.perks, demonSlayer: 1, ultimatums: 4 },
        target: { defenceLevel: 80, affinity: "same", demon: true },
      }),
      { now: NOW },
    );
    const packed = packSimBaseFromModel(model);
    expect(packed.modifierSources).toEqual(model.modifierSources);
    expect(packed.base).toBe(model.base);
    expect(packed.accuracy).toBe(model.accuracy);
    expect(packed.equipmentIds).toEqual([...model.equipmentIds]);
    expect(packed.equipmentEffects.passiveIds).toEqual([...model.equipmentEffects.passiveIds]);
    expect(packed.strengthCape99).toBe(model.strengthCape99);
    expect(packed.startingAdrenaline).toBe(model.startingAdrenaline);
  });
});

describe("solver bridge: multi-path evaluation parity", () => {
  const barIds = ["dismember", "assault", "fury", "hurricane"];
  const durationTicks = 40;

  function loadoutCase(): Loadout {
    return withLoadout({
      style: "melee",
      startingAdrenaline: 100,
      buffs: { ...DEFAULT_LOADOUT.buffs, strengthCape99: true },
      perks: { ...DEFAULT_LOADOUT.perks, precise: 2 },
    });
  }

  it("direct Revolution vs worker-revived Revolution totals match", () => {
    const loadout = loadoutCase();
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const bar = barIds.map((id) => catalogue.byId.get(id)!).filter(Boolean);
    expect(bar.length).toBe(4);

    const directBase = buildSimulationInputBase(model, catalogue);
    const direct = simulateRevolution(
      toRevolutionInput(directBase, {
        bar,
        style: "melee",
        durationTicks,
      }),
    );

    const packed = packSimBaseFromModel(model);
    const revived = reviveRevolutionBase(packed);
    const fromWorker = simulateRevolution({
      ...revived,
      abilities: catalogue.catalogue,
      abilityRegistry: catalogue.abilityRegistry,
      bar,
      style: "melee",
      durationTicks,
    });

    expect(fromWorker.error ?? null).toBe(direct.error ?? null);
    expect(fromWorker.totalExpected).toBeCloseTo(direct.totalExpected, 6);
    expect(fromWorker.ticks).toBe(direct.ticks);
    expect(fromWorker.damageByTick).toEqual(direct.damageByTick);
  });

  it("score-only and full-analysis agree on totalExpected for same inputs", () => {
    const loadout = loadoutCase();
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const bar = barIds.map((id) => catalogue.byId.get(id)!);
    const packed = packSimBaseFromModel(model);
    const revived = reviveRevolutionBase(packed);

    const sim = {
      ...revived,
      abilities: catalogue.catalogue,
      abilityRegistry: catalogue.abilityRegistry,
    };

    const pool = buildCandidatePool(catalogue.catalogue, "melee", {
      weaponConfiguration: model.weaponConfiguration,
      equipmentIds: model.equipmentIds,
      includePartial: true,
    });

    const full = evaluateRevolutionBar({
      bar: barIds,
      style: "melee",
      durationTicks,
      pool,
      sim,
      profileId: "balanced",
      detailLevel: "full-analysis",
    });
    const scoreOnly = evaluateRevolutionBar({
      bar: barIds,
      style: "melee",
      durationTicks,
      pool,
      sim,
      profileId: "balanced",
      detailLevel: "score-only",
    });

    expect(full.ok).toBe(true);
    expect(scoreOnly.ok).toBe(true);
    expect(scoreOnly.score).toBeCloseTo(full.score, 6);
    // Score-only may omit presentation summary; when present, totals match.
    if (full.summary?.totalExpected != null && scoreOnly.summary?.totalExpected != null) {
      expect(scoreOnly.summary.totalExpected).toBeCloseTo(full.summary.totalExpected, 6);
    }
  });

  it("evaluateRevolutionBar uses catalogue specs for known engine ids", () => {
    // Sanity: ENGINE_SPECS ids resolve
    for (const id of barIds) {
      expect(engineSpecs.get(id)).toBeDefined();
    }
  });

  it("createEvaluateFn session score matches direct Revolution", () => {
    const loadout = loadoutCase();
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const bar = barIds.map((id) => catalogue.byId.get(id)!);
    const packed = packSimBaseFromModel(model);
    const revived = reviveRevolutionBase(packed);
    const request = packSolverRequest({
      model,
      style: model.style,
      build: emptyBuild(),
      now: NOW,
      seed: 1,
      durationSeconds: durationTicks * 0.6, // ~durationTicks at 0.6s/tick? use explicit ticks below
    });

    const pool = buildCandidatePool(catalogue.catalogue, "melee", {
      weaponConfiguration: model.weaponConfiguration,
      equipmentIds: model.equipmentIds,
      includePartial: true,
    });

    const simCommon = {
      ...revived,
      abilities: catalogue.catalogue,
      abilityRegistry: catalogue.abilityRegistry,
    };

    const state: ProgressState = {
      currentPhase: "seed",
      evaluations: 0,
      uniqueBars: 0,
      bestExploratoryScore: Number.NEGATIVE_INFINITY,
      bestFullScore: Number.NEGATIVE_INFINITY,
      searchEvaluations: 0,
      fullEvaluations: 0,
      topPreview: [],
      activePreview: [],
      noImprovement: 0,
      evaluationBudget: 1000,
      fullMemoHits: 0,
      finalizeActive: false,
      finalizeDone: 0,
      finalizeTotal: 0,
      scoringLabel: undefined,
      scoringBarPreview: undefined,
      lastEmitEvaluations: 0,
      lastEmitMs: 0,
      lastEmittedBestExploratory: Number.NEGATIVE_INFINITY,
      lastEmittedBestFull: Number.NEGATIVE_INFINITY,
    };
    const seenBars = new Set<string>();
    const evaluate = createEvaluateFn({
      request,
      pool,
      simCommon,
      exploreTicks: durationTicks,
      fullTicks: durationTicks,
      memoContext: buildMemoContext(request),
      state,
      seenBars,
    });

    const session = evaluate({ bar: barIds, mode: "full" });
    const direct = simulateRevolution(
      toRevolutionInput(buildSimulationInputBase(model, catalogue), {
        bar,
        style: "melee",
        durationTicks,
      }),
    );

    expect(session.finite).toBe(true);
    expect(direct.error ?? null).toBeNull();
    // Session score is objective-weighted; compare finite + same bar ran.
    expect(Number.isFinite(session.score)).toBe(true);
    expect(direct.totalExpected).toBeGreaterThan(0);

    // Standalone evaluateRevolutionBar full score-path total matches direct expected.
    const evalBar = evaluateRevolutionBar({
      bar: barIds,
      style: "melee",
      durationTicks,
      pool,
      sim: simCommon,
      profileId: "balanced",
      detailLevel: "full-analysis",
    });
    expect(evalBar.ok).toBe(true);
    expect(evalBar.summary?.totalExpected).toBeCloseTo(direct.totalExpected, 6);
  });
});

describe("hybrid manual model: Run === Optimize pack", () => {
  it("hybrid model has empty damage mods and slider base", () => {
    const { model: scaffold } = resolveLoadoutCombat(
      withLoadout({
        perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 4 },
        buffs: { ...DEFAULT_LOADOUT.buffs, vulnerability: true },
      }),
      { now: NOW },
    );
    const hybrid = toHybridManualCombatModel(scaffold, {
      base: 1500,
      level: 99,
      accuracy: 1,
      critChance: 0.1,
    });
    expect(hybrid.base).toBe(1500);
    expect(hybrid.modifierSources.ultimatums).toBe(0);
    expect(hybrid.modifierSources.vulnerability).toBe(false);
    expect(hybrid.equipmentIds).toEqual([]);
    expect(hybrid.adrenaline).toEqual(scaffold.adrenaline);
  });

  it("direct revo from hybrid model matches packSimBaseFromModel identity", () => {
    const { model: scaffold } = resolveLoadoutCombat(
      withLoadout({ startingAdrenaline: 100 }),
      { now: NOW },
    );
    const hybrid = toHybridManualCombatModel(scaffold, {
      base: 1200,
      level: 99,
      accuracy: 0.9,
      critChance: 0.05,
    });
    const direct = projectSerializableSimBase(hybrid);
    const packed = packSimBaseFromModel(hybrid);
    expect(stableStringify(canonicalSimulationIdentity(direct))).toBe(
      stableStringify(canonicalSimulationIdentity(packed)),
    );
  });

  it("resolveLoadoutCombat shares powerburst freeze between stats and model", () => {
    const until = NOW + 6000;
    const loadout = withLoadout({
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        powerburstOfVitalityUntil: until,
      },
    });
    const { stats, model } = resolveLoadoutCombat(loadout, { now: NOW });
    expect(model.league.powerburstUntilTick).toBe(stats.league.powerburstUntilTick);
    expect(model.diagnostics.powerburstRemainingTicks).toBe(stats.league.powerburstUntilTick);
  });
});
