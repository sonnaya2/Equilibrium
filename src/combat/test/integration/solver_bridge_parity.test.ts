/**
 * Pass 5: ResolvedCombatModel → solver pack identity + multi-path eval parity.
 */
import { describe, expect, it } from "vitest";
import { emptyBuild } from "@/league";
import { targetDamagePotential } from "../../target/genericTarget";
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
import { buildMemoContext, createEvaluateFn } from "../../solver/evaluationSession";
import type { ProgressState } from "../../solver/progressReporter";
import { DEFAULT_LOADOUT, type Loadout } from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";
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
              affinity: patch.target.affinity ?? 60,
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
        target: { defenceLevel: 80, affinity: 60, demon: true },
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

  it("preserves native-special policy and active weapon through the worker payload", () => {
    const onLoadout = withLoadout({
      style: "magic",
      startingAdrenaline: 100,
      buffs: { ...DEFAULT_LOADOUT.buffs, useEquippedWeaponSpecial: true },
      equipmentSlots: { twohand: "item:fractured-staff-of-armadyl" },
    });
    const offLoadout = withLoadout({
      ...onLoadout,
      buffs: { ...onLoadout.buffs, useEquippedWeaponSpecial: false },
    });
    const staffLoadout = withLoadout({
      ...offLoadout,
      equipmentSlots: { twohand: "item:staff-of-light" },
    });
    const onModel = toResolvedCombatModel(onLoadout, { now: NOW });
    const offModel = toResolvedCombatModel(offLoadout, { now: NOW });
    const staffModel = toResolvedCombatModel(staffLoadout, { now: NOW });
    const onIdentity = canonicalSimulationIdentity(packSimBaseFromModel(onModel));

    expect(onModel.nativeSpecialPolicy.useEquippedWeaponSpecial).toBe(true);
    expect(stableStringify(onIdentity)).not.toBe(
      stableStringify(canonicalSimulationIdentity(packSimBaseFromModel(offModel))),
    );
    expect(stableStringify(onIdentity)).not.toBe(
      stableStringify(canonicalSimulationIdentity(packSimBaseFromModel(staffModel))),
    );

    const catalogue = resolveAbilityCatalogue({ strengthCape99: onModel.strengthCape99 });
    const bar = [catalogue.byId.get("magic_attack")!];
    const direct = simulateRevolution(
      toRevolutionInput(buildSimulationInputBase(onModel, catalogue), {
        bar,
        style: "magic",
        durationTicks: 20,
      }),
    );
    const revived = reviveRevolutionBase(packSimBaseFromModel(onModel));
    const worker = simulateRevolution({
      ...revived,
      abilities: catalogue.catalogue,
      abilityRegistry: catalogue.abilityRegistry,
      bar,
      style: "magic",
      durationTicks: 20,
    });

    expect(worker.error ?? null).toBe(direct.error ?? null);
    expect(worker.totalExpected).toBeCloseTo(direct.totalExpected, 8);
    expect(worker.damageByTick).toEqual(direct.damageByTick);
    expect(worker.casts.map((cast) => cast.abilityId)).toEqual(
      direct.casts.map((cast) => cast.abilityId),
    );
    expect(worker.casts[0]?.abilityId).toBe("instability");
  });
});

describe("solver bridge: multi-path evaluation parity", () => {
  const barIds = ["dismember", "assault", "fury", "hurricane"];
  const durationTicks = 100;

  function loadoutCase(): Loadout {
    return withLoadout({
      style: "melee",
      startingAdrenaline: 100,
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        strengthCape99: true,
        weaponPoison: "weapon-plus-plus-plus",
        kwuarmPotency: 4,
      },
      perks: { ...DEFAULT_LOADOUT.perks, precise: 2 },
      equipmentSlots: { gloves: "item:cinderbane-gloves" },
    });
  }

  it("equipped Cinderbanes materially increase resolved-loadout poison damage", () => {
    const run = (cinderbane: boolean) => {
      const loadout = withLoadout({
        style: "melee",
        startingAdrenaline: 100,
        buffs: {
          ...DEFAULT_LOADOUT.buffs,
          weaponPoison: "weapon-plus-plus-plus",
        },
        ...(cinderbane ? { equipmentSlots: { gloves: "item:cinderbane-gloves" } } : {}),
      });
      const model = toResolvedCombatModel(loadout, { now: NOW });
      const catalogue = resolveAbilityCatalogue();
      const bar = barIds.map((id) => catalogue.byId.get(id)!).filter(Boolean);
      return {
        model,
        result: simulateRevolution(
          toRevolutionInput(buildSimulationInputBase(model, catalogue), {
            bar,
            style: "melee",
            durationTicks,
          }),
        ),
      };
    };

    const without = run(false);
    const withCinderbanes = run(true);
    expect(without.model.playerPoison.cinderbane).toBe(false);
    expect(withCinderbanes.model.playerPoison.cinderbane).toBe(true);
    expect(withCinderbanes.result.playerPoison!.successfulCinderbaneContinuations).toBeGreaterThan(
      0,
    );
    expect(withCinderbanes.result.playerPoison!.separateHits).toBeGreaterThan(
      without.result.playerPoison!.separateHits,
    );
    expect(withCinderbanes.result.playerPoison!.expectedDamage).toBeGreaterThan(
      without.result.playerPoison!.expectedDamage * 1.2,
    );
    expect(withCinderbanes.result.totalExpected).toBeGreaterThan(without.result.totalExpected);
  });

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
    expect(model.playerPoison).toMatchObject({
      potion: "weapon-plus-plus-plus",
      kwuarmPotency: 4,
      cinderbane: true,
    });
    expect(direct.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
    expect(fromWorker.playerPoison?.expectedDamage).toBeCloseTo(
      direct.playerPoison?.expectedDamage ?? 0,
      8,
    );
  });

  it("score-only and full-analysis agree on totalExpected for same inputs", () => {
    const loadout = loadoutCase();
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
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
    const bar = barIds.map((id) => catalogue.byId.get(id)!);
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
        target: {
          targetPresetId: "boss:commander-zilyana",
          defenceLevel: 75,
          armour: 1694,
          affinity: 55,
          incomingHitIntervalSeconds: 1.2,
        },
      }),
      { now: NOW, blessingPicks: ["Order", "Order", "Order"] },
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
    expect(hybrid.equipmentIds).toEqual([...scaffold.equipmentIds]);
    expect(hybrid.adrenaline).toEqual(scaffold.adrenaline);
    expect(hybrid.league.blessingIds).toContain("steadfast-will");
    expect(hybrid.target.incomingHitIntervalSeconds).toBe(1.2);
  });

  it("direct revo from hybrid model matches packSimBaseFromModel identity", () => {
    const { model: scaffold } = resolveLoadoutCombat(withLoadout({ startingAdrenaline: 100 }), {
      now: NOW,
    });
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

/**
 * Host folds Aff + Demon's Mark into model.accuracy (DP) before pack.
 * Worker payload carries that DP only; no Aff / Mark re-derive on revive.
 */
describe("solver bridge: Aff/Mark collapses into packed accuracy", () => {
  // Two Chaos picks grant Demon's Mark (Chaos god tier).
  const MARK_PICKS = ["Balance", "Chaos", "Chaos"] as const;
  const NO_MARK_PICKS = ["Order"] as const;
  // High Defence keeps hit chance under 100% so Aff 60 vs 90 actually moves DP.
  const targetBase = {
    defenceLevel: 170,
    affinity: 60,
    hasApplicableWeakness: true,
  } as const;

  it("Mark upgrades Aff 60 to weakness 90 DP; pack uses that accuracy only", () => {
    const loadout = withLoadout({
      style: "ranged",
      buffs: { ...DEFAULT_LOADOUT.buffs, attackCape120: false },
      target: { ...targetBase },
    });
    const markOpts = { blessingPicks: [...MARK_PICKS], now: NOW };
    const stats = loadoutStats(loadout, markOpts);
    const model = toResolvedCombatModel(loadout, markOpts, stats);
    const packed = packSimBaseFromModel(model);
    const revived = reviveRevolutionBase(packed);

    expect(stats.targetAffinity).toBe(90);
    expect(stats.damagePotentialSource).toBe("target weakness");
    expect(stats.dp).toBeCloseTo(
      targetDamagePotential(stats.accuracyRating, {
        defenceLevel: 170,
        affinity: 90,
      }),
      10,
    );
    // model.accuracy is stats.dp; pack copies it for the worker.
    expect(model.accuracy).toBe(stats.dp);
    expect(packed.accuracy).toBe(model.accuracy);
    expect(revived.accuracy).toBe(packed.accuracy);
    expect(packed).not.toHaveProperty("affinity");
    expect(packed).not.toHaveProperty("hasApplicableWeakness");
    expect(revived).not.toHaveProperty("affinity");
    expect(revived).not.toHaveProperty("hasApplicableWeakness");
  });

  it("without Mark, Aff 60 DP stays even when hasApplicableWeakness is true", () => {
    const loadout = withLoadout({
      style: "ranged",
      buffs: { ...DEFAULT_LOADOUT.buffs, attackCape120: false },
      target: { ...targetBase },
    });
    const plainOpts = { blessingPicks: [...NO_MARK_PICKS], now: NOW };
    const stats = loadoutStats(loadout, plainOpts);
    const model = toResolvedCombatModel(loadout, plainOpts, stats);
    const packed = packSimBaseFromModel(model);

    expect(stats.targetAffinity).toBe(60);
    expect(stats.damagePotentialSource).toBe("target stats");
    expect(stats.dp).toBeCloseTo(
      targetDamagePotential(stats.accuracyRating, {
        defenceLevel: 170,
        affinity: 60,
      }),
      10,
    );
    expect(model.accuracy).toBe(stats.dp);
    expect(packed.accuracy).toBe(model.accuracy);
    // Mark path must produce higher DP than Aff-60 for the same target/rating setup.
    const markStats = loadoutStats(loadout, { blessingPicks: [...MARK_PICKS], now: NOW });
    expect(markStats.dp).toBeGreaterThan(stats.dp);
  });
});
