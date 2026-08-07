import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { createRuntime } from "../runtime/runtime";
import { snapshotRuntime } from "./branch";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { combineBranchSummaries } from "./summary";
import { MODERNISATION_WIKI } from "../../data/sources";

describe("summary — Crackling / Aftershock proc state", () => {
  it("Crackling starts ready and waits 60 seconds before another attack can trigger it", () => {
    const s = simulate({
      ...baseInput,
      procs: { cracklingRank: 4 },
      rotation: rotationOf(...Array(35).fill("attack")),
    });
    expect(s.ok).toBe(true);
    const procs = s.events.filter((event) => event.abilityId === "crackling");
    expect(procs.map((event) => event.tick)).toEqual([0, 102]);
    expect(procs.every((event) => event.damage.expected === 2000)).toBe(true);
    expect(s.perAbility.crackling).toBe(4000);
  });

  it("uses base ability damage and Vulnerability, but not cast-only modifiers", () => {
    const s = simulate({
      ...baseInput,
      base: 1140,
      procs: { cracklingRank: 4 },
      rotation: rotationOf("attack"),
      modifiers: [
        {
          id: "test:cast-only",
          stage: "onCast",
          priority: 0,
          applies: () => true,
          apply: (state) => ({ ...state, damage: state.damage * 10 }),
          source: MODERNISATION_WIKI,
        },
        {
          id: "vulnerability",
          stage: "target",
          priority: 0,
          applies: () => true,
          apply: (state) => ({ ...state, damage: Math.floor(state.damage * 1.1) }),
          source: MODERNISATION_WIKI,
        },
      ],
    });
    expect(s.perAbility.crackling).toBe(2508);
  });

  it("Aftershock: 100k ability damage, rank 1, base 1000 produces two 31.8% average blasts", () => {
    const n = 84;
    const s = simulate({
      ...baseInput,
      procs: { aftershockRank: 1 },
      rotation: rotationOf(...Array(n).fill("attack")),
    });
    expect(s.ok).toBe(true);
    const abilityExpected = n * 1200;
    expect(abilityExpected).toBeGreaterThanOrEqual(100_000);
    expect(s.perAbility.aftershock).toBeCloseTo(636, 5);
    expect(s.totalExpected).toBeCloseTo(abilityExpected + 636, 5);
    expect(s.events.filter((event) => event.abilityId === "aftershock")).toHaveLength(2);
    expect(s.rng?.exactness).toBe("approximated");
    expect(s.damage.eligibleForRanking).toBe(false);
  });

  it("Crackling damage contributes to Aftershock without creating a free proc", () => {
    const s = simulate({
      ...baseInput,
      procs: { cracklingRank: 4, aftershockRank: 4 },
      rotation: rotationOf("attack"),
    });
    expect(s.perAbility.crackling).toBeCloseTo(2000, 5);
    expect(s.perAbility.aftershock).toBeUndefined();
    expect(s.totalExpected).toBeCloseTo(3200, 5);
  });

  it("delays a charged Aftershock until its 6-second interval is ready", () => {
    const s = simulate({
      ...baseInput,
      base: 50_000,
      cap: { cap: 30_000, bypass: true },
      procs: { aftershockRank: 1 },
      rotation: rotationOf(...Array(8).fill("attack")),
    });
    const procs = s.events.filter((event) => event.abilityId === "aftershock");
    expect(procs.slice(0, 3).map((event) => event.tick)).toEqual([0, 10, 20]);
    expect(procs.every((event) => event.damage.min === 12_000)).toBe(true);
    expect(procs.every((event) => event.damage.max === 19_800)).toBe(true);
  });

  it("rank 0 procs add nothing", () => {
    const plain = simulate({ ...baseInput, rotation: rotationOf("attack") });
    const zero = simulate({
      ...baseInput,
      procs: { cracklingRank: 0, aftershockRank: 0 },
      rotation: rotationOf("attack"),
    });
    expect(zero.totalExpected).toBeCloseTo(plain.totalExpected, 10);
    expect(zero.perAbility.crackling).toBeUndefined();
    expect(zero.perAbility.aftershock).toBeUndefined();
  });

  it("reconciles source/effect totals and labels expected crits without faking a proc", () => {
    const expected = simulate({
      ...baseInput,
      crit: { chance: 0.25 },
      procs: { cracklingRank: 1 },
      rotation: rotationOf("attack"),
    });
    expect(expected.analysis.bySource.reduce((total, row) => total + row.damage, 0)).toBeCloseTo(
      expected.totalExpected,
      10,
    );
    expect(
      expected.analysis.byEffect.reduce((total, row) => total + row.totalDamage, 0),
    ).toBeCloseTo(expected.totalExpected, 10);
    const hit = expected.events.find((event) => event.abilityId === "attack")!;
    expect(hit.damage.critical).toMatchObject({ mode: "expected", chance: 0.25 });
    expect(hit.damage.critical!.contribution).toBeGreaterThan(0);

    const guaranteed = simulate({
      ...baseInput,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf("attack"),
    });
    expect(guaranteed.events[0]?.damage.critical?.mode).toBe("guaranteed");
  });

  it("reports expected damage lost to the hit cap", () => {
    const s = simulate({
      ...baseInput,
      base: 50_000,
      rotation: rotationOf("attack"),
    });
    expect(s.analysis.capLoss).toBeGreaterThan(0);
    expect(s.analysis.byEffect[0]?.capLoss).toBeCloseTo(s.analysis.capLoss, 10);
  });
});

describe("summary finalization", () => {
  it("keeps fixed-window DPS separate from post-window tails and finalizes once", () => {
    const ctx = createCastContext({
      ...baseInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
      startingAdrenaline: 100,
    });
    expect(ctx.performCast(ctx.byId.get("bloat")!, 0, false).ok).toBe(true);
    const summary = ctx.finish(undefined, 6, { includeTails: true });
    expect(summary.metric).toMatchObject({
      type: "fixed-window",
      denominatorTicks: 6,
      tails: "included-separately",
    });
    expect(summary.events.every((event) => event.tick < 6)).toBe(true);
    expect(
      summary.analysis.byEffect.find((effect) => effect.id === "bloat")?.dotDamage,
    ).toBeGreaterThan(0);
    expect(summary.totalExpectedIncludingTails).toBeGreaterThan(summary.totalExpected);
    expect(summary.postWindowTailDamage).toBeCloseTo(
      summary.totalExpectedIncludingTails! - summary.totalExpected,
      10,
    );
    expect(() => ctx.finish()).toThrow("already finalized");
  });

  it("labels an unconstrained rotation as natural completion", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack") });
    expect(s.metric).toEqual({
      type: "natural-completion",
      denominatorTicks: s.ticks,
      damageCounted: s.totalExpected,
      tails: "included-in-natural-completion",
    });
    expect(s.history.kind).toBe("complete");
    expect(s.duration.kind).toBe("deterministic");
    expect(s.duration.expectedTicks).toBe(s.duration.representativeTicks);
    expect(s.rng).toBeUndefined();
  });

  it("keeps stochastic natural DPM consistent with its expected duration", () => {
    const short = createRuntime(baseInput);
    short.totalExpected = 600;
    short.endTick = 10;
    const long = snapshotRuntime(short);
    long.totalExpected = 1200;
    long.endTick = 30;

    const s = combineBranchSummaries(
      [
        { weight: 0.5, rt: short },
        { weight: 0.5, rt: long },
      ],
      undefined,
      undefined,
      true,
    );
    expect(s.totalExpected).toBe(900);
    expect(s.damage.expectedDamage).toBe(900);
    expect(s.ticks).toBe(20);
    expect(s.duration.expectedTicks).toBe(20);
    expect(s.duration.minimumTicks).toBe(10);
    expect(s.duration.maximumTicks).toBe(30);
    expect(s.duration.representativeTicks).toBe(10);
    expect(s.metric.denominatorTicks).toBe(20);
    // Primary natural DPS is ratio of expectations: 900 / (20 * 0.6) = 75.
    expect(s.dps).toBe(75);
    expect(s.dpsDetail.ratioOfExpectations).toBe(75);
    // E[D_i/T_i] = 0.5*(600/6) + 0.5*(1200/18) = 50 + 33.333... = 83.333...
    expect(s.dpsDetail.expectedBranchDps).toBeCloseTo(0.5 * 100 + 0.5 * (1200 / 18), 10);
    expect(s.dpsDetail.representativeDps).toBe(100);
    expect(s.history.kind).toBe("representative-terminal-class");
    expect(s.rng).toMatchObject({
      terminalClasses: 2,
      representativeClassWeight: 0.5,
      representativeClassTicks: 10,
    });
  });

  it("finalizes analysis from runtime ledgers, not the representative event log", () => {
    const rt = createRuntime(baseInput);
    rt.totalExpected = 500;
    rt.endTick = 3;
    rt.analysis.directDamage = 500;
    rt.analysis.criticalContribution = 40;
    rt.analysis.capLoss = 8;
    rt.analysis.sources.set("ability-direct", 500);
    rt.analysis.effects.set("attack", {
      id: "attack",
      kind: "ability-direct",
      totalDamage: 500,
      directDamage: 500,
      dotDamage: 0,
      criticalContribution: 40,
      capLoss: 8,
      expectedCasts: 1,
      expectedTriggerRolls: 0,
      expectedActivations: 2,
      expectedSeparateHits: 2,
      expectedAttachedComponents: 0,
      expectedPlayerPoisonHits: 0,
      bonusDamage: 0,
    });
    // Event log deliberately disagrees with the ledger.
    rt.events.push({
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
      damage: { min: 0, max: 0, expected: 1 },
    });

    const summary = combineBranchSummaries([{ weight: 1, rt }], undefined, undefined, false);
    expect(summary.totalExpected).toBe(500);
    expect(summary.analysis.directDamage).toBe(500);
    expect(summary.analysis.criticalContribution).toBe(40);
    expect(summary.analysis.capLoss).toBe(8);
    expect(summary.analysis.byEffect[0]).toMatchObject({
      id: "attack",
      totalDamage: 500,
      expectedActivations: 2,
      expectedSeparateHits: 2,
      averagePerActivation: 250,
      criticalContribution: 40,
      capLoss: 8,
    });
    // Events remain representative provenance only.
    expect(summary.events[0]?.damage.expected).toBe(1);
  });
});
