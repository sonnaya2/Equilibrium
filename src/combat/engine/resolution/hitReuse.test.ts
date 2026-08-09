import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import {
  resetHitPipelineCounters,
  setHitPipelineProfiling,
  snapshotHitPipelineCounters,
} from "../../profiling/hitPipeline";
import { createRuntime } from "../runtime/runtime";
import { prepareCast } from "../cast/prepare";
import { resolveCastHit } from "./castHit";
import { hitReuseSize, runWithHitReuseScope } from "./hitReuse";
import { patchMelee, patchTarget } from "../runtime/state";
import {
  applyBlackStoneArmourReduction,
  newBlackStoneArmourState,
} from "../../styles/ranged/blackStone";
import { recordResolved } from ".";
import { resolveLeagueRules } from "../../league/ruleset";
import { createStochasticOracle, DEFAULT_STOCHASTIC_LANES } from "../runtime/stochastic";
import { simulateRevolution } from "../simulation/revolution";

const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;

function runtimeWithAssault() {
  const rt = createRuntime({
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    abilities: MELEE_ABILITIES,
    context: { style: "melee" },
  });
  return rt;
}

describe("hit reuse across stochastic lanes", () => {
  it("memoizes ability modifier programs across equivalent lane casts", () => {
    let builds = 0;
    const rt = createRuntime({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MELEE_ABILITIES,
      context: { style: "melee" },
      modifiers: () => {
        builds += 1;
        return [];
      },
    });
    const first = prepareCast(rt, assault, 0);
    const second = prepareCast(rt, assault, 0);
    expect(first.snap.baseMods).toBe(second.snap.baseMods);
    expect(builds).toBe(1);
  });

  it("reuses EventResolution for identical land context within a scope", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;

    runWithHitReuseScope(() => {
      const a = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      const b = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      expect(b).toBe(a);
      expect(hitReuseSize()).toBe(1);
    });

    const snapCounters = snapshotHitPipelineCounters();
    expect(snapCounters.hitExpectationCalls).toBe(1);
    setHitPipelineProfiling(false);
  });

  it("reuses deterministic hit math across Cinderbane lanes", () => {
    let modifierBuilds = 0;
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    try {
      const result = simulateRevolution(
        {
          base: 1000,
          level: 99,
          accuracy: 1,
          crit: { chance: 0 },
          abilities: MELEE_ABILITIES,
          modifiers: () => {
            modifierBuilds += 1;
            return [];
          },
          context: { style: "melee" },
          playerPoison: {
            potion: "weapon-plus-plus-plus",
            potionUntilTick: 1_200,
            kwuarmPotency: 4,
            cinderbane: true,
            blowpipe: false,
            laniakea: true,
          },
          bar: [attack],
          style: "melee",
          durationTicks: 10,
        },
        { detailLevel: "score-only" },
      );
      const counters = snapshotHitPipelineCounters();

      expect(result.rng?.lanes).toBe(DEFAULT_STOCHASTIC_LANES);
      expect(modifierBuilds).toBe(1);
      expect(counters.resolutionCacheHits).toBeGreaterThan(0);
      expect(counters.resolutionCacheMisses).toBeLessThan(DEFAULT_STOCHASTIC_LANES);
    } finally {
      setHitPipelineProfiling(false);
    }
  });

  it("does not reuse when frostblades window differs", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;

    runWithHitReuseScope(() => {
      const cold = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      rt.state = patchMelee(rt.state, {
        primordialIce: {
          atoms: [{ weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 50 }],
        },
      });
      const hot = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      expect(hot).not.toBe(cold);
      expect(hot.damage.expected).toBeGreaterThan(cold.damage.expected);
    });

    expect(snapshotHitPipelineCounters().hitExpectationCalls).toBe(2);
    setHitPipelineProfiling(false);
  });

  it("stack-only divergence still reuses (stacks do not affect land hit)", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;

    runWithHitReuseScope(() => {
      const a = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      rt.state = patchMelee(rt.state, {
        primordialIce: {
          atoms: [{ weight: 1, stacks: 7, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 }],
        },
      });
      const b = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      expect(b).toBe(a);
    });

    expect(snapshotHitPipelineCounters().hitExpectationCalls).toBe(1);
    setHitPipelineProfiling(false);
  });

  it("inactive scope never reuses by reference", () => {
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;
    const a = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
    const b = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
    expect(b).not.toBe(a);
    expect(a.damage.expected).toBe(b.damage.expected);
  });

  it("does not reuse when live target armour and DP change", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    const rangedAttack = RANGED_ABILITIES.find((ability) => ability.id === "ranged_attack")!;
    const rt = createRuntime({
      base: 1000,
      level: 99,
      accuracy: 0.5,
      crit: { chance: 0 },
      abilities: RANGED_ABILITIES,
      context: { style: "ranged" },
      targetAccuracyProfile: {
        playerAccuracyRating: 1000,
        originalTargetArmourRating: 1200,
        affinity: 60,
        additiveHitChance: 0,
      },
    });
    const prepared = prepareCast(rt, rangedAttack, 0);
    const hitSpec = prepared.working.hits[0]!;
    runWithHitReuseScope(() => {
      const before = resolveCastHit(rt, 0, hitSpec, 0, rangedAttack, prepared.snap, false);
      const blackStone = applyBlackStoneArmourReduction(newBlackStoneArmourState(1200), 0).state;
      rt.state = patchTarget(rt.state, { blackStone });
      const after = resolveCastHit(rt, 0, hitSpec, 0, rangedAttack, prepared.snap, false);
      expect(after).not.toBe(before);
      expect(after.damage.expected).toBeGreaterThan(before.damage.expected);
    });
    setHitPipelineProfiling(false);
  });

  it("keeps sampled crit outcomes lane-local after deterministic hit reuse", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
    });
    const input = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0.5 },
      abilities: MELEE_ABILITIES,
      league,
      context: { style: "melee" as const, ruleset: "equilibrium" as const },
    };
    const outcomes = Array.from({ length: 128 }, (_, laneIndex) => ({
      laneIndex,
      outcome: createStochasticOracle({ laneIndex, laneCount: 128 }).bernoulli(
        "land:critical:0",
        0.5,
      ),
    }));
    const first = outcomes.find((lane) => lane.outcome);
    const second = outcomes.find((lane) => !lane.outcome);
    if (!first || !second) throw new Error("stratified crit lanes did not split");
    const rtA = createRuntime(input, { laneIndex: first.laneIndex, laneCount: 128 });
    const rtB = createRuntime(input, { laneIndex: second.laneIndex, laneCount: 128 });
    const preparedA = prepareCast(rtA, assault, 0);
    const preparedB = prepareCast(rtB, assault, 0);
    const hitSpec = preparedA.working.hits[0]!;
    const sharedEvent = (rt: typeof rtA, snap: typeof preparedA.snap) => ({
      tick: 0,
      seq: 0,
      family: "hit" as const,
      abilityId: assault.id,
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" as const },
      resolve: () => resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false),
    });

    runWithHitReuseScope(() => {
      const resolvedA = resolveCastHit(rtA, 0, hitSpec, 0, assault, preparedA.snap, false);
      const resolvedB = resolveCastHit(rtB, 0, hitSpec, 0, assault, preparedB.snap, false);
      expect(resolvedB).toStrictEqual(resolvedA);
      expect(resolvedA.damage.critical?.outcome).toBeUndefined();
      recordResolved(rtA, sharedEvent(rtA, preparedA.snap), resolvedA);
      recordResolved(rtB, sharedEvent(rtB, preparedB.snap), resolvedB);
    });

    expect(rtA.events[0]?.damage.critical?.outcome).toBe(first.outcome);
    expect(rtB.events[0]?.damage.critical?.outcome).toBe(second.outcome);
    expect(rtA.events[0]?.damage.critical?.outcome).not.toBe(
      rtB.events[0]?.damage.critical?.outcome,
    );
  });
});
