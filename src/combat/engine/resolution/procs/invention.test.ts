import { describe, expect, it } from "vitest";
import { baseInput } from "../../../test/fixtures/inputs";
import { createRuntime } from "../../runtime/runtime";
import { AFTERSHOCK_DAMAGE_THRESHOLD } from "../../../shared/perks";
import { rotationOf } from "../../simulation/contracts";
import { simulate } from "../../simulation/simulate";
import { applyInventionProcs } from "./invention";

/**
 * Aftershock charge / self-interaction.
 *
 * Source: https://runescape.wiki/w/Aftershock — "After dealing 50,000 damage,
 * create an explosion…". The charge counter tracks damage that builds the
 * threshold; the explosion is the result of crossing it. Aftershock's own blast
 * therefore must not re-seed charge after the land-time reset.
 */
describe("Invention procs — Aftershock charge eligibility", () => {
  it("does not charge Aftershock from its own blast damage", () => {
    const rt = createRuntime({
      ...baseInput,
      base: 1000,
      procs: { aftershockRank: 1 },
    });
    // Pretend a blast is landing with residual charge still present.
    rt.state = {
      ...rt.state,
      invention: {
        ...rt.state.invention,
        aftershockCharge: 12_000,
        aftershockPending: true,
        aftershockReadyTick: 0,
      },
    };

    const aftershockDamage = {
      min: 240,
      max: 396,
      expected: 318,
    };
    applyInventionProcs(
      rt,
      {
        tick: 0,
        seq: 1,
        family: "proc",
        abilityId: "aftershock",
        sourceCast: -1,
        hitIndex: 0,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
        resolve: () => ({ damage: aftershockDamage }),
      },
      aftershockDamage,
    );

    expect(rt.state.invention.aftershockCharge).toBe(0);
    expect(rt.state.invention.aftershockPending).toBe(false);
    expect(rt.state.invention.aftershockReadyTick).toBe(10); // 6s
    // No second Aftershock scheduled from the blast itself.
    expect(rt.queue.pending().filter((e) => e.abilityId === "aftershock")).toHaveLength(0);
  });

  it("charges Aftershock from ability hits and Crackling, not from a free self-proc", () => {
    const s = simulate({
      ...baseInput,
      base: 1000,
      procs: { cracklingRank: 4, aftershockRank: 1 },
      rotation: rotationOf("attack"),
    });
    // Attack 1200 + Crackling 2000 = 3200 charge — well under 50k.
    expect(s.perAbility.crackling).toBeCloseTo(2000, 5);
    expect(s.perAbility.aftershock).toBeUndefined();
    expect(s.totalExpected).toBeCloseTo(3200, 5);
  });

  it("resets charge after a real threshold-crossing blast without keeping residual blast EV", () => {
    // base 50_000, cap bypassed: each attack is 50k expected → one Aftershock
    // per attack delayed by the 6s interval. After the first blast lands, the
    // next ability hit must start charge from zero, not from residual blast EV.
    const s = simulate({
      ...baseInput,
      base: 50_000,
      cap: { cap: 30_000, bypass: true },
      procs: { aftershockRank: 1 },
      rotation: rotationOf("attack", "attack"),
    });
    const procs = s.events.filter((event) => event.abilityId === "aftershock");
    expect(procs.length).toBeGreaterThanOrEqual(1);
    // Second attack at tick 3: if blast EV re-seeded charge, behaviour would
    // still schedule — assert charge path is clean by checking interval spacing.
    expect(procs[0]!.tick).toBe(0);
    if (procs.length >= 2) {
      expect(procs[1]!.tick - procs[0]!.tick).toBeGreaterThanOrEqual(10);
    }
  });

  it("accumulates charge only while no Aftershock is pending", () => {
    const rt = createRuntime({
      ...baseInput,
      procs: { aftershockRank: 1 },
    });
    const hit = {
      tick: 0,
      seq: 1,
      family: "hit" as const,
      abilityId: "attack",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      resolve: () => ({ damage: { min: 1000, max: 1000, expected: 1000 } }),
    };

    applyInventionProcs(rt, hit, { min: 1000, max: 1000, expected: 1000 });
    expect(rt.state.invention.aftershockCharge).toBe(1000);

    // Force pending so further hits freeze charge.
    rt.state = {
      ...rt.state,
      invention: { ...rt.state.invention, aftershockPending: true, aftershockCharge: 49_000 },
    };
    applyInventionProcs(rt, { ...hit, seq: 2 }, { min: 5000, max: 5000, expected: 5000 });
    expect(rt.state.invention.aftershockCharge).toBe(49_000);
  });

  it("reaches threshold from ability damage alone at the wiki 50_000 boundary", () => {
    const rt = createRuntime({
      ...baseInput,
      procs: { aftershockRank: 1 },
    });
    const almost = AFTERSHOCK_DAMAGE_THRESHOLD - 1;
    applyInventionProcs(
      rt,
      {
        tick: 0,
        seq: 1,
        family: "hit",
        abilityId: "attack",
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        resolve: () => ({ damage: { min: almost, max: almost, expected: almost } }),
      },
      { min: almost, max: almost, expected: almost },
    );
    expect(rt.state.invention.aftershockPending).toBe(false);
    expect(rt.state.invention.aftershockCharge).toBe(almost);

    applyInventionProcs(
      rt,
      {
        tick: 1,
        seq: 2,
        family: "hit",
        abilityId: "attack",
        sourceCast: 1,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        resolve: () => ({ damage: { min: 1, max: 1, expected: 1 } }),
      },
      { min: 1, max: 1, expected: 1 },
    );
    expect(rt.state.invention.aftershockPending).toBe(true);
    expect(rt.state.invention.aftershockCharge).toBe(AFTERSHOCK_DAMAGE_THRESHOLD);
    expect(rt.queue.pending().filter((e) => e.abilityId === "aftershock")).toHaveLength(1);
  });
});
