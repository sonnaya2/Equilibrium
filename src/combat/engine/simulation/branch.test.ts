import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { commitCast, prepareSimulationCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { mergeBranches, snapshotRuntime } from "./branch";
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
    ] as const) {
      expect(clone[key], key).not.toBe(rt[key]);
    }
    // Cast records are cloned, not aliased — a branch's totals must not leak.
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
    // The parent still holds the object it started with — nothing was mutated
    // in place inside the nested style state.
    expect(rt.state.necromancy).toBe(parentNecromancy);
    expect(rt.state.necromancy.conjures.spirits).toHaveLength(0);
    expect(rt.state.melee).toBe(parentMelee);
    expect(rt.casts).toHaveLength(0);
    expect(rt.queue.length).toBe(0);
  });

  it("does not merge branches whose future scheduler state differs", () => {
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
    expect(procCtx.performCast(attack, 0, false, { impatientProc: true }).ok).toBe(true);
    expect(procCtx.getState().adrenaline).toBeCloseTo(12);

    const flatCtx = createCastContext({ ...baseInput, adrenaline: { impatientRank: 4 } });
    expect(flatCtx.performCast(attack, 0, false, { impatientProc: false }).ok).toBe(true);
    expect(flatCtx.getState().adrenaline).toBeCloseTo(9);
  });

  it("the driver branches per basic and reports the modal trajectory (R4: 0.36/0.64)", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng).toEqual({ method: "probability-weighted branching", branches: 2 });
    expect(lastCast(s).adrenalineAfter).toBe(9); // modal branch: no proc (0.64)
  });

  it("branches whose adrenaline realigns merge back", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack", "attack"),
    });
    expect(s.ok).toBe(true);
    // 24 (p²), 21 (2pq, merged), 18 (q²)
    expect(s.rng?.branches).toBe(3);
    expect(lastCast(s).adrenalineAfter).toBe(21); // modal branch: exactly one proc
  });

  it("Invigorating multiplier applies before the Impatient proc", () => {
    const ctx = createCastContext({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientRank: 4 },
    });
    const attack = ctx.byId.get("attack")!;
    expect(ctx.performCast(attack, 0, false, { impatientProc: true }).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBeCloseTo(9 * 1.2 + 3);
  });

  it("does not apply Invigorating/Impatient when there is no adrenaline gain", () => {
    const plain = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
    });
    const noGain = simulate({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientRank: 4 },
      rotation: rotationOf("dismember"), // enhanced bleed — no adrenaline field
    });
    expect(plain.casts[0].adrenalineAfter).toBe(9);
    expect(noGain.casts[0].adrenalineAfter).toBe(0);
    expect(noGain.rng).toBeUndefined(); // no basic cast → no RNG point → no branching
  });
});

describe("Relentless refund branching", () => {
  it("a proc refunds the full cost and starts the 30s lockout", () => {
    const ctx = createCastContext({ ...baseInput, adrenaline: { relentlessRank: 5 } });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().adrenaline).toBe(36);
    const attempt = ctx.performCast(assault, ctx.getState().tick, false, { relentlessProc: true });
    expect(attempt.ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(36); // cost 25 fully refunded
    expect(ctx.getState().relentlessUntilTick).toBe(12 + 50);
    expect(ctx.finish().casts.at(-1)).toMatchObject({
      listedCost: 25,
      effectiveCost: 25,
      actualSpend: 25,
      refund: 25,
      adrenalineGained: 0,
    });
  });

  it("a non-proc spends the cost normally with no lockout", () => {
    const ctx = createCastContext({ ...baseInput, adrenaline: { relentlessRank: 5 } });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(assault, ctx.getState().tick, false, { relentlessProc: false }).ok).toBe(
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
    ctx.performCast(assault, ctx.getState().tick, false, { relentlessProc: true });
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    // Second assault lands inside the lockout: the override cannot re-proc it.
    const before = ctx.getState().adrenaline;
    expect(
      ctx.performCast(assault, ctx.firstLegalTick("assault"), false, { relentlessProc: true }).ok,
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
    expect(s.error).toContain("assault");
  });

  it("a rotation legal on every branch stays ok with weighted totals", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "assault"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng?.branches).toBe(2);
    expect(lastCast(s).adrenalineAfter).toBe(27 - 25); // modal branch: no refund
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
