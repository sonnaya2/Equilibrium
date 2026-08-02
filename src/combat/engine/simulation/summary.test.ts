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
    expect(s.ticks).toBe(20);
    expect(s.metric.denominatorTicks).toBe(20);
    expect(s.dps).toBe(75);
    expect(s.rng).toMatchObject({
      terminalClasses: 2,
      representativeClassWeight: 0.5,
      representativeClassTicks: 10,
    });
  });
});
