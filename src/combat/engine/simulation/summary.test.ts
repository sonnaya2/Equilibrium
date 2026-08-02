import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { createRuntime } from "../runtime/runtime";
import { snapshotRuntime } from "./branch";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { combineBranchSummaries } from "./summary";
import { MODERNISATION_WIKI } from "../../data/sources";

describe("summary — Crackling / Aftershock expected-value procs", () => {
  it("Crackling rank 4, base 1000, 60s horizon → ~2000 EV", () => {
    const ctx = createCastContext({
      ...baseInput,
      procs: { cracklingRank: 4 },
    });
    const s = ctx.finish(undefined, 100);
    expect(s.ok).toBe(true);
    expect(s.perAbility.crackling).toBeCloseTo(2000, 5);
    expect(s.totalExpected).toBeCloseTo(2000, 5);
    expect(s.damageByTick[50]).toBeCloseTo(2000, 5);
  });

  it("uses the effective ability-damage input for procs without cast modifiers", () => {
    const ctx = createCastContext({
      ...baseInput,
      base: 1140,
      procs: { cracklingRank: 4 },
      modifiers: [
        {
          id: "test:cast-only",
          stage: "onCast",
          priority: 0,
          applies: () => true,
          apply: (state) => ({ ...state, damage: state.damage * 10 }),
          source: MODERNISATION_WIKI,
        },
      ],
    });
    const s = ctx.finish(undefined, 100);
    expect(s.perAbility.crackling).toBeCloseTo(2280, 5);
  });

  it("Aftershock: 100k ability damage, rank 1, base 1000 → 2 procs × 318 = 636 when H allows", () => {
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
  });

  it("Aftershock does not recurse on Crackling damage", () => {
    const ctx = createCastContext({
      ...baseInput,
      procs: { cracklingRank: 4, aftershockRank: 4 },
    });
    const s = ctx.finish(undefined, 100);
    expect(s.perAbility.crackling).toBeCloseTo(2000, 5);
    expect(s.perAbility.aftershock).toBeUndefined();
    expect(s.totalExpected).toBeCloseTo(2000, 5);
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
