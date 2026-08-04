import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { LENG_BOUNDLESS_CHILL_CHANCE, LENG_ENDLESS_FROST_CHANCE } from "../../styles/melee/effects";
import { prepareCast } from "../cast/prepare";
import { scheduleCastEvents } from "../cast/schedule";
import { createRuntime } from "../runtime/runtime";
import { patchMelee } from "../runtime/state";
import { baseInput } from "../../test/fixtures/inputs";
import {
  enableBranchProfiling,
  getBranchProfile,
  mergeBranches,
  resetBranchProfile,
  snapshotRuntime,
} from "./branch";
import { simulateRevolution } from "./revolution";
import { combineBranchSummaries } from "./summary";
import { advanceToBranches, drainBranchToEnd, expandLengOnLand } from "./lengLandBranch";
import { isNearOne, PROB_TOLERANCE } from "./stats";

const ONE_LAND_STACK_EV = LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE; // 0.12

function lengRuntime(detailLevel?: "score-only" | "full-analysis") {
  const effects = activeEquipmentEffects({
    style: "melee",
    equipmentSlots: {
      mainhand: "item:dark-shard-of-leng",
      offhand: "item:dark-sliver-of-leng",
    },
  });
  return createRuntime({
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects: effects,
    weaponConfiguration: "dualwield",
    ...(detailLevel != null ? { detailLevel } : {}),
  });
}

function unitMass(stacks: number): number[] {
  const a = Array(11).fill(0);
  a[stacks] = 1;
  return a;
}

function stackEV(rt: { state: { melee: { primordialIce: { stackMass: readonly number[] } } } }) {
  return rt.state.melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
}

function frostOpenMass(rt: {
  state: { melee: { frostbladesOpenMass: number; frostbladesUntilTick: number } };
}) {
  return rt.state.melee.frostbladesUntilTick > 0
    ? (rt.state.melee.frostbladesOpenMass ?? 1)
    : 0;
}

/**
 * Schedule two basic attack hits without landing (banked residual queue).
 * Uses prepareCast (no advance) so the first hit stays queued.
 */
function scheduleTwoAttacksPending() {
  const rt = lengRuntime();
  const attack = rt.byId.get("attack")!;
  scheduleCastEvents(rt, prepareCast(rt, attack, 0), false);
  scheduleCastEvents(rt, prepareCast(rt, attack, 3), false);
  expect(rt.queue.length).toBe(2);
  return rt;
}

/** Schedule full assault channel without landing (multi-hit Leng land spine). */
function scheduleAssaultPending() {
  const rt = lengRuntime();
  const assault = rt.byId.get("assault")!;
  scheduleCastEvents(rt, prepareCast(rt, assault, 0), false);
  expect(rt.queue.length).toBeGreaterThan(2);
  return rt;
}

function weightedExpected(branches: readonly { weight: number; rt: { totalExpected: number } }[]) {
  return branches.reduce((s, b) => s + b.weight * b.rt.totalExpected, 0);
}

function weightedStacks(
  branches: readonly {
    weight: number;
    rt: { state: { melee: { primordialIce: { stackMass: readonly number[] } } } };
  }[],
) {
  const mass = branches.reduce((s, b) => s + b.weight, 0);
  if (mass <= 0) return 0;
  return branches.reduce((s, b) => s + b.weight * stackEV(b.rt), 0) / mass;
}

describe("failed-branch Leng residual drain", () => {
  it("expandLengOnLand preserves error and still applies stack outcomes", () => {
    const rt = lengRuntime();
    const set = expandLengOnLand({ weight: 1, rt, error: "unpayable assault" }, 0);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("exact");
    expect(set.branches[0]!.error).toBe("unpayable assault");
    expect(stackEV(set.branches[0]!.rt)).toBeCloseTo(ONE_LAND_STACK_EV, 10);
    expect(frostOpenMass(set.branches[0]!.rt)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
  });

  it("drainBranchToEnd lands failed pending queue on one spine; never clears error", () => {
    const rt = scheduleTwoAttacksPending();
    const pendingHits = rt.queue.length;
    const set = drainBranchToEnd({ weight: 1, rt, error: "unpayable overpower" });
    expect(set.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(set.branches).toHaveLength(1);
    expect(set.branches[0]!.error).toBe("unpayable overpower");
    expect(set.branches[0]!.rt.queue.length).toBe(0);
    expect(isNearOne(set.branches.reduce((s, b) => s + b.weight, 0) + set.residualWeight)).toBe(
      true,
    );
    // Two Leng lands on compact mass: E[stacks] above a single land EV.
    expect(weightedStacks(set.branches)).toBeGreaterThan(ONE_LAND_STACK_EV + 1e-6);
    expect(pendingHits).toBe(2);
  });

  it("failed residual E[D] matches success drain for the same banked hits", () => {
    const base = scheduleTwoAttacksPending();
    const okRt = snapshotRuntime(base);
    const failRt = snapshotRuntime(base);
    const ok = drainBranchToEnd({ weight: 1, rt: okRt });
    const fail = drainBranchToEnd({ weight: 1, rt: failRt, error: "unpayable assault" });
    expect(ok.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(fail.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(ok.branches.every((b) => b.error === undefined)).toBe(true);
    expect(fail.branches.every((b) => b.error === "unpayable assault")).toBe(true);
    expect(weightedExpected(fail.branches)).toBeCloseTo(weightedExpected(ok.branches), 8);
    expect(weightedStacks(fail.branches)).toBeCloseTo(weightedStacks(ok.branches), 8);
  });

  it("advanceToBranches on failed branch lands due events without inventing success", () => {
    const rt = scheduleTwoAttacksPending();
    const maxTick = rt.queue.maxTick();
    const set = advanceToBranches({ weight: 1, rt, error: "fail mid rotation" }, maxTick);
    expect(set.branches.every((b) => b.error === "fail mid rotation")).toBe(true);
    expect(set.branches.every((b) => b.rt.queue.length === 0)).toBe(true);
    expect(weightedExpected(set.branches)).toBeGreaterThan(0);
  });

  it("combineBranchSummaries keeps failed mass failed after Leng residual drain", () => {
    const base = scheduleTwoAttacksPending();
    const okRt = snapshotRuntime(base);
    const failRt = snapshotRuntime(base);
    const s = combineBranchSummaries(
      [
        { weight: 0.25, rt: okRt },
        { weight: 0.75, rt: failRt, error: "unpayable assault" },
      ],
      undefined,
      undefined,
      true,
    );
    expect(s.ok).toBe(false);
    expect(s.failure?.failedWeight).toBeCloseTo(0.75, 10);
    expect(s.failure?.successfulWeight).toBeCloseTo(0.25, 10);
    expect((s.failure?.successfulWeight ?? 0) + (s.failure?.failedWeight ?? 0)).toBeCloseTo(1, 10);
    expect(s.totalExpected).toBeGreaterThan(0);
    expect(s.failure?.totalsScope).toBe("unconditional-all-mass");
    expect(s.failure?.failedPathExpectedDamage).toBeDefined();
    expect(s.failure!.failedPathExpectedDamage!).toBeCloseTo(
      s.failure!.conditionalOnSuccessExpectedDamage!,
      6,
    );
    expect(s.rng?.residualWeight ?? 0).toBeLessThanOrEqual(PROB_TOLERANCE);
  });

  it("failed branch with empty queue still stays failed and does not invent damage", () => {
    const rt = lengRuntime();
    const set = drainBranchToEnd({ weight: 1, rt, error: "cannot cast" });
    expect(set.branches).toHaveLength(1);
    expect(set.branches[0]!.error).toBe("cannot cast");
    expect(set.branches[0]!.rt.totalExpected).toBe(0);
  });

  it("failed multi-hit residual does not resurrect any arm to success", () => {
    const rt = lengRuntime();
    const assault = rt.byId.get("assault")!;
    scheduleCastEvents(rt, prepareCast(rt, assault, 0), false);
    expect(rt.queue.length).toBeGreaterThan(2);
    const set = drainBranchToEnd({ weight: 1, rt, error: "unpayable overpower" });
    expect(set.branches).toHaveLength(1);
    expect(set.branches[0]!.error).toBe("unpayable overpower");
    expect(set.branches[0]!.rt.queue.length).toBe(0);
    const mass = set.branches.reduce((s, b) => s + b.weight, 0) + set.residualWeight;
    expect(isNearOne(mass)).toBe(true);
    expect(weightedExpected(set.branches)).toBeGreaterThan(0);
  });
});

describe("Leng compact mass spine (no multi-arm fork)", () => {
  it("multi-hit assault stays on one spine; residual 0; mass conserved", () => {
    const rt = scheduleAssaultPending();
    const maxTick = rt.queue.maxTick();
    const set = advanceToBranches({ weight: 1, rt }, maxTick, 4, 4);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(["exact", "merged-exactly"]).toContain(set.exactness);
    expect(set.branches[0]!.rt.queue.length).toBe(0);
    expect(stackEV(set.branches[0]!.rt)).toBeGreaterThan(ONE_LAND_STACK_EV);
  });

  it("default caps: multi-hit assault conserves unit mass with residual 0", () => {
    const rt = scheduleAssaultPending();
    const set = drainBranchToEnd({ weight: 1, rt });
    const concrete = set.branches.reduce((s, b) => s + b.weight, 0);
    expect(concrete + set.residualWeight).toBeCloseTo(1, 10);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
  });

  it("one land: E[stacks]≈0.12 and frostOpenMass≈0.02", () => {
    const rt = lengRuntime();
    const attack = rt.byId.get("attack")!;
    scheduleCastEvents(rt, prepareCast(rt, attack, 0), false);
    const set = advanceToBranches({ weight: 1, rt }, rt.queue.maxTick());
    expect(set.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(set.branches).toHaveLength(1);
    expect(stackEV(set.branches[0]!.rt)).toBeCloseTo(ONE_LAND_STACK_EV, 10);
    expect(frostOpenMass(set.branches[0]!.rt)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
  });

  it("soft intermediate budget: mass conserved; same EV on one spine", () => {
    const a = scheduleTwoAttacksPending();
    const b = snapshotRuntime(a);
    const wide = advanceToBranches({ weight: 1, rt: a }, a.queue.maxTick(), 64, 128);
    const tight = advanceToBranches({ weight: 1, rt: b }, b.queue.maxTick(), 64, 64);
    expect(wide.branches).toHaveLength(1);
    expect(tight.branches).toHaveLength(1);
    expect(wide.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(tight.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(weightedStacks(wide.branches)).toBeCloseTo(weightedStacks(tight.branches), 8);
    expect(weightedExpected(wide.branches)).toBeCloseTo(weightedExpected(tight.branches), 6);
  });
});

describe("Leng future-state compact expand", () => {
  it("expand is state-only: totalExpected unchanged; single branch", () => {
    const rt = lengRuntime();
    rt.totalExpected = 12345.5;
    rt.totalMin = 10000;
    rt.totalMax = 15000;
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("exact");
    expect(set.branches).toHaveLength(1);
    expect(set.branches[0]!.rt.totalExpected).toBe(12345.5);
    expect(set.branches[0]!.rt.totalMin).toBe(10000);
    expect(set.branches[0]!.rt.totalMax).toBe(15000);
    expect(set.branches[0]!.weight).toBe(1);
  });

  it("after one dual land from 0: E[stacks]≈0.12, frostOpenMass≈0.02", () => {
    const rt = lengRuntime();
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("exact");
    expect(stackEV(set.branches[0]!.rt)).toBeCloseTo(ONE_LAND_STACK_EV, 10);
    expect(frostOpenMass(set.branches[0]!.rt)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
    expect(set.branches[0]!.rt.state.melee.frostbladesUntilTick).toBeGreaterThan(0);
  });

  it("at stack cap 10: stacks stay 10, frostOpenMass≈0.02", () => {
    const rt = lengRuntime();
    rt.state = patchMelee(rt.state, {
      primordialIce: { stackMass: unitMass(10), expiresAtTick: 0 },
    });
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.residualWeight).toBe(0);
    expect(set.branches).toHaveLength(1);
    expect(stackEV(set.branches[0]!.rt)).toBe(10);
    expect(frostOpenMass(set.branches[0]!.rt)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
    expect(set.branches[0]!.weight).toBeCloseTo(1, 12);
  });

  it("EF-only shard at cap: single branch, no frost open mass", () => {
    const effects = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { mainhand: "item:dark-shard-of-leng" },
    });
    const single = createRuntime({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      equipmentIds: ["item:dark-shard-of-leng"],
      equipmentEffects: effects,
      weaponConfiguration: "dualwield",
    });
    single.state = patchMelee(single.state, {
      primordialIce: { stackMass: unitMass(10), expiresAtTick: 0 },
    });
    const set = expandLengOnLand({ weight: 1, rt: single }, 0);
    expect(set.residualWeight).toBe(0);
    expect(set.branches).toHaveLength(1);
    expect(stackEV(set.branches[0]!.rt)).toBe(10);
    expect(frostOpenMass(set.branches[0]!.rt)).toBe(0);
  });

  it("stack mass is a proper distribution after dual land from 0", () => {
    const rt = lengRuntime();
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    const mass = set.branches[0]!.rt.state.melee.primordialIce.stackMass;
    expect(mass).toHaveLength(11);
    expect(mass.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 12);
    // P(0)=0.9*0.98, P(1)=0.1*0.98+0.9*0.02, P(2)=0.1*0.02
    expect(mass[0]).toBeCloseTo(0.9 * 0.98, 12);
    expect(mass[1]).toBeCloseTo(0.1 * 0.98 + 0.9 * 0.02, 12);
    expect(mass[2]).toBeCloseTo(0.1 * 0.02, 12);
  });

  it("expired frost input normalizes so classes match frost=0", () => {
    const rt = lengRuntime();
    rt.state = patchMelee(rt.state, { frostbladesUntilTick: 3, frostbladesOpenMass: 0.5 });
    const set = expandLengOnLand({ weight: 1, rt }, 20);
    expect(set.residualWeight).toBe(0);
    expect(set.branches).toHaveLength(1);
    // Prior window expired at land tick 20; chill re-opens a fresh window.
    const f = set.branches[0]!.rt.state.melee.frostbladesUntilTick;
    expect(f === 0 || f > 20).toBe(true);
    const rt2 = lengRuntime();
    const set2 = expandLengOnLand({ weight: 1, rt: rt2 }, 20);
    expect(set.branches.length).toBe(set2.branches.length);
    expect(weightedStacks(set.branches)).toBeCloseTo(weightedStacks(set2.branches), 10);
    expect(frostOpenMass(set.branches[0]!.rt)).toBeCloseTo(
      frostOpenMass(set2.branches[0]!.rt),
      10,
    );
  });

  it("completeAdvance zeros expired frost so post-window survivors normalize", () => {
    const a = scheduleTwoAttacksPending();
    a.state = patchMelee(a.state, {
      frostbladesUntilTick: 1,
      frostbladesOpenMass: 0.4,
    });
    const set = advanceToBranches({ weight: 1, rt: a }, a.queue.maxTick());
    expect(set.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    for (const b of set.branches) {
      const frost = b.rt.state.melee.frostbladesUntilTick;
      if (frost > 0) {
        expect(frost).toBeGreaterThan(b.rt.state.tick);
      } else {
        expect(b.rt.state.melee.frostbladesOpenMass).toBe(0);
      }
    }
  });
});

describe("Leng frost expiry exact merge", () => {
  it("expired frost timestamps merge with frost=0 at same stacks (branchKey)", () => {
    const base = lengRuntime();
    base.state = patchMelee(base.state, {
      primordialIce: { stackMass: unitMass(5), expiresAtTick: 0 },
    });
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 20 };
    a.state = patchMelee(a.state, { frostbladesUntilTick: 10, frostbladesOpenMass: 0 });
    b.state = { ...b.state, tick: 20 };
    b.state = patchMelee(b.state, { frostbladesUntilTick: 0, frostbladesOpenMass: 0 });
    const merged = mergeBranches([
      { weight: 0.4, rt: a },
      { weight: 0.6, rt: b },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.weight).toBeCloseTo(1, 12);
  });

  it("active frost still splits from frost=0 at same stacks", () => {
    const base = lengRuntime();
    base.state = patchMelee(base.state, {
      primordialIce: { stackMass: unitMass(5), expiresAtTick: 0 },
    });
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 5 };
    a.state = patchMelee(a.state, { frostbladesUntilTick: 20, frostbladesOpenMass: 0.3 });
    b.state = { ...b.state, tick: 5 };
    b.state = patchMelee(b.state, { frostbladesUntilTick: 0, frostbladesOpenMass: 0 });
    const merged = mergeBranches([
      { weight: 0.5, rt: a },
      { weight: 0.5, rt: b },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("advanceToBranches zeros expired frost open-mass on the spine", () => {
    const rt = lengRuntime();
    rt.state = patchMelee(rt.state, {
      primordialIce: { stackMass: unitMass(10), expiresAtTick: 0 },
    });
    const expanded = expandLengOnLand({ weight: 1, rt }, 0);
    expect(expanded.branches).toHaveLength(1);
    const arm = expanded.branches[0]!;
    expect(arm.rt.state.melee.frostbladesUntilTick).toBeGreaterThan(0);
    expect(frostOpenMass(arm.rt)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
    const past = arm.rt.state.melee.frostbladesUntilTick + 1;
    const advanced = advanceToBranches({ weight: arm.weight, rt: arm.rt }, past);
    expect(advanced.branches).toHaveLength(1);
    expect(advanced.branches[0]!.rt.state.melee.frostbladesUntilTick).toBe(0);
    expect(advanced.branches[0]!.rt.state.melee.frostbladesOpenMass).toBe(0);
    expect(stackEV(advanced.branches[0]!.rt)).toBe(10);
  });

  it("historical unreferenced hitDetails do not block reconvergence merge", () => {
    const base = lengRuntime();
    base.state = patchMelee(base.state, {
      primordialIce: { stackMass: unitMass(4), expiresAtTick: 0 },
    });
    base.state = { ...base.state, tick: 30 };
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.hitDetails.set(1, {
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
    });
    b.hitDetails.set(1, {
      potential: 1000,
      min: 110,
      max: 220,
      critMin: 160,
      critMax: 320,
      critChance: 0.1,
      nonCritExpected: 165,
      critExpected: 240,
      expected: 172.5,
      uncappedExpected: 172.5,
      capLoss: 0,
    });
    const merged = mergeBranches([
      { weight: 0.3, rt: a },
      { weight: 0.7, rt: b },
    ]);
    expect(merged).toHaveLength(1);
  });
});

describe("Leng expand: score-only and full-analysis share compact mass", () => {
  it("expandLengOnLand is single-branch mass with residual 0 and exact", () => {
    const rt = lengRuntime("score-only");
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("exact");
    expect(stackEV(set.branches[0]!.rt)).toBeCloseTo(ONE_LAND_STACK_EV, 10);
    expect(frostOpenMass(set.branches[0]!.rt)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
    expect(set.branches[0]!.weight).toBe(1);
  });

  it("expand does not call snapshotRuntime (zero Leng snaps)", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    const rt = lengRuntime();
    expandLengOnLand({ weight: 1, rt }, 0);
    expect(getBranchProfile().branchSnapshots).toBe(0);
    enableBranchProfiling(false);
  });

  it("score-only dual-Leng revo: maxLiveBranches <= 1 and snaps ~0", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    const effects = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: {
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    });
    const bar = ["assault", "sever", "fury", "dismember"]
      .map((id) => MELEE_ABILITIES.find((a) => a.id === id)!)
      .filter(Boolean);
    const summary = simulateRevolution(
      {
        ...baseInput,
        abilities: MELEE_ABILITIES,
        bar,
        style: "melee",
        durationTicks: 50,
        equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
        equipmentEffects: effects,
        weaponConfiguration: "dualwield",
        startingAdrenaline: 100,
      },
      { detailLevel: "score-only" },
    );
    const prof = getBranchProfile();
    enableBranchProfiling(false);
    expect(summary.ok).toBe(true);
    expect(summary.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
    expect(prof.branchSnapshots).toBe(0);
    expect(prof.maxLiveBranches).toBeLessThanOrEqual(1);
  });

  it("multi-land EV accumulates on one spine", () => {
    const rt = lengRuntime();
    const attack = rt.byId.get("attack")!;
    scheduleCastEvents(rt, prepareCast(rt, attack, 0), false);
    scheduleCastEvents(rt, prepareCast(rt, attack, 3), false);
    const set = advanceToBranches({ weight: 1, rt }, rt.queue.maxTick());
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(["exact", "merged-exactly"]).toContain(set.exactness);
    // Two independent dual-Leng lands from zero: E accumulates (not exactly 2*0.12 under
    // distribution convolution near cap, but far from cap so ≈ 0.24).
    expect(stackEV(set.branches[0]!.rt)).toBeCloseTo(2 * ONE_LAND_STACK_EV, 8);
  });

  it("score-only and full-analysis expand match on mass + frostOpenMass", () => {
    const full = expandLengOnLand({ weight: 1, rt: lengRuntime("full-analysis") }, 0);
    const score = expandLengOnLand({ weight: 1, rt: lengRuntime("score-only") }, 0);
    expect(full.branches).toHaveLength(1);
    expect(score.branches).toHaveLength(1);
    expect(full.exactness).toBe("exact");
    expect(score.exactness).toBe("exact");
    expect(stackEV(full.branches[0]!.rt)).toBeCloseTo(stackEV(score.branches[0]!.rt), 12);
    expect(frostOpenMass(full.branches[0]!.rt)).toBeCloseTo(
      frostOpenMass(score.branches[0]!.rt),
      12,
    );
    const fullMass = full.branches[0]!.rt.state.melee.primordialIce.stackMass;
    const scoreMass = score.branches[0]!.rt.state.melee.primordialIce.stackMass;
    for (let i = 0; i < 11; i++) {
      expect(fullMass[i]).toBeCloseTo(scoreMass[i]!, 12);
    }
  });
});
