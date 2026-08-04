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

function lengRuntime() {
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
  });
}

/**
 * Schedule two basic attack hits without landing (banked residual queue).
 * Uses prepareCast (no advance) so the first hit stays queued.
 * Two lands keep under MAX_LIVE_BRANCHES so residual stays 0.
 */
function scheduleTwoAttacksPending() {
  const rt = lengRuntime();
  const attack = rt.byId.get("attack")!;
  scheduleCastEvents(rt, prepareCast(rt, attack, 0), false);
  scheduleCastEvents(rt, prepareCast(rt, attack, 3), false);
  expect(rt.queue.length).toBe(2);
  return rt;
}

/** Schedule full assault channel without landing (multi-hit Leng fan-out). */
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
  branches: readonly { weight: number; rt: { state: { melee: { primordialIceStacks: number } } } }[],
) {
  const mass = branches.reduce((s, b) => s + b.weight, 0);
  if (mass <= 0) return 0;
  return (
    branches.reduce((s, b) => s + b.weight * b.rt.state.melee.primordialIceStacks, 0) / mass
  );
}

describe("failed-branch Leng residual drain", () => {
  it("expandLengOnLand preserves error and still applies stack outcomes", () => {
    const rt = lengRuntime();
    const set = expandLengOnLand({ weight: 1, rt, error: "unpayable assault" }, 0);
    expect(set.residualWeight).toBe(0);
    expect(isNearOne(set.branches.reduce((s, b) => s + b.weight, 0))).toBe(true);
    expect(set.branches.every((b) => b.error === "unpayable assault")).toBe(true);
    expect(weightedStacks(set.branches)).toBeCloseTo(
      LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE,
      10,
    );
  });

  it("drainBranchToEnd lands failed pending queue with Leng forks; never clears error", () => {
    const rt = scheduleTwoAttacksPending();
    const pendingHits = rt.queue.length;
    const set = drainBranchToEnd({ weight: 1, rt, error: "unpayable overpower" });
    expect(set.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(set.branches.length).toBeGreaterThan(1);
    expect(set.branches.every((b) => b.error === "unpayable overpower")).toBe(true);
    expect(set.branches.every((b) => b.rt.queue.length === 0)).toBe(true);
    expect(isNearOne(set.branches.reduce((s, b) => s + b.weight, 0) + set.residualWeight)).toBe(
      true,
    );
    // Two Leng lands: E[stacks] above a single land EV (under cap, no residual).
    expect(weightedStacks(set.branches)).toBeGreaterThan(
      LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE + 1e-6,
    );
    expect(pendingHits).toBe(2);
  });

  it("failed residual E[D] matches success drain for the same banked queue", () => {
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
    // Unconditional primary uses failed banked damage (not success-renormalized).
    expect(s.failure?.totalsScope).toBe("unconditional-all-mass");
    expect(s.failure?.failedPathExpectedDamage).toBeDefined();
    // Same banked queue on both arms => failed-path E[D] matches success-conditional.
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
    expect(set.branches.length).toBeGreaterThan(0);
    expect(set.branches.every((b) => b.error === "unpayable overpower")).toBe(true);
    expect(set.branches.every((b) => b.rt.queue.length === 0)).toBe(true);
    const mass = set.branches.reduce((s, b) => s + b.weight, 0) + set.residualWeight;
    expect(isNearOne(mass)).toBe(true);
    expect(weightedExpected(set.branches)).toBeGreaterThan(0);
  });
});

describe("Leng fan-out intermediate bound", () => {
  it("tight maxLive discloses residual and conserves mass", () => {
    const rt = scheduleAssaultPending();
    const maxTick = rt.queue.maxTick();
    // maxLive=4 intermediate=4 forces hard-cap on multi-hit 3-arm expands.
    const set = advanceToBranches({ weight: 1, rt }, maxTick, 4, 4);
    expect(set.branches.length).toBeLessThanOrEqual(4);
    const concrete = set.branches.reduce((s, b) => s + b.weight, 0);
    expect(concrete + set.residualWeight).toBeCloseTo(1, 10);
    if (set.residualWeight > PROB_TOLERANCE) {
      expect(set.exactness).toBe("bounded-approximation");
    }
    expect(set.branches.every((b) => b.rt.queue.length === 0)).toBe(true);
  });

  it("default caps: multi-hit assault conserves unit mass with residual disclosed", () => {
    const rt = scheduleAssaultPending();
    const set = drainBranchToEnd({ weight: 1, rt });
    const concrete = set.branches.reduce((s, b) => s + b.weight, 0);
    expect(concrete + set.residualWeight).toBeCloseTo(1, 10);
    expect(set.branches.length).toBeLessThanOrEqual(64);
    expect(set.residualWeight).toBeGreaterThanOrEqual(0);
  });

  it("residual=0 path: E[stacks] matches exhaustive oracle on one land", () => {
    const rt = lengRuntime();
    const attack = rt.byId.get("attack")!;
    scheduleCastEvents(rt, prepareCast(rt, attack, 0), false);
    const set = advanceToBranches({ weight: 1, rt }, rt.queue.maxTick());
    expect(set.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(isNearOne(set.branches.reduce((s, b) => s + b.weight, 0))).toBe(true);
    expect(weightedStacks(set.branches)).toBeCloseTo(
      LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE,
      10,
    );
  });

  it("soft intermediate=maxLive vs wider soft budget: mass conserved; EV match when residual 0", () => {
    const a = scheduleTwoAttacksPending();
    const b = snapshotRuntime(a);
    const wide = advanceToBranches({ weight: 1, rt: a }, a.queue.maxTick(), 64, 128);
    const tight = advanceToBranches({ weight: 1, rt: b }, b.queue.maxTick(), 64, 64);
    expect(
      wide.branches.reduce((s, x) => s + x.weight, 0) + wide.residualWeight,
    ).toBeCloseTo(1, 10);
    expect(
      tight.branches.reduce((s, x) => s + x.weight, 0) + tight.residualWeight,
    ).toBeCloseTo(1, 10);
    expect(wide.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(tight.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(weightedStacks(wide.branches)).toBeCloseTo(weightedStacks(tight.branches), 8);
    expect(weightedExpected(wide.branches)).toBeCloseTo(weightedExpected(tight.branches), 6);
  });
});

describe("Leng future-state partial fold", () => {
  it("expand is state-only: totalExpected unchanged across forks", () => {
    const rt = lengRuntime();
    rt.totalExpected = 12345.5;
    rt.totalMin = 10000;
    rt.totalMax = 15000;
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.residualWeight).toBe(0);
    expect(set.branches.length).toBeGreaterThan(1);
    for (const b of set.branches) {
      expect(b.rt.totalExpected).toBe(12345.5);
      expect(b.rt.totalMin).toBe(10000);
      expect(b.rt.totalMax).toBe(15000);
    }
    expect(isNearOne(set.branches.reduce((s, b) => s + b.weight, 0))).toBe(true);
  });

  it("identical future state collapses to one branch (EF-only at cap)", () => {
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
    single.state = patchMelee(single.state, { primordialIceStacks: 10 });
    const set = expandLengOnLand({ weight: 1, rt: single }, 0);
    expect(set.residualWeight).toBe(0);
    expect(set.branches).toHaveLength(1);
    expect(set.branches[0]!.rt.state.melee.primordialIceStacks).toBe(10);
    expect(set.branches[0]!.weight).toBeCloseTo(1, 12);
  });

  it("divergent stacks force fork; residual stays 0 (no reassignment)", () => {
    const rt = lengRuntime();
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("exact");
    const stackClasses = new Set(set.branches.map((b) => b.rt.state.melee.primordialIceStacks));
    expect(stackClasses.size).toBeGreaterThan(1);
    expect(isNearOne(set.branches.reduce((s, b) => s + b.weight, 0))).toBe(true);
  });

  it("divergent frost forces fork even at stack cap", () => {
    const rt = lengRuntime();
    rt.state = patchMelee(rt.state, { primordialIceStacks: 10 });
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.residualWeight).toBe(0);
    expect(set.branches).toHaveLength(2);
    const frostOpen = set.branches.filter((b) => b.rt.state.melee.frostbladesUntilTick > 0);
    const frostClosed = set.branches.filter((b) => b.rt.state.melee.frostbladesUntilTick === 0);
    expect(frostOpen).toHaveLength(1);
    expect(frostClosed).toHaveLength(1);
    expect(frostOpen[0]!.weight).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 12);
  });

  it("expired frost input normalizes so classes match frost=0", () => {
    const rt = lengRuntime();
    rt.state = patchMelee(rt.state, { frostbladesUntilTick: 3 });
    const set = expandLengOnLand({ weight: 1, rt }, 20);
    expect(set.residualWeight).toBe(0);
    for (const b of set.branches) {
      const f = b.rt.state.melee.frostbladesUntilTick;
      expect(f === 0 || f > 20).toBe(true);
    }
    const rt2 = lengRuntime();
    const set2 = expandLengOnLand({ weight: 1, rt: rt2 }, 20);
    expect(set.branches.length).toBe(set2.branches.length);
    expect(weightedStacks(set.branches)).toBeCloseTo(weightedStacks(set2.branches), 10);
  });

  it("completeAdvance zeros expired frost so post-window survivors normalize", () => {
    const a = scheduleTwoAttacksPending();
    a.state = patchMelee(a.state, { frostbladesUntilTick: 1 });
    const set = advanceToBranches({ weight: 1, rt: a }, a.queue.maxTick());
    expect(set.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    for (const b of set.branches) {
      const frost = b.rt.state.melee.frostbladesUntilTick;
      if (frost > 0) {
        expect(frost).toBeGreaterThan(b.rt.state.tick);
      }
    }
  });
});


describe("Leng frost expiry exact merge", () => {
  it("expired frost timestamps merge with frost=0 at same stacks (branchKey)", () => {
    const base = lengRuntime();
    base.state = patchMelee(base.state, { primordialIceStacks: 5 });
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 20 };
    a.state = patchMelee(a.state, { frostbladesUntilTick: 10 });
    b.state = { ...b.state, tick: 20 };
    b.state = patchMelee(b.state, { frostbladesUntilTick: 0 });
    const merged = mergeBranches([
      { weight: 0.4, rt: a },
      { weight: 0.6, rt: b },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.weight).toBeCloseTo(1, 12);
  });

  it("active frost still splits from frost=0 at same stacks", () => {
    const base = lengRuntime();
    base.state = patchMelee(base.state, { primordialIceStacks: 5 });
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 5 };
    a.state = patchMelee(a.state, { frostbladesUntilTick: 20 });
    b.state = { ...b.state, tick: 5 };
    b.state = patchMelee(b.state, { frostbladesUntilTick: 0 });
    const merged = mergeBranches([
      { weight: 0.5, rt: a },
      { weight: 0.5, rt: b },
    ]);
    expect(merged).toHaveLength(2);
  });

  it("advanceToBranches zeros expired frost; cap-stack chill reunites with closed", () => {
    const rt = lengRuntime();
    rt.state = patchMelee(rt.state, { primordialIceStacks: 10 });
    const forked = expandLengOnLand({ weight: 1, rt }, 0);
    expect(forked.branches.length).toBe(2);
    const frostOpen = forked.branches.find((b) => b.rt.state.melee.frostbladesUntilTick > 0)!;
    const frostClosed = forked.branches.find((b) => b.rt.state.melee.frostbladesUntilTick === 0)!;
    const past = frostOpen.rt.state.melee.frostbladesUntilTick + 1;
    const a = advanceToBranches({ weight: frostOpen.weight, rt: frostOpen.rt }, past);
    const b = advanceToBranches({ weight: frostClosed.weight, rt: frostClosed.rt }, past);
    expect(a.branches).toHaveLength(1);
    expect(b.branches).toHaveLength(1);
    expect(a.branches[0]!.rt.state.melee.frostbladesUntilTick).toBe(0);
    expect(b.branches[0]!.rt.state.melee.frostbladesUntilTick).toBe(0);
    const reunited = mergeBranches([...a.branches, ...b.branches]);
    expect(reunited).toHaveLength(1);
    expect(reunited[0]!.weight).toBeCloseTo(1, 12);
    expect(reunited[0]!.rt.state.melee.primordialIceStacks).toBe(10);
  });

  it("historical unreferenced hitDetails do not block reconvergence merge", () => {
    const base = lengRuntime();
    base.state = patchMelee(base.state, { primordialIceStacks: 4 });
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

describe("score-only Leng EV collapse (search approx)", () => {
  function scoreOnlyLengRuntime() {
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
      detailLevel: "score-only",
    });
  }

  it("expandLengOnLand is single-branch EV with residual 0 and bounded-approximation", () => {
    const rt = scoreOnlyLengRuntime();
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("bounded-approximation");
    expect(set.branches[0]!.rt.state.melee.primordialIceStacks).toBeCloseTo(
      LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE,
      10,
    );
    expect(set.branches[0]!.weight).toBe(1);
  });

  it("expand does not call snapshotRuntime (zero Leng snaps)", () => {
    enableBranchProfiling(true);
    resetBranchProfile();
    const rt = scoreOnlyLengRuntime();
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
    expect(["approximated", "bounded-approximation"]).toContain(summary.rng?.exactness);
    expect(prof.branchSnapshots).toBe(0);
    expect(prof.maxLiveBranches).toBeLessThanOrEqual(1);
  });

  it("multi-land EV accumulates fractional stacks without forking", () => {
    const rt = scoreOnlyLengRuntime();
    const attack = rt.byId.get("attack")!;
    scheduleCastEvents(rt, prepareCast(rt, attack, 0), false);
    scheduleCastEvents(rt, prepareCast(rt, attack, 3), false);
    const set = advanceToBranches({ weight: 1, rt }, rt.queue.maxTick());
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("bounded-approximation");
    expect(set.branches[0]!.rt.state.melee.primordialIceStacks).toBeCloseTo(
      2 * (LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE),
      10,
    );
  });

  it("full-analysis still forks divergent stack outcomes", () => {
    const rt = lengRuntime();
    expect(rt.detailLevel).not.toBe("score-only");
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.branches.length).toBeGreaterThan(1);
    expect(set.exactness).toBe("exact");
  });
});

