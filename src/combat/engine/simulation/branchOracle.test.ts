/**
 * Independent stochastic oracle: probability mass, failure honesty, Leng EV.
 * Production may cap live branches; oracle expand is uncapped via castOutcomes.
 */
import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { activeEquipmentEffects } from "../../shared/equipment";
import { castOutcomes, mergeBranches, snapshotRuntime } from "./branch";
import type { CastContextInput, RotationSummary } from "./contracts";
import { rotationOf } from "./contracts";
import { createRuntime } from "../runtime/runtime";
import { simulate } from "./simulate";
import { expandLengOnLand } from "./lengLandBranch";
import { scoreSummary, OBJECTIVE_HORIZON_TICKS } from "../../solver/objective";
import { PROB_TOLERANCE, isNearOne } from "./stats";
import { baseInput } from "../../test/fixtures/inputs";
import { lengLandOutcomes } from "../../styles/melee/lengRng";
import {
  PRIMORDIAL_ICE_CAP,
  concretePlusResidual,
  expectedAdrenaline,
  expectedDamageOnSuccess,
  expectedDamageUnconditional,
  expectedStacksFromOutcomes,
  failedMass,
  lengExpectedStacks,
  lengHitOutcomeTree,
  massOf,
  oracleSimulate,
  residualOf,
  successfulMass,
} from "./branchOracle";

const meleeInput: CastContextInput = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
  context: { style: "melee" },
};

function lengGearContextInput(): CastContextInput {
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects: activeEquipmentEffects({
      style: "melee",
      equipmentSlots: {
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    }),
    weaponConfiguration: "dualwield",
    context: { style: "melee" },
  };
}

function prodResidual(s: RotationSummary): number {
  return residualOf(s.rng as { residualWeight?: number } | undefined);
}

describe("branch probability oracle", () => {
  it("1. more than 64 distinct terminal paths: oracle mass=1; production concrete+residual~1", () => {
    // 7 Impatient basics: 2^7 = 128 leaves without merge; no live cap on oracle.
    const rotation = rotationOf(...Array.from({ length: 7 }, () => "attack"));
    const input = {
      ...meleeInput,
      adrenaline: { impatientRank: 4 },
      rotation,
    };
    const { branches } = oracleSimulate(input, { merge: false });
    expect(branches.length).toBe(128);
    expect(isNearOne(massOf(branches))).toBe(true);
    expect(failedMass(branches)).toBe(0);

    const prod = simulate(input);
    expect(prod.ok).toBe(true);
    expect(prod.rng).toBeDefined();
    expect(prod.rng!.terminalClasses).toBeLessThanOrEqual(64);
    // concrete probabilityMass + residual must conserve unit mass
    expect(isNearOne(concretePlusResidual(prod.rng))).toBe(true);
  });

  it("2. failed mass never becomes successful mass", () => {
    const rotation = rotationOf(
      "attack",
      "attack",
      "attack",
      "attack",
      "assault",
      "assault",
    );
    const input = {
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation,
    };
    const { branches, sawBranching } = oracleSimulate(input);
    expect(sawBranching).toBe(true);
    const failed = failedMass(branches);
    const success = successfulMass(branches);
    expect(failed).toBeCloseTo(0.95, 8);
    expect(success).toBeCloseTo(0.05, 8);
    expect(isNearOne(failed + success)).toBe(true);

    // Success: first assault Relentless-procced so second assault cast (adren may be 11 after spend).
    // Fail: second assault unpayable (adren left after no-proc first assault is 11 < 25).
    for (const b of branches) {
      if (b.error === undefined) {
        const assaults = b.rt.casts.filter((c) => c.abilityId === "assault");
        expect(assaults.length).toBe(2);
      } else {
        expect(b.error.toLowerCase()).toMatch(/assault|adrenaline|afford/);
        expect(b.rt.state.adrenaline).toBeLessThan(25);
      }
    }

    const prod = simulate(input);
    expect(prod.ok).toBe(false);
    expect(prod.failure!.failedWeight).toBeCloseTo(failed, 8);
    expect(prod.failure!.successfulWeight).toBeCloseTo(success, 8);
    // Primary totals stay unconditional; failed mass is not reassigned as success.
    expect(prod.failure!.totalsScope).toBe("unconditional-all-mass");
    expect(prod.totalExpected).toBeGreaterThan(0);
    expect(prod.totalExpected).toBeCloseTo(expectedDamageUnconditional(branches), 6);
  });

  it("3. residualWeight 0: production damage matches oracle within tolerance", () => {
    const rotation = rotationOf("attack", "attack");
    const input = {
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation,
    };
    const oracle = oracleSimulate(input);
    const prod = simulate(input);
    expect(prodResidual(prod)).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(prod.ok).toBe(true);
    // Impatient does not change damage; all paths share ability EV.
    expect(prod.totalExpected).toBeCloseTo(expectedDamageUnconditional(oracle.branches), 8);
    expect(expectedDamageOnSuccess(oracle.branches)).toBeCloseTo(prod.totalExpected, 8);
    expect(expectedAdrenaline(oracle.branches)).toBeCloseTo(
      oracle.branches
        .filter((b) => !b.error)
        .reduce((s, b) => s + b.weight * b.rt.state.adrenaline, 0) /
        massOf(oracle.branches.filter((b) => !b.error)),
      10,
    );
    expect(prod.rng?.terminalClasses).toBe(oracle.branches.length);
    expect(isNearOne(massOf(oracle.branches))).toBe(true);
  });

  it("4. Relentless lockout is not borrowed across branches", () => {
    const { branches } = oracleSimulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf(
        "attack",
        "attack",
        "attack",
        "attack",
        "assault",
        "assault",
      ),
    });
    const proc = branches.find((b) => b.error === undefined);
    const fail = branches.find((b) => b.error !== undefined);
    expect(proc).toBeDefined();
    expect(fail).toBeDefined();
    expect(proc!.rt.state.relentlessUntilTick).toBeGreaterThan(0);
    expect(fail!.rt.state.adrenaline).toBeLessThan(25);
  });

  it("5. conjure / spirit maps stay branch-local after snapshot", () => {
    const necro: CastContextInput = {
      ...meleeInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    };
    const rt = createRuntime(necro);
    const ability = rt.byId.get("conjure_undead_army");
    expect(ability).toBeDefined();
    const outcomes = castOutcomes({ weight: 1, rt }, ability!, 0, false);
    expect(outcomes.branches.length).toBeGreaterThanOrEqual(1);
    for (const b of outcomes.branches) {
      if (b.error) continue;
      const clone = snapshotRuntime(b.rt);
      expect(clone.spiritHitCounts).not.toBe(b.rt.spiritHitCounts);
      expect(clone.scheduledSpiritTracks).not.toBe(b.rt.scheduledSpiritTracks);
    }
  });

  it("6. delayed DoT provenance blocks false merge", () => {
    const a = createRuntime(meleeInput);
    const noop = () => ({ damage: { min: 10, max: 10, expected: 10 } });
    a.queue.push({
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
      resolve: noop,
    });
    a.nextSeq = 2;
    a.hitDetails.set(0, {
      min: 10,
      max: 10,
      expected: 10,
      critMax: 10,
      critChance: 0,
      critExpected: 0,
      nonCritExpected: 10,
      capLoss: 0,
    } as never);

    const b = snapshotRuntime(a);
    b.queue.shift();
    b.queue.push({
      tick: 8,
      seq: 1,
      family: "dot",
      abilityId: "dismember",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: 99,
      provenance: { kind: "derived_tail", detail: "dismember" },
      resolve: noop,
    });
    b.hitDetails.set(99, {
      min: 50,
      max: 50,
      expected: 50,
      critMax: 50,
      critChance: 0,
      critExpected: 0,
      nonCritExpected: 50,
      capLoss: 0,
    } as never);

    expect(
      mergeBranches([
        { weight: 0.5, rt: a },
        { weight: 0.5, rt: b },
      ]),
    ).toHaveLength(2);
  });

  it("7. Impatient re-merge: exact when residual is 0", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(prodResidual(s)).toBeLessThanOrEqual(PROB_TOLERANCE);
    // 24 (p^2), 21 (2pq merged), 18 (q^2)
    expect(s.rng?.terminalClasses).toBe(3);
    expect(isNearOne(concretePlusResidual(s.rng))).toBe(true);
  });

  it("8. historical damage alone does not block merge; E[D] weight-averages", () => {
    const low = createRuntime(meleeInput);
    low.totalExpected = 100;
    low.totalMin = 80;
    low.totalMax = 120;
    const high = snapshotRuntime(low);
    high.totalExpected = 300;
    high.totalMin = 240;
    high.totalMax = 360;
    const merged = mergeBranches([
      { weight: 0.25, rt: low },
      { weight: 0.75, rt: high },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.rt.totalExpected).toBe(250);
  });

  it("9. different pending ability ids do not merge", () => {
    const a = createRuntime(meleeInput);
    const noop = () => ({ damage: { min: 0, max: 0, expected: 0 } });
    a.queue.push({
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
      resolve: noop,
    });
    a.nextSeq = 2;
    const b = snapshotRuntime(a);
    b.queue.shift();
    b.queue.push({
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
      resolve: noop,
    });
    expect(
      mergeBranches([
        { weight: 0.5, rt: a },
        { weight: 0.5, rt: b },
      ]),
    ).toHaveLength(2);
  });

  it("10. solver evaluation rejects residual mass", () => {
    const scored = scoreSummary(
      {
        ok: true,
        damageByTick: { 0: 1000 },
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        rng: { residualWeight: 0.3, failedWeight: 0 },
      },
      "balanced",
    );
    expect(scored.ok).toBe(false);
    if (!scored.ok) {
      expect(scored.reason).toMatch(/residualWeight|exactness|residual/i);
    }
  });

  it("production vs oracle: Relentless failed weight agrees when residual is 0", () => {
    const input = {
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault", "assault"),
    };
    const oracle = oracleSimulate(input);
    const prod = simulate(input);
    expect(prod.ok).toBe(false);
    expect(prodResidual(prod)).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(prod.failure!.failedWeight).toBeCloseTo(failedMass(oracle.branches), 10);
    expect(prod.failure!.successfulWeight).toBeCloseTo(successfulMass(oracle.branches), 10);
  });
});

describe("Leng exhaustive EV oracle", () => {
  it("one-hit outcome tree conserves mass and E[delta stacks]=0.12", () => {
    const tree = lengHitOutcomeTree(true, true);
    expect(isNearOne(tree.reduce((s, l) => s + l.weight, 0))).toBe(true);
    const eDelta = tree.reduce((s, l) => s + l.weight * l.deltaStacks, 0);
    expect(eDelta).toBeCloseTo(0.12, 12);

    // Cross-check production pure enumerator
    const prodTree = lengLandOutcomes(true, true, 0, 0, 0);
    expect(isNearOne(prodTree.reduce((s, o) => s + o.weight, 0))).toBe(true);
    expect(expectedStacksFromOutcomes(prodTree)).toBeCloseTo(0.12, 12);
  });

  it("multi-hit exhaustive stack EV conserves mass", () => {
    const r = lengExpectedStacks(5, {
      hasEndlessFrost: true,
      hasBoundlessChill: true,
      startStacks: 0,
    });
    expect(isNearOne(r.mass)).toBe(true);
    expect(r.expectedStacks).toBeGreaterThan(0);
    expect(r.expectedStacks).toBeLessThanOrEqual(PRIMORDIAL_ICE_CAP);
    expect(r.terminalClasses).toBeGreaterThan(1);
  });

  it("expandLengOnLand E[stacks] matches exhaustive oracle", () => {
    const oracle = lengExpectedStacks(1, {
      hasEndlessFrost: true,
      hasBoundlessChill: true,
    });
    const rt = createRuntime(lengGearContextInput());
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.residualWeight).toBe(0);
    expect(isNearOne(massOf(set.branches))).toBe(true);
    const eStacks = set.branches.reduce(
      (s, b) => s + b.weight * b.rt.state.melee.primordialIceStacks,
      0,
    );
    expect(eStacks).toBeCloseTo(oracle.expectedStacks, 10);
    expect(eStacks).toBeCloseTo(0.12, 10);
  });

  it("unrelated non-Leng event does not alter Leng E[stacks] under EV model", () => {
    // Pure EV: only Leng-eligible hits move stack mass.
    const twoHits = lengExpectedStacks(2, {
      hasEndlessFrost: true,
      hasBoundlessChill: true,
    });
    const sameTwoHits = lengExpectedStacks(2, {
      hasEndlessFrost: true,
      hasBoundlessChill: true,
      startStacks: 0,
    });
    expect(sameTwoHits.expectedStacks).toBeCloseTo(twoHits.expectedStacks, 12);
    expect(isNearOne(twoHits.mass)).toBe(true);

    // expandLengOnLand twice vs with an intervening non-Leng snapshot: same EV.
    const rtA = createRuntime(lengGearContextInput());
    const liveA = expandLengOnLand({ weight: 1, rt: rtA }, 0).branches;
    // Merge stack classes for the second hit expand (independent rolls per land).
    const afterSecond: { weight: number; stacks: number }[] = [];
    for (const b of liveA) {
      const step = expandLengOnLand(
        { weight: b.weight, rt: snapshotRuntime(b.rt) },
        3,
      );
      for (const nb of step.branches) {
        afterSecond.push({
          weight: nb.weight,
          stacks: nb.rt.state.melee.primordialIceStacks,
        });
      }
    }
    expect(isNearOne(afterSecond.reduce((s, o) => s + o.weight, 0))).toBe(true);
    expect(expectedStacksFromOutcomes(afterSecond)).toBeCloseTo(twoHits.expectedStacks, 8);

    // Intervening non-Leng: bump tick / nextSeq without stack change, then two lands.
    const rtB = createRuntime(lengGearContextInput());
    rtB.nextSeq += 10;
    rtB.state = { ...rtB.state, tick: 5 };
    const liveB = expandLengOnLand({ weight: 1, rt: rtB }, 5).branches;
    const afterSecondB: { weight: number; stacks: number }[] = [];
    for (const b of liveB) {
      const step = expandLengOnLand(
        { weight: b.weight, rt: snapshotRuntime(b.rt) },
        8,
      );
      for (const nb of step.branches) {
        afterSecondB.push({
          weight: nb.weight,
          stacks: nb.rt.state.melee.primordialIceStacks,
        });
      }
    }
    expect(expectedStacksFromOutcomes(afterSecondB)).toBeCloseTo(twoHits.expectedStacks, 8);
    expect(expectedStacksFromOutcomes(afterSecondB)).toBeCloseTo(
      expectedStacksFromOutcomes(afterSecond),
      10,
    );
  });

  it("simulate/oracle cast path: Leng land branches match exhaustive E[stacks]", () => {
    const oracle = lengExpectedStacks(1, {
      hasEndlessFrost: true,
      hasBoundlessChill: true,
    });
    const input = {
      ...lengGearContextInput(),
      rotation: rotationOf("attack"),
    };
    // Uncapped castOutcomes goes through commitCastBranches + Leng land fork.
    const { branches, sawBranching } = oracleSimulate(input, { merge: false });
    expect(sawBranching || branches.length > 1).toBe(true);
    expect(isNearOne(massOf(branches))).toBe(true);
    const eStacks = branches.reduce(
      (s, b) => s + b.weight * b.rt.state.melee.primordialIceStacks,
      0,
    );
    expect(eStacks).toBeCloseTo(oracle.expectedStacks, 8);
    expect(eStacks).toBeCloseTo(0.12, 8);

    // Production simulate may cap; when residual is 0, E[stacks] still matches.
    const prod = simulate(input);
    expect(prod.ok).toBe(true);
    if (prodResidual(prod) <= PROB_TOLERANCE) {
      // Re-expand uncapped for stack EV (summary does not expose stack EV).
      const again = oracleSimulate(input);
      const e2 = again.branches.reduce(
        (s, b) => s + b.weight * b.rt.state.melee.primordialIceStacks,
        0,
      );
      expect(e2).toBeCloseTo(oracle.expectedStacks, 8);
    }
  });
});
