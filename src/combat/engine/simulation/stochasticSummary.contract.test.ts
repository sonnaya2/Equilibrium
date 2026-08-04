import { describe, expect, it } from "vitest";
import { analysisReconciles } from "../analysis";
import { createRuntime } from "../runtime/runtime";
import { baseInput } from "../../test/fixtures/inputs";
import { mergeBranches } from "./branch";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { combineBranchSummaries } from "./summary";
import {
  isNearOne,
  mergeSupportOffsets,
  PROB_TOLERANCE,
  supportMaxFrom,
  supportMinFrom,
} from "./stats";
import { TICK_SECONDS } from "../../core/ticks";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";

function seedRuntime(damage: {
  expected: number;
  min: number;
  max: number;
  endTick: number;
  supportMinOffset?: number;
  supportMaxOffset?: number;
}) {
  const rt = createRuntime(baseInput);
  rt.totalExpected = damage.expected;
  rt.totalMin = damage.min;
  rt.totalMax = damage.max;
  rt.endTick = damage.endTick;
  rt.analysis.directDamage = damage.expected;
  rt.analysis.sources.set("ability-direct", damage.expected);
  rt.analysis.effects.set("attack", {
    id: "attack",
    kind: "ability-direct",
    totalDamage: damage.expected,
    directDamage: damage.expected,
    dotDamage: 0,
    criticalContribution: 0,
    capLoss: 0,
    casts: 1,
    triggerRolls: 0,
    expectedActivations: 1,
    expectedSeparateHits: 1,
    attachedComponents: 0,
    bonusDamage: 0,
  });
  if (damage.supportMinOffset !== undefined) {
    rt.analysis.supportMinOffset = damage.supportMinOffset;
  }
  if (damage.supportMaxOffset !== undefined) {
    rt.analysis.supportMaxOffset = damage.supportMaxOffset;
  }
  return rt;
}

describe("stochastic summary contract", () => {
  it("1. weighted conditional minimum is not reported as true support minimum", () => {
    const low = seedRuntime({ expected: 100, min: 80, max: 120, endTick: 3 });
    const high = seedRuntime({ expected: 300, min: 240, max: 360, endTick: 3 });
    const s = combineBranchSummaries(
      [
        { weight: 0.25, rt: low },
        { weight: 0.75, rt: high },
      ],
      undefined,
      undefined,
      true,
    );
    // Weighted conditional min = 0.25*80 + 0.75*240 = 200
    expect(s.damage.expectedConditionalMin).toBe(200);
    // True support min = min(80, 240) = 80
    expect(s.damage.supportMinDamage).toBe(80);
    expect(s.damage.supportMaxDamage).toBe(360);
    expect(s.damage.expectedConditionalMin).not.toBe(s.damage.supportMinDamage);
    // Deprecated aliases track support, not the weighted conditional mean.
    expect(s.totalMin).toBe(s.damage.supportMinDamage);
    expect(s.totalMax).toBe(s.damage.supportMaxDamage);
  });

  it("2. support minimum and maximum survive branch merging correctly", () => {
    const a = seedRuntime({ expected: 100, min: 80, max: 120, endTick: 5 });
    const b = seedRuntime({ expected: 300, min: 240, max: 360, endTick: 5 });
    const merged = mergeBranches([
      { weight: 0.4, rt: a },
      { weight: 0.6, rt: b },
    ]);
    expect(merged).toHaveLength(1);
    const rt = merged[0]!.rt;
    expect(supportMinFrom(rt.totalMin, rt.analysis.supportMinOffset)).toBe(80);
    expect(supportMaxFrom(rt.totalMax, rt.analysis.supportMaxOffset)).toBe(360);

    // Second merge with a third leaf.
    const c = seedRuntime({ expected: 50, min: 40, max: 60, endTick: 5 });
    const again = mergeBranches([merged[0]!, { weight: 0.2, rt: c }]);
    const rt2 = again[0]!.rt;
    expect(supportMinFrom(rt2.totalMin, rt2.analysis.supportMinOffset)).toBe(40);
    expect(supportMaxFrom(rt2.totalMax, rt2.analysis.supportMaxOffset)).toBe(360);
  });

  it("3. expected ticks, support ticks, and representative ticks remain distinct", () => {
    const short = seedRuntime({ expected: 600, min: 600, max: 600, endTick: 10 });
    const long = seedRuntime({ expected: 1200, min: 1200, max: 1200, endTick: 30 });
    const s = combineBranchSummaries(
      [
        { weight: 0.25, rt: short },
        { weight: 0.75, rt: long },
      ],
      undefined,
      undefined,
      true,
    );
    expect(s.duration.expectedTicks).toBe(0.25 * 10 + 0.75 * 30);
    expect(s.duration.minimumTicks).toBe(10);
    expect(s.duration.maximumTicks).toBe(30);
    // Highest weight is the long branch.
    expect(s.duration.representativeTicks).toBe(30);
    expect(s.ticks).toBe(s.duration.expectedTicks);
    expect(s.duration.kind).toBe("stochastic");
  });

  it("4. fixed-window DPS remains exact", () => {
    const a = seedRuntime({ expected: 600, min: 500, max: 700, endTick: 8 });
    const b = seedRuntime({ expected: 900, min: 800, max: 1000, endTick: 12 });
    const s = combineBranchSummaries(
      [
        { weight: 0.5, rt: a },
        { weight: 0.5, rt: b },
      ],
      20,
      undefined,
      true,
    );
    expect(s.metric.type).toBe("fixed-window");
    expect(s.horizonTicks).toBe(20);
    expect(s.duration.fixedHorizonTicks).toBe(20);
    expect(s.totalExpected).toBe(750);
    expect(s.dps).toBeCloseTo(750 / (20 * TICK_SECONDS), 10);
    expect(s.dpsDetail.primary).toBe(s.dps);
    // Fixed-window does not expose expected-branch DPS as a separate natural quantity.
    expect(s.dpsDetail.expectedBranchDps).toBeUndefined();
  });

  it("5. ratio-of-expectations and expected branch DPS are independently testable", () => {
    const short = seedRuntime({ expected: 600, min: 600, max: 600, endTick: 10 });
    const long = seedRuntime({ expected: 1200, min: 1200, max: 1200, endTick: 30 });
    const s = combineBranchSummaries(
      [
        { weight: 0.5, rt: short },
        { weight: 0.5, rt: long },
      ],
      undefined,
      undefined,
      true,
    );
    const ratio = 900 / (20 * TICK_SECONDS);
    const branchMean = 0.5 * (600 / (10 * TICK_SECONDS)) + 0.5 * (1200 / (30 * TICK_SECONDS));
    expect(s.dpsDetail.ratioOfExpectations).toBeCloseTo(ratio, 10);
    expect(s.dpsDetail.expectedBranchDps).toBeCloseTo(branchMean, 10);
    expect(s.dpsDetail.ratioOfExpectations).not.toBeCloseTo(s.dpsDetail.expectedBranchDps!, 5);
    expect(s.dps).toBe(s.dpsDetail.primary);
    expect(s.dps).toBe(s.dpsDetail.ratioOfExpectations);
  });

  it("6. representative events can differ from weighted totals without corrupting analysis", () => {
    const low = seedRuntime({ expected: 100, min: 80, max: 120, endTick: 3 });
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
    const high = seedRuntime({ expected: 300, min: 240, max: 360, endTick: 3 });
    high.events.push({
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
      damage: { min: 240, max: 360, expected: 300 },
    });
    high.analysis.criticalContribution = 30;
    high.analysis.effects.get("attack")!.criticalContribution = 30;
    low.analysis.criticalContribution = 10;
    low.analysis.effects.get("attack")!.criticalContribution = 10;

    const s = combineBranchSummaries(
      [
        { weight: 0.25, rt: low },
        { weight: 0.75, rt: high },
      ],
      undefined,
      undefined,
      true,
    );
    expect(s.totalExpected).toBe(250);
    expect(s.analysis.criticalContribution).toBe(25);
    // Representative is high (0.75); its event expected is 300, not 250.
    expect(s.events[0]!.damage.expected).toBe(300);
    expect(s.events[0]!.damage.expected).not.toBe(s.totalExpected);
    expect(s.history.eventsReconcileWithWeightedTotals).toBe(false);
    expect(analysisReconciles(s.analysis, s.totalExpected)).toBe(true);
  });

  it("7. every stochastic result clearly labels representative history", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.history.kind).toBe("representative-terminal-class");
    expect(s.history.selectionReason).toBe("highest-probability-mass");
    expect(s.rng?.representative.historyKind).toBe("representative-terminal-class");
    expect(s.duration.kind).toBe("stochastic");
    // Intermediate merges mix ledgers while keeping one event log - never claim reconcile.
    expect(s.history.eventsReconcileWithWeightedTotals).toBe(false);
    expect(s.rng?.representative.eventsReconcileWithWeightedTotals).toBe(false);
  });

  it("7b. intermediate merges never claim event-log reconciliation", () => {
    // Two attacks with Impatient: 2pq classes merge when adrenaline realigns.
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng?.terminalClasses).toBe(3);
    expect(s.history.eventsReconcileWithWeightedTotals).toBe(false);
  });

  it("8. failed branch probability is visible", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault", "assault"),
    });
    expect(s.ok).toBe(false);
    expect(s.failure).toBeDefined();
    expect(s.failure!.failedWeight).toBeCloseTo(0.95, 10);
    expect(s.failure!.successfulWeight).toBeCloseTo(0.05, 10);
    expect(s.rng?.failedWeight).toBeCloseTo(s.failure!.failedWeight, 10);
    expect(s.failure!.primaryReason.length).toBeGreaterThan(0);
    // History matches success-conditional totals, not the heavier failed class.
    expect(s.history.selectionReason).toBe("highest-successful-mass");
    expect(s.history.classWeight).toBeCloseTo(0.05, 10);
    expect(s.duration.representativeTicks).toBeGreaterThanOrEqual(s.duration.minimumTicks);
    expect(s.duration.representativeTicks).toBeLessThanOrEqual(s.duration.maximumTicks);
    expect(s.totalExpected).toBeGreaterThan(0);
    expect(isNearOne(s.rng!.probabilityMass)).toBe(true);
  });

  it("9. all-failed branches return an honest failure", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(false);
    expect(s.failure?.totalsScope).toBe("none");
    expect(s.failure?.failedWeight).toBe(1);
    expect(s.failure?.successfulWeight).toBe(0);
    expect(s.totalExpected).toBe(0);
    expect(s.dps).toBe(0);
    expect(Number.isFinite(s.dps)).toBe(true);
    expect(s.error).toContain("overpower");
  });

  it("10. analysis source totals reconcile with total expected damage", () => {
    const low = seedRuntime({ expected: 100, min: 80, max: 120, endTick: 3 });
    const high = seedRuntime({ expected: 300, min: 240, max: 360, endTick: 3 });
    const s = combineBranchSummaries(
      [
        { weight: 0.25, rt: low },
        { weight: 0.75, rt: high },
      ],
      undefined,
      undefined,
      true,
    );
    const bySource = s.analysis.bySource.reduce((sum, row) => sum + row.damage, 0);
    expect(bySource).toBeCloseTo(s.totalExpected, 10);
    expect(analysisReconciles(s.analysis, s.totalExpected)).toBe(true);
  });

  it("11. direct plus DoT damage reconciles", () => {
    const rt = seedRuntime({ expected: 500, min: 400, max: 600, endTick: 10 });
    rt.analysis.directDamage = 300;
    rt.analysis.dotDamage = 200;
    rt.analysis.sources.set("ability-direct", 300);
    rt.analysis.sources.set("ability-dot", 200);
    rt.analysis.effects.set("attack", {
      id: "attack",
      kind: "ability-direct",
      totalDamage: 300,
      directDamage: 300,
      dotDamage: 0,
      criticalContribution: 0,
      capLoss: 0,
      casts: 1,
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      attachedComponents: 0,
      bonusDamage: 0,
    });
    rt.analysis.effects.set("bleed", {
      id: "bleed",
      kind: "ability-dot",
      totalDamage: 200,
      directDamage: 0,
      dotDamage: 200,
      criticalContribution: 0,
      capLoss: 0,
      casts: 1,
      triggerRolls: 0,
      expectedActivations: 4,
      expectedSeparateHits: 4,
      attachedComponents: 0,
      bonusDamage: 0,
    });
    const s = combineBranchSummaries([{ weight: 1, rt }], undefined, undefined, false);
    expect(s.analysis.directDamage + s.analysis.dotDamage).toBeCloseTo(s.totalExpected, 10);
    expect(analysisReconciles(s.analysis, s.totalExpected)).toBe(true);
  });

  it("12. tail metrics reconcile before and after horizon", () => {
    const ctx = createCastContext({
      ...baseInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
      startingAdrenaline: 100,
    });
    expect(ctx.performCast(ctx.byId.get("bloat")!, 0, false).ok).toBe(true);
    const summary = ctx.finish(undefined, 6, { includeTails: true });
    expect(summary.tails).toBeDefined();
    expect(summary.tails!.inWindowExpectedDamage).toBeCloseTo(summary.totalExpected, 10);
    expect(summary.tails!.totalIncludingTails).toBeCloseTo(
      summary.tails!.inWindowExpectedDamage + summary.tails!.postWindowTailDamage,
      10,
    );
    expect(summary.tails!.totalIncludingTails).toBeGreaterThan(summary.totalExpected);
    // Fixed-window DPS still uses in-window damage only.
    expect(summary.dps).toBeCloseTo(summary.totalExpected / (6 * TICK_SECONDS), 10);
    expect(summary.metric.tails).toBe("included-separately");
  });

  it("13. probability mass remains stable after repeated branch merges", () => {
    let branches = [
      { weight: 0.1, rt: seedRuntime({ expected: 10, min: 10, max: 10, endTick: 1 }) },
      { weight: 0.2, rt: seedRuntime({ expected: 20, min: 20, max: 20, endTick: 1 }) },
      { weight: 0.3, rt: seedRuntime({ expected: 30, min: 30, max: 30, endTick: 1 }) },
      { weight: 0.4, rt: seedRuntime({ expected: 40, min: 40, max: 40, endTick: 1 }) },
    ];
    // Force future-equivalence so all merge into one class.
    for (let i = 0; i < 3; i++) {
      branches = mergeBranches(branches);
    }
    expect(branches).toHaveLength(1);
    expect(isNearOne(branches[0]!.weight)).toBe(true);
    expect(Math.abs(branches[0]!.weight - 1)).toBeLessThanOrEqual(PROB_TOLERANCE);

    // Offsets still compose under repeated pairwise merges.
    const bounds = mergeSupportOffsets(10, 10, 0, 0, 40, 40, 0, 0, 0.5, 0.5);
    expect(bounds.totalMin + bounds.supportMinOffset).toBe(10);
    expect(bounds.totalMax + bounds.supportMaxOffset).toBe(40);
  });

  it("14. deterministic results retain simple exact semantics without noise", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack") });
    expect(s.ok).toBe(true);
    expect(s.rng).toBeUndefined();
    expect(s.failure).toBeUndefined();
    expect(s.history.kind).toBe("complete");
    expect(s.history.eventsReconcileWithWeightedTotals).toBe(true);
    expect(s.duration.kind).toBe("deterministic");
    expect(s.duration.expectedTicks).toBe(s.duration.minimumTicks);
    expect(s.duration.expectedTicks).toBe(s.duration.maximumTicks);
    expect(s.duration.expectedTicks).toBe(s.duration.representativeTicks);
    expect(s.damage.expectedDamage).toBe(s.totalExpected);
    expect(s.damage.supportMinDamage).toBe(s.totalMin);
    expect(s.damage.supportMaxDamage).toBe(s.totalMax);
    expect(s.damage.expectedConditionalMin).toBe(s.damage.supportMinDamage);
    expect(s.damage.expectedConditionalMax).toBe(s.damage.supportMaxDamage);
    expect(s.dpsDetail.expectedBranchDps).toBeUndefined();
    expect(s.dpsDetail.primary).toBe(s.dps);
    expect(Number.isInteger(s.ticks)).toBe(true);
  });
});

describe("stochastic summary — failed-mass totals policy", () => {
  it("renormalizes successful-only damage when some branches fail", () => {
    const okRt = seedRuntime({ expected: 1000, min: 900, max: 1100, endTick: 12 });
    okRt.events.push({
      tick: 0,
      seq: 0,
      family: "hit",
      abilityId: "success-path",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      damage: { min: 900, max: 1100, expected: 1000 },
    });
    const failRt = seedRuntime({ expected: 100, min: 90, max: 110, endTick: 6 });
    failRt.events.push({
      tick: 0,
      seq: 0,
      family: "hit",
      abilityId: "fail-path",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      damage: { min: 90, max: 110, expected: 100 },
    });
    // finish() with error marks the branch failed.
    const s = combineBranchSummaries(
      [
        { weight: 0.2, rt: okRt },
        { weight: 0.8, rt: failRt, error: "unpayable assault" },
      ],
      undefined,
      undefined,
      true,
    );
    expect(s.ok).toBe(false);
    expect(s.failure?.totalsScope).toBe("successful-branches-renormalized");
    // Successful-only: 1000, not 0.2*1000 + 0.8*100 = 280.
    expect(s.totalExpected).toBe(1000);
    expect(s.failure?.failedWeight).toBeCloseTo(0.8, 10);
    expect(s.failure?.successfulWeight).toBeCloseTo(0.2, 10);
    // Representative prefers successful class so history matches totals scope.
    expect(s.events[0]?.abilityId).toBe("success-path");
    expect(s.duration.representativeTicks).toBe(12);
    expect(s.history.selectionReason).toBe("highest-successful-mass");
    expect(s.history.classWeight).toBeCloseTo(0.2, 10);
    expect(s.duration.representativeTicks).toBeGreaterThanOrEqual(s.duration.minimumTicks);
    expect(s.duration.representativeTicks).toBeLessThanOrEqual(s.duration.maximumTicks);
  });

  it("does not invent NaN when every branch fails", () => {
    const a = seedRuntime({ expected: 10, min: 10, max: 10, endTick: 1 });
    const b = seedRuntime({ expected: 20, min: 20, max: 20, endTick: 2 });
    const s = combineBranchSummaries(
      [
        { weight: 0.4, rt: a, error: "fail-a" },
        { weight: 0.6, rt: b, error: "fail-b" },
      ],
      undefined,
      undefined,
      true,
    );
    expect(s.ok).toBe(false);
    expect(s.totalExpected).toBe(0);
    expect(Number.isFinite(s.dps)).toBe(true);
    expect(s.failure?.totalsScope).toBe("none");
    expect(s.failure?.primaryReason).toBe("fail-b"); // highest weight
    // Totals stay zero; duration support still describes the failed history pool.
    expect(s.duration.expectedTicks).toBe(0);
    expect(s.duration.minimumTicks).toBe(1);
    expect(s.duration.maximumTicks).toBe(2);
    expect(s.duration.representativeTicks).toBe(2);
    expect(s.duration.representativeTicks).toBeGreaterThanOrEqual(s.duration.minimumTicks);
    expect(s.duration.representativeTicks).toBeLessThanOrEqual(s.duration.maximumTicks);
    expect(s.history.ticks).toBe(s.duration.representativeTicks);
  });

  it("sole-path failure does not claim event-ledger reconciliation", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(false);
    expect(s.history.eventsReconcileWithWeightedTotals).toBe(false);
  });
});
