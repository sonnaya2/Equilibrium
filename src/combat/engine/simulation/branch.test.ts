import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { commitCast, prepareSimulationCast } from "../cast";
import type { CastSnapshot } from "../cast/snapshot";
import { advanceTo } from "../runtime/clock";
import { createRuntime, enqueueEvent } from "../runtime/runtime";
import {
  appendWithIntermediateCap,
  capBranches,
  combineExactness,
  enableBranchProfiling,
  getBranchProfile,
  MAX_INTERMEDIATE_BRANCHES,
  MAX_LIVE_BRANCHES,
  materializeCastPlans,
  mergeAndCapBranches,
  mergeBranches,
  planCastOutcomes,
  resetBranchProfile,
  snapshotRuntime,
} from "./branch";
import { branchKeyStructural } from "./branchKey";
import type { CastContextInput } from "./contracts";
import { rotationOf } from "./contracts";
import { createCastContext, simulate, type SimulateInput } from "./simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { lastCast } from "../../test/helpers/summary";

const meleeInput: CastContextInput = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
  context: { style: "melee" },
};

const necroInput: CastContextInput = {
  ...meleeInput,
  abilities: NECROMANCY_ABILITIES,
  context: { style: "necromancy" },
};

const castSnap = (over: Partial<CastSnapshot> = {}): CastSnapshot => ({
  castSeq: 0,
  critLayers: { chance: 0, eligible: true },
  baseMods: [],
  chaosRoarActive: false,
  channelled: false,
  greaterFuryActive: false,
  furyActive: false,
  firstEligibleHitIndex: 0,
  empowerMult: 1,
  searingWindsAtCast: false,
  hauntedAtCast: false,
  hauntedCapAd: 0,
  enduringRuinBonus: 0,
  ...over,
});

const noopResolve = () => ({ damage: { min: 0, max: 0, expected: 0 } });

describe("snapshotRuntime shares no mutable collection", () => {
  it("ledgers, queue and lookup maps are independent copies", () => {
    const rt = createRuntime(meleeInput);
    for (let i = 0; i < 3; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("attack")!, rt.state.tick);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    const clone = snapshotRuntime(rt);
    for (const key of [
      "queue",
      "casts",
      "perAbility",
      "damageByTick",
      "events",
      "recordBySeq",
      "hitDetails",
      "spiritEventMeta",
      "scheduledSpiritTracks",
      "spiritHitCounts",
      "analysis",
    ] as const) {
      expect(clone[key], key).not.toBe(rt[key]);
    }
    expect(clone.analysis.effects).not.toBe(rt.analysis.effects);
    expect(clone.analysis.sources).not.toBe(rt.analysis.sources);
    expect(clone.analysis.castKeys).not.toBe(rt.analysis.castKeys);
    // Cast records are cloned, not aliased - a branch's totals must not leak.
    expect(clone.casts[0]).not.toBe(rt.casts[0]);
    expect(clone.casts[0]!.result.hits).not.toBe(rt.casts[0]!.result.hits);
  });

  it("a cast on the clone leaves the parent's nested style state untouched", () => {
    const rt = createRuntime(necroInput);
    const clone = snapshotRuntime(rt);
    const parentNecromancy = rt.state.necromancy;
    const parentMelee = rt.state.melee;

    const attempt = prepareSimulationCast(clone, clone.byId.get("conjure_undead_army")!, 0);
    expect(attempt.ok).toBe(true);
    if (attempt.ok) commitCast(clone, attempt.prepared, false);

    expect(clone.state.necromancy.conjures.spirits.length).toBe(3);
    // The parent still holds the object it started with - nothing was mutated
    // in place inside the nested style state.
    expect(rt.state.necromancy).toBe(parentNecromancy);
    expect(rt.state.necromancy.conjures.spirits).toHaveLength(0);
    expect(rt.state.melee).toBe(parentMelee);
    expect(rt.casts).toHaveLength(0);
    expect(rt.queue.length).toBe(0);
  });

  it("keeps natural durations distinct and merges fixed-window endTick twins", () => {
    const rt = createRuntime(meleeInput);
    expect(
      mergeBranches([
        { weight: 0.4, rt },
        { weight: 0.6, rt: snapshotRuntime(rt) },
      ]),
    ).toHaveLength(1);

    const different = snapshotRuntime(rt);
    different.spiritHitCounts.set("future-track", 1);
    expect(
      mergeBranches([
        { weight: 0.4, rt },
        { weight: 0.6, rt: different },
      ]),
    ).toHaveLength(2);

    // Natural completion duration changes the terminal DPS denominator.
    const differentEnd = snapshotRuntime(rt);
    differentEnd.endTick = 1;
    expect(
      mergeBranches([
        { weight: 0.4, rt },
        { weight: 0.6, rt: differentEnd },
      ]),
    ).toHaveLength(2);

    const fixed = createRuntime({ ...meleeInput, horizonTicks: 100 });
    const fixedEnd = snapshotRuntime(fixed);
    fixedEnd.endTick = 1;
    const endMerged = mergeBranches([
      { weight: 0.4, rt: fixed },
      { weight: 0.6, rt: fixedEnd },
    ]);
    expect(endMerged).toHaveLength(1);
    expect(endMerged[0]!.rt.endTick).toBe(Math.max(fixed.endTick, 1));

    const differentDamage = snapshotRuntime(rt);
    differentDamage.totalExpected = 50_000;
    expect(
      mergeBranches([
        { weight: 0.4, rt },
        { weight: 0.6, rt: differentDamage },
      ]),
    ).toHaveLength(1);
  });

  it("merges future-equivalent branches: expected ledgers mean, support uses min/max", () => {
    const low = createRuntime(meleeInput);
    low.totalExpected = 100;
    low.totalMin = 80;
    low.totalMax = 120;
    low.perAbility.attack = 100;
    low.damageByTick[0] = 100;

    const high = snapshotRuntime(low);
    high.totalExpected = 300;
    high.totalMin = 240;
    high.totalMax = 360;
    high.perAbility.attack = 300;
    high.damageByTick[0] = 300;

    const merged = mergeBranches([
      { weight: 0.25, rt: low },
      { weight: 0.75, rt: high },
    ]);
    expect(merged).toHaveLength(1);
    const rt = merged[0]!.rt;
    expect(merged[0]!.weight).toBe(1);
    // 0.25*100 + 0.75*300 = 250
    expect(rt.totalExpected).toBe(250);
    // Path conditionals are weight-averaged (expected conditional extrema).
    expect(rt.totalMin).toBe(200);
    expect(rt.totalMax).toBe(300);
    // True support extrema use min/max via offsets.
    expect(rt.totalMin + rt.analysis.supportMinOffset).toBe(80);
    expect(rt.totalMax + rt.analysis.supportMaxOffset).toBe(360);
    expect(rt.perAbility.attack).toBe(250);
    expect(rt.damageByTick[0]).toBe(250);
  });

  it("support bounds survive post-merge damage landings", () => {
    const low = createRuntime(meleeInput);
    low.totalMin = 80;
    low.totalMax = 120;
    low.totalExpected = 100;
    const high = snapshotRuntime(low);
    high.totalMin = 240;
    high.totalMax = 360;
    high.totalExpected = 300;

    const merged = mergeBranches([
      { weight: 0.25, rt: low },
      { weight: 0.75, rt: high },
    ])[0]!;
    // Identical future hit lands after merge.
    merged.rt.totalMin += 50;
    merged.rt.totalMax += 70;
    merged.rt.totalExpected += 60;
    expect(merged.rt.totalMin + merged.rt.analysis.supportMinOffset).toBe(130);
    expect(merged.rt.totalMax + merged.rt.analysis.supportMaxOffset).toBe(430);
    // Conditional means also advanced by the same landing.
    expect(merged.rt.totalMin).toBe(250);
    expect(merged.rt.totalMax).toBe(370);
  });

  it("weight-averages analysis ledgers; representative events do not drive aggregates", () => {
    const low = createRuntime(meleeInput);
    low.totalExpected = 100;
    low.totalMin = 80;
    low.totalMax = 120;
    low.analysis.directDamage = 100;
    low.analysis.criticalContribution = 10;
    low.analysis.capLoss = 4;
    low.analysis.sources.set("ability-direct", 100);
    low.analysis.effects.set("attack", {
      id: "attack",
      kind: "ability-direct",
      totalDamage: 100,
      directDamage: 100,
      dotDamage: 0,
      criticalContribution: 10,
      capLoss: 4,
      expectedCasts: 1,
      expectedTriggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      expectedAttachedComponents: 0,
      bonusDamage: 0,
    });
    // Representative provenance log only reflects this branch's past.
    low.events.push({
      tick: 0,
      seq: 0,
      family: "hit",
      abilityId: "attack",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      damage: { min: 80, max: 120, expected: 100 },
    });

    const high = snapshotRuntime(low);
    high.totalExpected = 300;
    high.totalMin = 240;
    high.totalMax = 360;
    high.analysis.directDamage = 300;
    high.analysis.criticalContribution = 30;
    high.analysis.capLoss = 12;
    high.analysis.sources.set("ability-direct", 300);
    high.analysis.effects.set("attack", {
      id: "attack",
      kind: "ability-direct",
      totalDamage: 300,
      directDamage: 300,
      dotDamage: 0,
      criticalContribution: 30,
      capLoss: 12,
      expectedCasts: 2,
      expectedTriggerRolls: 0,
      expectedActivations: 3,
      expectedSeparateHits: 3,
      expectedAttachedComponents: 0,
      bonusDamage: 0,
    });
    high.events[0] = {
      ...high.events[0]!,
      damage: { min: 240, max: 360, expected: 300 },
    };

    const merged = mergeBranches([
      { weight: 0.25, rt: low },
      { weight: 0.75, rt: high },
    ]);
    expect(merged).toHaveLength(1);
    const { rt, weight } = merged[0]!;
    expect(weight).toBe(1);
    expect(rt.totalExpected).toBe(250);
    // Analysis is weight-mixed: 0.25*low + 0.75*high
    expect(rt.analysis.directDamage).toBe(250);
    expect(rt.analysis.criticalContribution).toBe(25);
    expect(rt.analysis.capLoss).toBe(10);
    expect(rt.analysis.sources.get("ability-direct")).toBe(250);
    const attack = rt.analysis.effects.get("attack")!;
    expect(attack.totalDamage).toBe(250);
    expect(attack.expectedActivations).toBe(2.5);
    expect(attack.expectedSeparateHits).toBe(2.5);
    expect(attack.expectedCasts).toBe(1.75);
    expect(attack.criticalContribution).toBe(25);
    expect(attack.capLoss).toBe(10);
    // keep = high (weight 0.75); events are representative, not the weighted mean.
    expect(rt.events).toHaveLength(1);
    expect(rt.events[0]!.damage.expected).toBe(300);
    // Aggregates stay mixed even though the representative event is from high alone.
    expect(rt.totalExpected).not.toBe(rt.events[0]!.damage.expected);
  });

  it("does not merge when pending queue signatures differ", () => {
    const a = createRuntime(meleeInput);
    enqueueEvent(a, {
      tick: 5,
      seq: 1,
      family: "hit",
      abilityId: "future-a",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      castSnap: castSnap(),
      resolve: noopResolve,
    });
    a.nextSeq = 2;

    const b = snapshotRuntime(a);
    b.queue.shift();
    enqueueEvent(b, {
      tick: 5,
      seq: 1,
      family: "hit",
      abilityId: "future-b",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      castSnap: castSnap(),
      resolve: noopResolve,
    });

    expect(
      mergeBranches([
        { weight: 0.5, rt: a },
        { weight: 0.5, rt: b },
      ]),
    ).toHaveLength(2);
  });

  it("does not merge when only castSnap.searingWindsAtCast differs", () => {
    const mk = (searingWindsAtCast: boolean) => {
      const rt = createRuntime(meleeInput);
      enqueueEvent(rt, {
        tick: 5,
        seq: 1,
        family: "hit",
        abilityId: "attack",
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        provenance: { kind: "player_direct" },
        castSnap: castSnap({ searingWindsAtCast }),
        resolve: noopResolve,
      });
      rt.nextSeq = 2;
      return rt;
    };
    expect(
      mergeBranches([
        { weight: 0.5, rt: mk(true) },
        { weight: 0.5, rt: mk(false) },
      ]),
    ).toHaveLength(2);
  });

  it("merges same-error failed arms with equivalent state; different errors stay split", () => {
    const rt = createRuntime(meleeInput);
    const a = snapshotRuntime(rt);
    const b = snapshotRuntime(rt);
    a.totalExpected = 100;
    b.totalExpected = 200;
    const same = mergeBranches([
      { weight: 0.4, rt: a, error: "unpayable assault" },
      { weight: 0.6, rt: b, error: "unpayable assault" },
    ]);
    expect(same).toHaveLength(1);
    expect(same[0]!.error).toBe("unpayable assault");
    expect(same[0]!.weight).toBeCloseTo(1);
    expect(same[0]!.rt.totalExpected).toBeCloseTo(0.4 * 100 + 0.6 * 200);

    const split = mergeBranches([
      { weight: 0.5, rt: snapshotRuntime(rt), error: "fail-a" },
      { weight: 0.5, rt: snapshotRuntime(rt), error: "fail-b" },
    ]);
    expect(split).toHaveLength(2);
    expect(split.every((br) => br.error !== undefined)).toBe(true);
    // Failed never merges into a success arm of the same state.
    const mixed = mergeBranches([
      { weight: 0.3, rt: snapshotRuntime(rt), error: "fail" },
      { weight: 0.7, rt: snapshotRuntime(rt) },
    ]);
    expect(mixed).toHaveLength(2);
    expect(mixed.some((br) => br.error === "fail")).toBe(true);
    expect(mixed.some((br) => br.error === undefined)).toBe(true);
  });
});

describe("snapshotRuntime score-only trim", () => {
  it("never shares state by ref; always structuredClone", () => {
    const rt = createRuntime({ ...meleeInput, detailLevel: "score-only" });
    const clone = snapshotRuntime(rt);
    expect(clone.state).not.toBe(rt.state);
    const parentMelee = rt.state.melee;
    clone.state = { ...clone.state, adrenaline: (clone.state.adrenaline ?? 0) + 1 };
    expect(rt.state.melee).toBe(parentMelee);
    expect(rt.state.adrenaline).not.toBe(clone.state.adrenaline);
  });

  it("shares empty analysis shell; keeps independent physics containers", () => {
    const rt = createRuntime({ ...meleeInput, detailLevel: "score-only" });
    for (let i = 0; i < 2; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("attack")!, rt.state.tick);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    const clone = snapshotRuntime(rt);
    // Analysis is empty and never mutated on score-only; the shell can be shared.
    expect(clone.analysis).toBe(rt.analysis);
    // Presentation history stays empty without cloning parent event arrays.
    expect(clone.events).toEqual([]);
    expect(rt.events).toEqual([]);
    // Mutable ranking / physics containers stay independent.
    for (const key of [
      "queue",
      "casts",
      "damageByTick",
      "recordBySeq",
      "hitDetails",
      "spiritEventMeta",
      "scheduledSpiritTracks",
      "spiritHitCounts",
    ] as const) {
      expect(clone[key], key).not.toBe(rt[key]);
    }
    // Cast record shells independent so expected/min/max cannot leak.
    expect(clone.casts[0]).not.toBe(rt.casts[0]);
    expect(clone.casts[0]!.result).not.toBe(rt.casts[0]!.result);
    // Score-only never grows hits; the empty hits array can be shared.
    expect(clone.casts[0]!.result.hits).toEqual([]);
    clone.casts[0]!.result.expected += 99;
    expect(rt.casts[0]!.result.expected).not.toBe(clone.casts[0]!.result.expected);
  });

  it("shares immutable HitResult values across map shells", () => {
    const rt = createRuntime({ ...meleeInput, detailLevel: "score-only" });
    const hit = {
      min: 10,
      max: 20,
      expected: 15,
      critChance: 0,
      critDamageBonus: 0,
    };
    rt.hitDetails.set(1, hit as never);
    const clone = snapshotRuntime(rt);
    expect(clone.hitDetails).not.toBe(rt.hitDetails);
    expect(clone.hitDetails.get(1)).toBe(hit);
    clone.hitDetails.set(2, hit as never);
    expect(rt.hitDetails.has(2)).toBe(false);
  });

  it("score-only profile costs less than full-analysis for same cast history", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    const full = createRuntime({ ...meleeInput, detailLevel: "full-analysis" });
    for (let i = 0; i < 3; i++) {
      const attempt = prepareSimulationCast(full, full.byId.get("attack")!, full.state.tick);
      if (attempt.ok) commitCast(full, attempt.prepared, false);
    }
    // Seed a fake presentation event so full-analysis has history to clone.
    full.events.push({
      tick: 0,
      seq: 0,
      family: "hit",
      abilityId: "attack",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      damage: { min: 1, max: 2, expected: 1.5 },
    } as never);
    snapshotRuntime(full);
    const fullProf = getBranchProfile();

    resetBranchProfile();
    const score = createRuntime({ ...meleeInput, detailLevel: "score-only" });
    for (let i = 0; i < 3; i++) {
      const attempt = prepareSimulationCast(score, score.byId.get("attack")!, score.state.tick);
      if (attempt.ok) commitCast(score, attempt.prepared, false);
    }
    snapshotRuntime(score);
    const scoreProf = getBranchProfile();
    enableBranchProfiling(false);
    resetBranchProfile();

    expect(scoreProf.branchSnapshots).toBe(1);
    expect(fullProf.branchSnapshots).toBe(1);
    expect(scoreProf.snapshotFieldsCloned).toBeLessThan(fullProf.snapshotFieldsCloned);
    expect(scoreProf.snapshotBytesEstimate).toBeLessThan(fullProf.snapshotBytesEstimate);
  });
});

describe("score-only hitDetails retention", () => {
  it("does not store hitDetails for plain attacks with no derived pending", () => {
    const rt = createRuntime({ ...meleeInput, detailLevel: "score-only" });
    for (let i = 0; i < 4; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("attack")!, rt.state.tick);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    advanceTo(rt, rt.state.tick + 40);
    expect(rt.hitDetails.size).toBe(0);
    expect(rt.totalExpected).toBeGreaterThan(0);
    // Cast result damage not accumulated on score-only.
    expect(rt.casts.every((c) => c.result.expected === 0)).toBe(true);
  });

  it("full-analysis still grows hitDetails for the same bar", () => {
    const rt = createRuntime({ ...meleeInput, detailLevel: "full-analysis" });
    for (let i = 0; i < 4; i++) {
      const attempt = prepareSimulationCast(rt, rt.byId.get("attack")!, rt.state.tick);
      if (attempt.ok) commitCast(rt, attempt.prepared, false);
    }
    advanceTo(rt, rt.state.tick + 40);
    expect(rt.hitDetails.size).toBeGreaterThan(0);
    expect(rt.casts.some((c) => c.result.expected > 0)).toBe(true);
  });

  it("retains hitDetails only while bloat derived tails are pending", () => {
    const rt = createRuntime({ ...necroInput, detailLevel: "score-only", startingAdrenaline: 100 });
    const attempt = prepareSimulationCast(rt, rt.byId.get("bloat")!, 0);
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    commitCast(rt, attempt.prepared, false);
    const derivedPending = rt.queue.pending().filter((e) => e.derivedFrom != null);
    expect(derivedPending.length).toBeGreaterThan(0);
    const firstDerivedTick = Math.min(...derivedPending.map((e) => e.tick));
    advanceTo(rt, firstDerivedTick - 1);
    expect(rt.hitDetails.size).toBe(1);
    const sourceSeq = [...rt.hitDetails.keys()][0]!;
    expect(rt.queue.pending().some((e) => e.derivedFrom === sourceSeq)).toBe(true);
    advanceTo(rt, rt.queue.maxTick() + 1);
    expect(rt.hitDetails.size).toBe(0);
    expect(rt.totalExpected).toBeGreaterThan(0);
  });

  it("score-only branchKey ignores unreferenced historical hitDetails", () => {
    const a = createRuntime({ ...meleeInput, detailLevel: "score-only" });
    const b = snapshotRuntime(a);
    a.hitDetails.set(0, {
      potential: 1000,
      min: 100,
      max: 200,
      critMin: 150,
      critMax: 300,
      critChance: 0.1,
      nonCritExpected: 150,
      critExpected: 225,
      expected: 157.5,
      uncappedExpected: 157.5,
      capLoss: 0,
    } as never);
    b.hitDetails.set(0, {
      potential: 1000,
      min: 999,
      max: 999,
      critMin: 999,
      critMax: 999,
      critChance: 0.9,
      nonCritExpected: 999,
      critExpected: 999,
      expected: 999,
      uncappedExpected: 999,
      capLoss: 0,
    } as never);
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(
      mergeBranches([
        { weight: 0.5, rt: a },
        { weight: 0.5, rt: b },
      ]),
    ).toHaveLength(1);
  });

  it("live derivedFrom hitDetails still split score-only branch keys", () => {
    const a = createRuntime({ ...meleeInput, detailLevel: "score-only" });
    a.hitDetails.set(0, {
      potential: 1000,
      min: 100,
      max: 200,
      critMin: 150,
      critMax: 300,
      critChance: 0.1,
      nonCritExpected: 150,
      critExpected: 225,
      expected: 157.5,
      uncappedExpected: 157.5,
      capLoss: 0,
    } as never);
    a.nextSeq = 2;
    enqueueEvent(a, {
      tick: 8,
      seq: 1,
      family: "dot",
      abilityId: "dismember",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: 0,
      provenance: { kind: "derived_tail", detail: "dismember" },
      resolve: noopResolve,
    });
    const b = snapshotRuntime(a);
    b.hitDetails.set(0, {
      ...a.hitDetails.get(0)!,
      expected: 999,
    });
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(b));
  });
});

describe("capBranches", () => {
  it("keeps heaviest branches with own weights; discarded mass is residual", () => {
    const base = createRuntime(meleeInput);
    const mk = (weight: number): { weight: number; rt: ReturnType<typeof createRuntime> } => ({
      weight,
      rt: snapshotRuntime(base),
    });
    // Distinct adrenaline so merge does not collapse them first.
    const branches = [0.4, 0.3, 0.15, 0.1, 0.05].map((w, i) => {
      const b = mk(w);
      b.rt.state = { ...b.rt.state, adrenaline: i };
      return b;
    });
    const capped = capBranches(branches, 2);
    expect(capped.branches).toHaveLength(2);
    // Heaviest keep their own weights; no mass theft onto keep[0].
    expect(capped.branches[0]!.weight).toBeCloseTo(0.4);
    expect(capped.branches[1]!.weight).toBeCloseTo(0.3);
    expect(capped.residualWeight).toBeCloseTo(0.15 + 0.1 + 0.05);
    expect(capped.exactness).toBe("bounded-approximation");
    const mass = capped.branches.reduce((s, b) => s + b.weight, 0) + capped.residualWeight;
    expect(mass).toBeCloseTo(1);
  });

  it("reports exact when nothing is discarded", () => {
    const base = createRuntime(meleeInput);
    const branches = [
      { weight: 0.6, rt: snapshotRuntime(base) },
      { weight: 0.4, rt: snapshotRuntime(base) },
    ];
    // Distinct future state so cap sees two arms (not pre-merged).
    branches[1]!.rt.state = { ...branches[1]!.rt.state, adrenaline: 1 };
    const capped = capBranches(branches, 8);
    expect(capped.branches).toHaveLength(2);
    expect(capped.residualWeight).toBe(0);
    expect(capped.exactness).toBe("exact");
  });

  it("mergeAndCapBranches stays within max and conserves mass via residual", () => {
    const base = createRuntime(meleeInput);
    const many = Array.from({ length: 100 }, (_, i) => {
      const rt = snapshotRuntime(base);
      rt.state = { ...rt.state, adrenaline: i };
      return { weight: 1 / 100, rt };
    });
    const out = mergeAndCapBranches(many, 16);
    expect(out.branches.length).toBeLessThanOrEqual(16);
    expect(out.residualWeight).toBeGreaterThan(0);
    expect(out.exactness).toBe("bounded-approximation");
    const mass = out.branches.reduce((s, b) => s + b.weight, 0) + out.residualWeight;
    expect(mass).toBeCloseTo(1);
  });

  it("mergeAndCapBranches is merged-exactly when merge reduces count and residual is 0", () => {
    const base = createRuntime(meleeInput);
    // Same future key: merge collapses to one, no cap discard.
    const twins = [
      { weight: 0.3, rt: snapshotRuntime(base) },
      { weight: 0.7, rt: snapshotRuntime(base) },
    ];
    const out = mergeAndCapBranches(twins, 64);
    expect(out.branches).toHaveLength(1);
    expect(out.branches[0]!.weight).toBeCloseTo(1);
    expect(out.residualWeight).toBe(0);
    expect(out.exactness).toBe("merged-exactly");
  });

  it("branch profile counters gate on and measure snapshot/mergeAndCap", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    const base = createRuntime(meleeInput);
    const many = Array.from({ length: 100 }, (_, i) => {
      const rt = snapshotRuntime(base);
      rt.state = { ...rt.state, adrenaline: i };
      return { weight: 1 / 100, rt };
    });
    const out = mergeAndCapBranches(many, 16);
    const p = getBranchProfile();
    expect(p.branchSnapshots).toBe(100);
    expect(p.snapshotFieldsCloned).toBeGreaterThan(0);
    expect(p.snapshotBytesEstimate).toBeGreaterThan(0);
    expect(p.branchKeySerializations).toBe(100);
    expect(p.branchKeyChars).toBeGreaterThan(0);
    expect(p.mergeAndCapCalls).toBe(1);
    expect(p.mergeAndCapDiscards).toBe(84);
    expect(p.residualMassEvents).toBe(1);
    expect(p.residualMassTotal).toBeCloseTo(out.residualWeight);
    expect(p.maxLiveBranches).toBeGreaterThanOrEqual(16);
    enableBranchProfiling(false);
    resetBranchProfile();
    snapshotRuntime(base);
    expect(getBranchProfile().branchSnapshots).toBe(0);
  });

  it("combineExactness takes the more approximate label", () => {
    expect(combineExactness("exact", "merged-exactly")).toBe("merged-exactly");
    expect(combineExactness("merged-exactly", "bounded-approximation")).toBe(
      "bounded-approximation",
    );
    expect(combineExactness("truncated", "exact")).toBe("truncated");
    expect(combineExactness("resampled", "bounded-approximation")).toBe("resampled");
  });
});

describe("appendWithIntermediateCap / multi-parent intermediate bound", () => {
  it("batches deterministic parent commits before branch-key folding", () => {
    const base = createRuntime(meleeInput);
    const attack = base.byId.get("attack")!;
    const plans = Array.from({ length: 40 }, (_, i) => {
      const rt = snapshotRuntime(base);
      rt.state = { ...rt.state, adrenaline: i };
      return planCastOutcomes({ weight: 1 / 40, rt }, attack, 0, false, 8, 16).plans[0]!;
    });

    enableBranchProfiling(true);
    resetBranchProfile();
    const result = materializeCastPlans(plans, 8, 16);
    const profile = getBranchProfile();
    enableBranchProfiling(false);
    resetBranchProfile();

    expect(result.branches).toHaveLength(8);
    expect(
      result.branches.reduce((sum, branch) => sum + branch.weight, 0) + result.residualWeight,
    ).toBeCloseTo(1);
    expect(profile.mergeAndCapCalls).toBeLessThan(10);
  });

  it("appendWithIntermediateCap stays within max and conserves mass", () => {
    const base = createRuntime(meleeInput);
    let acc: ReturnType<typeof mergeAndCapBranches>["branches"] = [];
    let residual = 0;
    for (let i = 0; i < 200; i++) {
      const rt = snapshotRuntime(base);
      // Distinct spirit track so each append arm has a unique future key.
      rt.spiritHitCounts.set(`track-${i}`, 1);
      const folded = appendWithIntermediateCap(acc, [{ weight: 1 / 200, rt }], 16);
      residual += folded.residualWeight;
      acc = folded.branches;
    }
    expect(acc.length).toBeLessThanOrEqual(16);
    const mass = acc.reduce((sum, b) => sum + b.weight, 0) + residual;
    expect(mass).toBeCloseTo(1);
    expect(residual).toBeGreaterThan(0);
  });

  it("pre-caps a single expansion larger than max before append", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    const base = createRuntime(meleeInput);
    const huge = Array.from({ length: 100 }, (_, i) => {
      const rt = snapshotRuntime(base);
      rt.state = { ...rt.state, adrenaline: i };
      return { weight: 1 / 100, rt };
    });
    const folded = appendWithIntermediateCap([], huge, 16);
    expect(folded.branches.length).toBeLessThanOrEqual(16);
    expect(folded.residualWeight).toBeGreaterThan(0);
    // Peak never holds the full 100 after the fold.
    expect(getBranchProfile().maxLiveBranches).toBeLessThanOrEqual(100);
    expect(folded.branches.length + 0).toBeLessThanOrEqual(16);
    enableBranchProfiling(false);
    resetBranchProfile();
  });

  it("createCastContext intermediate-caps parent expansion like materializeCastPlans", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    // Many Impatient arms then multi-hit assault: outer product would be huge without early cap.
    const ctx = createCastContext({
      ...meleeInput,
      startingAdrenaline: 100,
      adrenaline: { impatientRank: 4, relentlessRank: 5 },
    });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 8; i++) {
      ctx.performCast(attack, ctx.getState().tick, false);
    }
    ctx.performCast(assault, ctx.getState().tick, false);
    const summary = ctx.finish();
    const p = getBranchProfile();
    enableBranchProfiling(false);
    resetBranchProfile();
    // Without intermediate absorb, multi-parent * multi-arm can peak far above O(max).
    expect(p.maxLiveBranches).toBeLessThanOrEqual(MAX_INTERMEDIATE_BRANCHES);
    expect(MAX_INTERMEDIATE_BRANCHES).toBe(MAX_LIVE_BRANCHES * 2);
    expect(p.maxLiveBranches).toBeGreaterThan(0);
    // Residual law unchanged: concrete + residual discloses full mass when branched.
    if (summary.rng) {
      const mass = summary.rng.probabilityMass + (summary.rng.residualWeight ?? 0);
      expect(mass).toBeCloseTo(1, 8);
    }
  });
});

describe("RNG branches merge to the weighted mean", () => {
  it("Impatient's branch set totals the same as its two outcomes weighted", () => {
    const rotation: Omit<SimulateInput, "adrenaline"> = {
      ...meleeInput,
      rotation: rotationOf("attack", "attack"),
    };
    const withPerk = simulate({ ...rotation, adrenaline: { impatientRank: 4 } });
    expect(withPerk.ok).toBe(true);
    expect(withPerk.rng?.method).toBe("probability-weighted branching");
    // Damage is unaffected by the perk; only adrenaline branches.
    const plain = simulate(rotation);
    expect(withPerk.totalExpected).toBeCloseTo(plain.totalExpected);
  });

  it("a deterministic run reports no branching at all", () => {
    const s = simulate({ ...meleeInput, rotation: rotationOf("attack", "attack") });
    expect(s.rng).toBeUndefined();
  });

  it("keeps a long Impatient and Relentless rotation bounded", () => {
    const cycle = ["attack", "attack", "attack", "attack", "assault"];
    const rotation = rotationOf(...Array.from({ length: 10 }, () => cycle).flat());
    const stochastic = simulate({
      ...meleeInput,
      adrenaline: { impatientRank: 4, relentlessRank: 5 },
      rotation,
    });
    const plain = simulate({ ...meleeInput, rotation });
    expect(stochastic.ok).toBe(true);
    expect(stochastic.rng!.terminalClasses).toBeLessThan(64);
    // Perk arms do not change ability damage: E[D|concrete] tracks the plain path.
    // residual > 0: primary totalExpected is known-mass contribution, not that conditional.
    const residual = stochastic.rng?.residualWeight ?? 0;
    const conditional = stochastic.damage.conditionalConcreteMean ?? stochastic.totalExpected;
    expect(conditional).toBeCloseTo(plain.totalExpected, 8);
    if (residual > 1e-9) {
      expect(stochastic.damage.scope).toBe("known-mass-contribution");
      expect(stochastic.totalExpected).toBeCloseTo(conditional * stochastic.rng!.concreteMass, 8);
      expect(stochastic.totalExpected).toBeLessThan(plain.totalExpected);
    } else {
      expect(stochastic.totalExpected).toBeCloseTo(plain.totalExpected, 8);
    }
  });
});

describe("Invigorating / Impatient adrenaline", () => {
  it("Invigorating multiplies basic adrenaline gains (R4: 9 → 9×1.2)", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2 },
      rotation: rotationOf("attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].adrenalineAfter).toBeCloseTo(9 * 1.2);
  });

  it("Impatient proc grants +3 on the basic; no-proc leaves the base gain", () => {
    const procCtx = createCastContext({ ...baseInput, adrenaline: { impatientRank: 4 } });
    const attack = procCtx.byId.get("attack")!;
    expect(procCtx.performCast(attack, 0, false, { impatient: true }).ok).toBe(true);
    expect(procCtx.getState().adrenaline).toBeCloseTo(12);

    const flatCtx = createCastContext({ ...baseInput, adrenaline: { impatientRank: 4 } });
    expect(flatCtx.performCast(attack, 0, false, { impatient: false }).ok).toBe(true);
    expect(flatCtx.getState().adrenaline).toBeCloseTo(9);
  });

  it("reports a representative from the highest-weight terminal class", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.history.kind).toBe("representative-terminal-class");
    expect(s.rng).toMatchObject({
      method: "probability-weighted branching",
      terminalClasses: 2,
      representativeClassWeight: 0.64,
      representativeClassTicks: 3,
    });
    expect(s.rng!.representative).toMatchObject({
      classWeight: 0.64,
      ticks: 3,
      historyKind: "representative-terminal-class",
      selectionReason: "highest-probability-mass",
    });
    expect(lastCast(s).adrenalineAfter).toBe(9);
  });

  it("branches whose adrenaline realigns merge back", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack", "attack"),
    });
    expect(s.ok).toBe(true);
    // 24 (p²), 21 (2pq, merged), 18 (q²)
    expect(s.rng?.terminalClasses).toBe(3);
    expect(s.rng?.representativeClassWeight).toBeCloseTo(0.4608, 10);
    expect(lastCast(s).adrenalineAfter).toBe(21);
  });

  it("Impatient is inside Invigorating (wiki order: (9+3)*1.2 = 14.4)", () => {
    const ctx = createCastContext({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientRank: 4 },
    });
    const attack = ctx.byId.get("attack")!;
    expect(ctx.performCast(attack, 0, false, { impatient: true }).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBeCloseTo(14.4);
  });

  it("does not apply Invigorating/Impatient when there is no adrenaline gain", () => {
    const plain = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
    });
    const noGain = simulate({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientRank: 4 },
      rotation: rotationOf("dismember"), // enhanced bleed - no adrenaline field
    });
    expect(plain.casts[0].adrenalineAfter).toBe(9);
    expect(noGain.casts[0].adrenalineAfter).toBe(0);
    expect(noGain.rng).toBeUndefined(); // no basic cast → no RNG point → no branching
  });

  it("does not branch a basic with no adrenaline gain", () => {
    const noGainBasic = {
      id: "no_gain_basic",
      name: "No-gain basic",
      style: "melee" as const,
      category: "basic" as const,
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
    };
    const s = simulate({
      ...baseInput,
      abilities: [...MELEE_ABILITIES, noGainBasic],
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf(noGainBasic.id),
    });
    expect(s.ok).toBe(true);
    expect(s.rng).toBeUndefined();
  });
});

describe("Relentless refund branching", () => {
  it("a proc refunds the full cost and starts the 30s lockout", () => {
    const ctx = createCastContext({ ...baseInput, adrenaline: { relentlessRank: 5 } });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().adrenaline).toBe(36);
    const attempt = ctx.performCast(assault, ctx.getState().tick, false, { relentless: true });
    expect(attempt.ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(36); // cost 25 fully refunded
    expect(ctx.getState().relentlessUntilTick).toBe(12 + 50);
    expect(ctx.finish().casts.at(-1)).toMatchObject({
      listedCost: 25,
      effectiveCost: 25,
      actualSpend: 0,
      refund: 25,
      adrenalineGained: 0,
      adrenalineTransaction: expect.objectContaining({
        spendPreventedBy: "relentless",
        actualSpend: 0,
        effectiveCost: 25,
      }),
    });
  });

  it("a non-proc spends the cost normally with no lockout", () => {
    const ctx = createCastContext({ ...baseInput, adrenaline: { relentlessRank: 5 } });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(assault, ctx.getState().tick, false, { relentless: false }).ok).toBe(
      true,
    );
    expect(ctx.getState().adrenaline).toBe(36 - 25);
    expect(ctx.getState().relentlessUntilTick).toBe(0);
  });

  it("the lockout spends normally on a second spender inside 50 ticks, even told to proc", () => {
    const ctx = createCastContext({ ...baseInput, adrenaline: { relentlessRank: 5 } });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    ctx.performCast(assault, ctx.getState().tick, false, { relentless: true });
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    // Second assault lands inside the lockout: the override cannot re-proc it.
    const before = ctx.getState().adrenaline;
    expect(
      ctx.performCast(assault, ctx.firstLegalTick("assault"), false, { relentless: true }).ok,
    ).toBe(true);
    expect(ctx.getState().adrenaline).toBe(before - 25);
  });

  it("driver branches on the spender and surfaces the failed branch's weight", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault", "assault"),
    });
    // 36 adrenaline at the first assault: a proc (w 0.05) refunds → the second
    // assault casts; no-proc (w 0.95) leaves 11 → the second assault is unpayable.
    // A flat EV would have reported an impossible middle state instead.
    expect(s.ok).toBe(false);
    expect(s.rng?.failedWeight).toBeCloseTo(0.95, 10);
    expect(s.failure?.failedWeight).toBeCloseTo(0.95, 10);
    expect(s.failure?.successfulWeight).toBeCloseTo(0.05, 10);
    // Primary totals stay unconditional over concrete mass; success is diagnostic only.
    expect(s.failure?.totalsScope).toBe("unconditional-all-mass");
    expect(s.error).toContain("assault");
  });

  it("a rotation legal on every branch stays ok with weighted totals", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "assault"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng?.terminalClasses).toBe(2);
    expect(lastCast(s).adrenalineAfter).toBe(27 - 25);
    expect(lastCast(s).result.expected).toBeCloseTo(4 * 1400);
  });

  it("never branches on zero-cost casts", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack"),
    });
    expect(s.rng).toBeUndefined();
    expect(s.casts[0].adrenalineAfter).toBe(9);
  });
});
