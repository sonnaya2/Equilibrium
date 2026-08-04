import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { commitCast, prepareSimulationCast } from "../cast";
import type { CastSnapshot } from "../cast/snapshot";
import { createRuntime, enqueueEvent } from "../runtime/runtime";
import { capBranches, mergeAndCapBranches, mergeBranches, snapshotRuntime } from "./branch";
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

const castSnap = (over: Partial<CastSnapshot> = {}): CastSnapshot => ({
  castSeq: 0,
  critLayers: { chance: 0, eligible: true },
  baseMods: [],
  chaosRoarActive: false,
  channelled: false,
  greaterFuryActive: false,
  furyActive: false,
  firstEligibleHitIndex: 0,
  empowerMult: 1,
  searingWindsAtCast: false,
  enduringRuinBonus: 0,
  ...over,
});

const noopResolve = () => ({ damage: { min: 0, max: 0, expected: 0 } });

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
      "analysis",
    ] as const) {
      expect(clone[key], key).not.toBe(rt[key]);
    }
    expect(clone.analysis.effects).not.toBe(rt.analysis.effects);
    expect(clone.analysis.sources).not.toBe(rt.analysis.sources);
    expect(clone.analysis.castKeys).not.toBe(rt.analysis.castKeys);
    // Cast records are cloned, not aliased - a branch's totals must not leak.
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
    // The parent still holds the object it started with - nothing was mutated
    // in place inside the nested style state.
    expect(rt.state.necromancy).toBe(parentNecromancy);
    expect(rt.state.necromancy.conjures.spirits).toHaveLength(0);
    expect(rt.state.melee).toBe(parentMelee);
    expect(rt.casts).toHaveLength(0);
    expect(rt.queue.length).toBe(0);
  });

  it("does not merge branches whose future or finalization state differs", () => {
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

    const differentEnd = snapshotRuntime(rt);
    differentEnd.endTick = 1;
    expect(
      mergeBranches([
        { weight: 0.4, rt },
        { weight: 0.6, rt: differentEnd },
      ]),
    ).toHaveLength(2);

    // Historical damage alone must not block a merge when future state matches.
    const differentDamage = snapshotRuntime(rt);
    differentDamage.totalExpected = 50_000;
    expect(
      mergeBranches([
        { weight: 0.4, rt },
        { weight: 0.6, rt: differentDamage },
      ]),
    ).toHaveLength(1);
  });

  it("merges future-equivalent branches: expected ledgers mean, support uses min/max", () => {
    const low = createRuntime(meleeInput);
    low.totalExpected = 100;
    low.totalMin = 80;
    low.totalMax = 120;
    low.perAbility.attack = 100;
    low.damageByTick[0] = 100;

    const high = snapshotRuntime(low);
    high.totalExpected = 300;
    high.totalMin = 240;
    high.totalMax = 360;
    high.perAbility.attack = 300;
    high.damageByTick[0] = 300;

    const merged = mergeBranches([
      { weight: 0.25, rt: low },
      { weight: 0.75, rt: high },
    ]);
    expect(merged).toHaveLength(1);
    const rt = merged[0]!.rt;
    expect(merged[0]!.weight).toBe(1);
    // 0.25*100 + 0.75*300 = 250
    expect(rt.totalExpected).toBe(250);
    // Path conditionals are weight-averaged (expected conditional extrema).
    expect(rt.totalMin).toBe(200);
    expect(rt.totalMax).toBe(300);
    // True support extrema use min/max via offsets.
    expect(rt.totalMin + rt.analysis.supportMinOffset).toBe(80);
    expect(rt.totalMax + rt.analysis.supportMaxOffset).toBe(360);
    expect(rt.perAbility.attack).toBe(250);
    expect(rt.damageByTick[0]).toBe(250);
  });

  it("support bounds survive post-merge damage landings", () => {
    const low = createRuntime(meleeInput);
    low.totalMin = 80;
    low.totalMax = 120;
    low.totalExpected = 100;
    const high = snapshotRuntime(low);
    high.totalMin = 240;
    high.totalMax = 360;
    high.totalExpected = 300;

    const merged = mergeBranches([
      { weight: 0.25, rt: low },
      { weight: 0.75, rt: high },
    ])[0]!;
    // Identical future hit lands after merge.
    merged.rt.totalMin += 50;
    merged.rt.totalMax += 70;
    merged.rt.totalExpected += 60;
    expect(merged.rt.totalMin + merged.rt.analysis.supportMinOffset).toBe(130);
    expect(merged.rt.totalMax + merged.rt.analysis.supportMaxOffset).toBe(430);
    // Conditional means also advanced by the same landing.
    expect(merged.rt.totalMin).toBe(250);
    expect(merged.rt.totalMax).toBe(370);
  });

  it("weight-averages analysis ledgers; representative events do not drive aggregates", () => {
    const low = createRuntime(meleeInput);
    low.totalExpected = 100;
    low.totalMin = 80;
    low.totalMax = 120;
    low.analysis.directDamage = 100;
    low.analysis.criticalContribution = 10;
    low.analysis.capLoss = 4;
    low.analysis.sources.set("ability-direct", 100);
    low.analysis.effects.set("attack", {
      id: "attack",
      kind: "ability-direct",
      totalDamage: 100,
      directDamage: 100,
      dotDamage: 0,
      criticalContribution: 10,
      capLoss: 4,
      casts: 1,
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      attachedComponents: 0,
      bonusDamage: 0,
    });
    // Representative provenance log only reflects this branch's past.
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

    const high = snapshotRuntime(low);
    high.totalExpected = 300;
    high.totalMin = 240;
    high.totalMax = 360;
    high.analysis.directDamage = 300;
    high.analysis.criticalContribution = 30;
    high.analysis.capLoss = 12;
    high.analysis.sources.set("ability-direct", 300);
    high.analysis.effects.set("attack", {
      id: "attack",
      kind: "ability-direct",
      totalDamage: 300,
      directDamage: 300,
      dotDamage: 0,
      criticalContribution: 30,
      capLoss: 12,
      casts: 1,
      triggerRolls: 0,
      expectedActivations: 3,
      expectedSeparateHits: 3,
      attachedComponents: 0,
      bonusDamage: 0,
    });
    high.events[0] = {
      ...high.events[0]!,
      damage: { min: 240, max: 360, expected: 300 },
    };

    const merged = mergeBranches([
      { weight: 0.25, rt: low },
      { weight: 0.75, rt: high },
    ]);
    expect(merged).toHaveLength(1);
    const { rt, weight } = merged[0]!;
    expect(weight).toBe(1);
    expect(rt.totalExpected).toBe(250);
    // Analysis is weight-mixed: 0.25*low + 0.75*high
    expect(rt.analysis.directDamage).toBe(250);
    expect(rt.analysis.criticalContribution).toBe(25);
    expect(rt.analysis.capLoss).toBe(10);
    expect(rt.analysis.sources.get("ability-direct")).toBe(250);
    const attack = rt.analysis.effects.get("attack")!;
    expect(attack.totalDamage).toBe(250);
    expect(attack.expectedActivations).toBe(2.5);
    expect(attack.expectedSeparateHits).toBe(2.5);
    expect(attack.casts).toBe(1);
    expect(attack.criticalContribution).toBe(25);
    expect(attack.capLoss).toBe(10);
    // keep = high (weight 0.75); events are representative, not the weighted mean.
    expect(rt.events).toHaveLength(1);
    expect(rt.events[0]!.damage.expected).toBe(300);
    // Aggregates stay mixed even though the representative event is from high alone.
    expect(rt.totalExpected).not.toBe(rt.events[0]!.damage.expected);
  });

  it("does not merge when pending queue signatures differ", () => {
    const a = createRuntime(meleeInput);
    enqueueEvent(a, {
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
      castSnap: castSnap(),
      resolve: noopResolve,
    });
    a.nextSeq = 2;

    const b = snapshotRuntime(a);
    b.queue.shift();
    enqueueEvent(b, {
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
      castSnap: castSnap(),
      resolve: noopResolve,
    });

    expect(
      mergeBranches([
        { weight: 0.5, rt: a },
        { weight: 0.5, rt: b },
      ]),
    ).toHaveLength(2);
  });

  it("does not merge when only castSnap.searingWindsAtCast differs", () => {
    const mk = (searingWindsAtCast: boolean) => {
      const rt = createRuntime(meleeInput);
      enqueueEvent(rt, {
        tick: 5,
        seq: 1,
        family: "hit",
        abilityId: "attack",
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        provenance: { kind: "player_direct" },
        castSnap: castSnap({ searingWindsAtCast }),
        resolve: noopResolve,
      });
      rt.nextSeq = 2;
      return rt;
    };
    expect(
      mergeBranches([
        { weight: 0.5, rt: mk(true) },
        { weight: 0.5, rt: mk(false) },
      ]),
    ).toHaveLength(2);
  });
});

describe("capBranches", () => {
  it("keeps the heaviest branches and folds discarded weight into the top", () => {
    const base = createRuntime(meleeInput);
    const mk = (weight: number): { weight: number; rt: ReturnType<typeof createRuntime> } => ({
      weight,
      rt: snapshotRuntime(base),
    });
    // Distinct endTick so merge does not collapse them first.
    const branches = [0.4, 0.3, 0.15, 0.1, 0.05].map((w, i) => {
      const b = mk(w);
      b.rt.endTick = i;
      return b;
    });
    const capped = capBranches(branches, 2);
    expect(capped).toHaveLength(2);
    expect(capped[0]!.weight).toBeCloseTo(0.4 + 0.15 + 0.1 + 0.05);
    expect(capped[1]!.weight).toBeCloseTo(0.3);
    const mass = capped.reduce((s, b) => s + b.weight, 0);
    expect(mass).toBeCloseTo(1);
  });

  it("mergeAndCapBranches stays within MAX_LIVE_BRANCHES", () => {
    const base = createRuntime(meleeInput);
    const many = Array.from({ length: 100 }, (_, i) => {
      const rt = snapshotRuntime(base);
      rt.endTick = i;
      return { weight: 1 / 100, rt };
    });
    const out = mergeAndCapBranches(many, 16);
    expect(out.length).toBeLessThanOrEqual(16);
    expect(out.reduce((s, b) => s + b.weight, 0)).toBeCloseTo(1);
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

  it("keeps a long Impatient and Relentless rotation bounded", () => {
    const cycle = ["attack", "attack", "attack", "attack", "assault"];
    const rotation = rotationOf(...Array.from({ length: 10 }, () => cycle).flat());
    const stochastic = simulate({
      ...meleeInput,
      adrenaline: { impatientRank: 4, relentlessRank: 5 },
      rotation,
    });
    const plain = simulate({ ...meleeInput, rotation });
    expect(stochastic.ok).toBe(true);
    expect(stochastic.totalExpected).toBeCloseTo(plain.totalExpected, 8);
    expect(stochastic.rng!.terminalClasses).toBeLessThan(64);
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
    expect(procCtx.performCast(attack, 0, false, { impatient: true }).ok).toBe(true);
    expect(procCtx.getState().adrenaline).toBeCloseTo(12);

    const flatCtx = createCastContext({ ...baseInput, adrenaline: { impatientRank: 4 } });
    expect(flatCtx.performCast(attack, 0, false, { impatient: false }).ok).toBe(true);
    expect(flatCtx.getState().adrenaline).toBeCloseTo(9);
  });

  it("reports a representative from the highest-weight terminal class", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.history.kind).toBe("representative-terminal-class");
    expect(s.rng).toMatchObject({
      method: "probability-weighted branching",
      terminalClasses: 2,
      representativeClassWeight: 0.64,
      representativeClassTicks: 3,
    });
    expect(s.rng!.representative).toMatchObject({
      classWeight: 0.64,
      ticks: 3,
      historyKind: "representative-terminal-class",
      selectionReason: "highest-probability-mass",
    });
    expect(lastCast(s).adrenalineAfter).toBe(9);
  });

  it("branches whose adrenaline realigns merge back", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack", "attack"),
    });
    expect(s.ok).toBe(true);
    // 24 (p²), 21 (2pq, merged), 18 (q²)
    expect(s.rng?.terminalClasses).toBe(3);
    expect(s.rng?.representativeClassWeight).toBeCloseTo(0.4608, 10);
    expect(lastCast(s).adrenalineAfter).toBe(21);
  });

  it("Impatient is inside Invigorating (wiki order: (9+3)*1.2 = 14.4)", () => {
    const ctx = createCastContext({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientRank: 4 },
    });
    const attack = ctx.byId.get("attack")!;
    expect(ctx.performCast(attack, 0, false, { impatient: true }).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBeCloseTo(14.4);
  });

  it("does not apply Invigorating/Impatient when there is no adrenaline gain", () => {
    const plain = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
    });
    const noGain = simulate({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientRank: 4 },
      rotation: rotationOf("dismember"), // enhanced bleed - no adrenaline field
    });
    expect(plain.casts[0].adrenalineAfter).toBe(9);
    expect(noGain.casts[0].adrenalineAfter).toBe(0);
    expect(noGain.rng).toBeUndefined(); // no basic cast → no RNG point → no branching
  });

  it("does not branch a basic with no adrenaline gain", () => {
    const noGainBasic = {
      id: "no_gain_basic",
      name: "No-gain basic",
      style: "melee" as const,
      category: "basic" as const,
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
    };
    const s = simulate({
      ...baseInput,
      abilities: [...MELEE_ABILITIES, noGainBasic],
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf(noGainBasic.id),
    });
    expect(s.ok).toBe(true);
    expect(s.rng).toBeUndefined();
  });
});

describe("Relentless refund branching", () => {
  it("a proc refunds the full cost and starts the 30s lockout", () => {
    const ctx = createCastContext({ ...baseInput, adrenaline: { relentlessRank: 5 } });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().adrenaline).toBe(36);
    const attempt = ctx.performCast(assault, ctx.getState().tick, false, { relentless: true });
    expect(attempt.ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(36); // cost 25 fully refunded
    expect(ctx.getState().relentlessUntilTick).toBe(12 + 50);
    expect(ctx.finish().casts.at(-1)).toMatchObject({
      listedCost: 25,
      effectiveCost: 25,
      actualSpend: 0,
      refund: 25,
      adrenalineGained: 0,
      adrenalineTransaction: expect.objectContaining({
        spendPreventedBy: "relentless",
        actualSpend: 0,
        effectiveCost: 25,
      }),
    });
  });

  it("a non-proc spends the cost normally with no lockout", () => {
    const ctx = createCastContext({ ...baseInput, adrenaline: { relentlessRank: 5 } });
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(assault, ctx.getState().tick, false, { relentless: false }).ok).toBe(
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
    ctx.performCast(assault, ctx.getState().tick, false, { relentless: true });
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    // Second assault lands inside the lockout: the override cannot re-proc it.
    const before = ctx.getState().adrenaline;
    expect(
      ctx.performCast(assault, ctx.firstLegalTick("assault"), false, { relentless: true }).ok,
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
    expect(s.failure?.failedWeight).toBeCloseTo(0.95, 10);
    expect(s.failure?.successfulWeight).toBeCloseTo(0.05, 10);
    expect(s.failure?.totalsScope).toBe("successful-branches-renormalized");
    expect(s.error).toContain("assault");
  });

  it("a rotation legal on every branch stays ok with weighted totals", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "assault"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng?.terminalClasses).toBe(2);
    expect(lastCast(s).adrenalineAfter).toBe(27 - 25);
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
