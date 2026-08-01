import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";

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
});
