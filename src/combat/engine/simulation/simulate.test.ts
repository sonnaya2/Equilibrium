import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import {
  DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS,
  NECROMANCY_ABILITIES,
  volleyOfSouls,
} from "../../styles/necromancy/abilities";
import { mulFloor } from "../../core/rounding";
import { MODERNISATION_WIKI } from "../../data/sources";
import type { CombatModifier } from "../../types";
import { rotationOf } from "./contracts";
import { simulate, type CastRecord, type RotationSummary, type SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";

function required<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(label);
  return value;
}

function abilityById<T extends { id: string }>(abilities: readonly T[], id: string): T {
  return required(
    abilities.find((ability) => ability.id === id),
    `Missing engine ability: ${id}`,
  );
}

function lastCast(summary: RotationSummary): CastRecord {
  return required(summary.casts.at(-1), "Expected at least one cast");
}

function findCast(
  summary: RotationSummary,
  predicate: (cast: CastRecord) => boolean,
  label: string,
): CastRecord {
  return required(summary.casts.find(predicate), label);
}

const baseInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

describe("simulate", () => {
  it("walks casts down the global cooldown and accumulates adrenaline", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack", "attack", "attack") });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6]);
    expect(s.casts[2].adrenalineAfter).toBe(27);
    expect(s.ticks).toBe(9);
    expect(s.totalExpected).toBeCloseTo(3 * 1200);
    expect(s.dps).toBeCloseTo(3600 / (9 * 0.6));
  });

  it("swaps Assault to its 4-Bloodlust band only once the threshold is met", () => {
    const low = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault"),
    });
    expect(lastCast(low).result.expected).toBeCloseTo(4 * 1400);

    const high = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault"),
    });
    const assault = lastCast(high);
    expect(assault.tick).toBe(12);
    expect(assault.result.expected).toBeCloseTo(4 * 1800);
    expect(assault.adrenalineAfter).toBe(36 - 25);
  });

  it("stalls a repeated cast until its individual cooldown expires (Assault's channel occupies 8 ticks)", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        "attack",
        "attack",
        "attack",
        "assault",
        "attack",
        "attack",
        "attack",
        "assault",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 17, 20, 23, 26]);
  });

  it("fails on adrenaline starvation instead of silently skipping", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack", "overpower") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("adrenaline");
    expect(s.casts).toHaveLength(1);
  });

  it("fails on an unknown ability id", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("definitely_not_real") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("unknown ability");
  });

  it("is deterministic and its contribution split sums to the total", () => {
    const rotation = rotationOf("attack", "attack", "rend", "attack", "assault");
    const a = simulate({ ...baseInput, rotation });
    const b = simulate({ ...baseInput, rotation });
    expect(a).toEqual(b);
    const split = Object.values(a.perAbility).reduce((n, x) => n + x, 0);
    expect(split).toBeCloseTo(a.totalExpected);
    expect(a.perAbility["attack"]).toBeCloseTo(3 * 1200);
  });
});

describe("simulate — Crackling / Aftershock EV procs", () => {
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

describe("simulate — Invigorating / Impatient adrenaline", () => {
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

describe("simulate — Relentless refund branching", () => {
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

describe("simulate — damage-over-time scheduling", () => {
  it("bleed tails land on their sourced ticks and extend the timeline", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("dismember") });
    expect(s.ok).toBe(true);
    expect(s.ticks).toBe(17);
    expect(s.damageByTick[0]).toBeUndefined();
    for (let t = 2; t <= 16; t += 2) expect(s.damageByTick[t]).toBeCloseTo(300);
    expect(s.totalExpected).toBeCloseTo(8 * 300);
  });
});

describe("simulate — berserk", () => {
  const setup = [
    ...Array(12).fill("attack"),
    "berserk",
    "rend",
    ...Array(10).fill("attack"),
    "rend",
  ];

  it("multiplies melee damage inside the window and expires after 19.8s", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const rends = s.casts.filter((c) => c.abilityId === "rend");
    expect(rends[0].tick).toBe(39);
    expect(rends[0].result.expected).toBeCloseTo(2624.5);
    expect(rends[1].tick).toBe(72);
    expect(rends[1].result.expected).toBeCloseTo(1500);
  });
});

describe("simulate — fury", () => {
  it("grants +25% crit chance to the next crit-eligible melee cast only", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("fury", "attack", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].result.expected).toBeCloseTo(1200);
    expect(s.casts[0].result.hits[0].critChance).toBe(0);
    expect(s.casts[1].result.hits[0].critChance).toBeCloseTo(0.25);
    expect(s.casts[1].result.expected).toBeCloseTo(1350);
    expect(s.casts[2].result.hits[0].critChance).toBe(0);
    expect(s.casts[2].result.expected).toBeCloseTo(1200);
  });

  it("does not consume the buff on a bleed-only cast", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("fury", "dismember", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[2].result.hits[0].critChance).toBeCloseTo(0.25);
    expect(s.casts[2].result.expected).toBeCloseTo(1350);
  });
});

describe("simulate — greater_flurry", () => {
  it("extends an active Berserk window by 0.6s per hit (8 ticks) while the channel occupies 8", () => {
    const rotation = rotationOf(
      ...Array(12).fill("attack"),
      "berserk",
      ...Array(3).fill("attack"),
      "greater_flurry",
      ...Array(7).fill("attack"),
    );
    const s = simulate({ ...baseInput, rotation });
    expect(s.ok).toBe(true);
    const last = lastCast(s);
    expect(last.abilityId).toBe("attack");
    // Greater Flurry @48 holds the actor until 56; Berserk 36+33=69 extended +8 → 77.
    expect(last.tick).toBe(74);
    expect(last.result.expected).toBeCloseTo(2100);
  });

  it("does not invent a Berserk window when none is active", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(...Array(3).fill("attack"), "greater_flurry", "rend"),
    });
    expect(s.ok).toBe(true);
    expect(lastCast(s).result.expected).toBeCloseTo(1500);
  });
});

describe("simulate — meteor_strike", () => {
  it("multiplies melee basic adrenaline by 1.5x inside the 30s window", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(...Array(7).fill("attack"), "meteor_strike", "attack"),
    });
    expect(s.ok).toBe(true);
    const meteor = findCast(
      s,
      (cast) => cast.abilityId === "meteor_strike",
      "Missing Meteor Strike cast",
    );
    expect(meteor.adrenalineAfter).toBeCloseTo(3 + 3 * 4.5);
    const follow = lastCast(s);
    expect(follow.adrenalineAfter).toBeCloseTo(meteor.adrenalineAfter + 13.5 + 3 * 4.5);
  });

  it("does not 1.5x non-basic adrenaline costs or gains (channel occupancy grants its 8 passive ticks)", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        ...Array(7).fill("attack"),
        "meteor_strike",
        ...Array(3).fill("attack"),
        "assault",
      ),
    });
    expect(s.ok).toBe(true);
    const assault = lastCast(s);
    const beforeAssault = s.casts[s.casts.length - 2].adrenalineAfter;
    // Assault @33: −25 cost, then 8 channel ticks × 4.5 passive = +36 (cap 100).
    expect(assault.adrenalineAfter).toBeCloseTo(Math.min(100, beforeAssault - 25 + 8 * 4.5), 10);
    expect(assault.adrenalineAfter).toBe(100);
  });
});

describe("simulate — Greater Fury and Chaos Roar", () => {
  it("greater fury guarantees crit on the next non-bleed melee", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("greater_fury", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[1].result.expected).toBeCloseTo(1800);
  });
});

describe("simulate — greater_barge idle + Endless Assault", () => {
  const byId = (id: string) => abilityById(MELEE_ABILITIES, id);

  it("after 10 idle ticks, min/max gain +5*10 / +7*10 AD%", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(byId("attack"), 0, false);
    ctx.performCast(byId("greater_barge"), 10, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    const g = s.casts[1];
    expect(g.result.min).toBe(1250);
    expect(g.result.max).toBe(1650);
    expect(g.result.expected).toBeCloseTo(1450);
  });

  it("caps idle scale at 10 ticks", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(byId("attack"), 0, false);
    ctx.performCast(byId("greater_barge"), 20, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    const g = s.casts[1];
    expect(g.result.min).toBe(1250);
    expect(g.result.max).toBe(1650);
  });

  it("first melee cast has 0 idle (lastMeleeCastTick starts at -1)", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("greater_barge"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].result.min).toBe(750);
    expect(s.casts[0].result.max).toBe(950);
  });

  it("grants Endless Assault after 8 idle ticks and consumes on next channelled melee", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(byId("attack"), 0, false);
    ctx.performCast(byId("greater_barge"), 8, false);
    expect(ctx.getState().endlessAssaultUntilTick).toBe(18);
    // Fund the channel: attack@11 puts adrenaline at 27 so the cast is accepted.
    ctx.performCast(byId("attack"), 11, false);
    const attempt = ctx.performCast(byId("assault"), 14, false);
    expect(attempt.ok).toBe(true);
    expect(ctx.getState().endlessAssaultUntilTick).toBe(0);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(s.casts[1].result.min).toBe(1150);
    expect(s.casts[1].result.max).toBe(1510);
    expect(s.casts[3].abilityId).toBe("assault");
    expect(s.casts[3].tick).toBe(14);
  });
});

describe("simulate — ranged", () => {
  const rangedInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: RANGED_ABILITIES,
    context: { style: "ranged" },
  };

  it("deathspore arrows waive the adrenaline cost at 12 stacks", () => {
    const rotation = rotationOf(...Array(12).fill("ranged_attack"), "imbue_shadows");
    const withAmmo = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(withAmmo.ok).toBe(true);
    expect(lastCast(withAmmo).adrenalineAfter).toBe(100);

    const without = simulate({ ...rangedInput, rotation });
    expect(lastCast(without).adrenalineAfter).toBe(60);
  });

  it("searing winds adds its bonus hit inside the window only", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(
        "galeshot",
        "ranged_attack",
        "ranged_attack",
        "ranged_attack",
        "ranged_attack",
      ),
    });
    expect(s.casts[1].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[2].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[3].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[4].result.expected).toBeCloseTo(1000);
  });

  it("shadow imbued grants adrenaline per real hit — attached Searing Winds damage does not inflate the count", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(
        ...Array(5).fill("ranged_attack"),
        "imbue_shadows",
        "galeshot",
        "ranged_attack",
      ),
    });
    // The Searing Winds bonus is attached to the source hit, not a phantom second
    // hit: 1 real hit → +5 imbued adrenaline (was +10 via the phantom).
    expect(lastCast(s).result.hits).toHaveLength(1);
    expect(lastCast(s).result.hits[0].expected).toBeCloseTo(1000);
    expect(lastCast(s).result.expected).toBeCloseTo(1200);
    expect(lastCast(s).adrenalineAfter).toBe(5 + 9 + 5 + 9 + 5);
  });

  it("shadow tendrils without an active imbue grants no phantom adrenaline", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf("shadow_tendrils", "ranged_attack"),
    });
    expect(s.casts.map((c) => c.adrenalineAfter)).toEqual([0, 9]);
  });

  it("Planted Feet extends base Death's Swiftness buff window to 63 ticks", () => {
    const setup = [
      ...Array(12).fill("ranged_attack"),
      "deaths_swiftness",
      ...Array(22).fill("ranged_attack"),
    ];
    const plain = simulate({ ...rangedInput, rotation: rotationOf(...setup) });
    const pf = simulate({
      ...rangedInput,
      plantedFeet: true,
      rotation: rotationOf(...setup),
    });
    expect(plain.ok && pf.ok).toBe(true);
    const plainAt87 = findCast(
      plain,
      (cast) => cast.abilityId === "ranged_attack" && cast.tick === 87,
      "Missing plain ranged attack at tick 87",
    );
    const pfAt87 = findCast(
      pf,
      (cast) => cast.abilityId === "ranged_attack" && cast.tick === 87,
      "Missing Planted Feet ranged attack at tick 87",
    );
    expect(plainAt87.result.expected).toBeCloseTo(1000);
    expect(pfAt87.result.expected).toBeCloseTo(1500);
  });

  it("shadow tendrils crits guaranteed even at 0% crit chance", () => {
    const s = simulate({
      ...rangedInput,
      crit: { chance: 0 },
      rotation: rotationOf("shadow_tendrils"),
    });
    expect(s.casts[0].result.expected).toBeCloseTo(2200 * 1.5);
  });
});

describe("simulate — magic", () => {
  const magicInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: MAGIC_ABILITIES,
    context: { style: "magic" },
  };

  it("runic charge casts off-GCD and empowers the next dragon breath", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf("runic_charge", "magic_attack", "dragon_breath"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].tick).toBe(0);
    expect(s.casts[1].tick).toBe(0);
    expect(s.casts[2].abilityId).toBe("dragon_breath");
    expect(s.casts[2].result.expected).toBeCloseTo(2850);
    // Same basic: +9 adrenaline and the normal cooldown.
    expect(s.casts[2].adrenalineAfter).toBe(9 + 9);
  });

  it("dragon breath resolves unempowered without an active charge", () => {
    const s = simulate({ ...magicInput, rotation: rotationOf("dragon_breath") });
    expect(s.ok).toBe(true);
    expect(s.casts[0].result.expected).toBeCloseTo(1200);
  });

  it("runic charge cannot be recast inside its cooldown", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf("runic_charge", "magic_attack", "runic_charge"),
    });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("on cooldown");
  });

  it("base sunshine multiplies magic damage after the 1-tick delay", () => {
    const setup = [
      ...Array(12).fill("magic_attack"),
      "sunshine",
      "magic_attack",
      ...Array(17).fill("magic_attack"), // advance well past base 50-tick beam
    ];
    const s = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const sun = findCast(s, (cast) => cast.abilityId === "sunshine", "Missing Sunshine cast");
    expect(sun.tick).toBe(36);
    const inside = s.casts.filter((c) => c.abilityId === "magic_attack" && c.tick === 39)[0];
    expect(inside.result.expected).toBeCloseTo(1500); // 1000 × 1.5
    const outside = s.casts.filter((c) => c.abilityId === "magic_attack" && c.tick >= 87)[0];
    expect(outside).toBeDefined();
    expect(outside.result.expected).toBeCloseTo(1000);
  });

  it("greater sunshine multiplies magic damage for the longer window", () => {
    const setup = [...Array(12).fill("magic_attack"), "greater_sunshine", "magic_attack"];
    const s = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const gs = findCast(
      s,
      (cast) => cast.abilityId === "greater_sunshine",
      "Missing Greater Sunshine cast",
    );
    const next = findCast(
      s,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > gs.tick,
      "Missing magic attack after Greater Sunshine",
    );
    expect(next.result.expected).toBeCloseTo(1500);
  });

  it("Planted Feet extends base Sunshine buff window to 63 ticks", () => {
    const setup = [
      ...Array(12).fill("magic_attack"),
      "sunshine",
      ...Array(22).fill("magic_attack"), // GCDs: 39,42,...,102
    ];
    const plain = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    const pf = simulate({
      ...magicInput,
      plantedFeet: true,
      rotation: rotationOf(...setup),
    });
    expect(plain.ok && pf.ok).toBe(true);
    const plainAt87 = findCast(
      plain,
      (cast) => cast.abilityId === "magic_attack" && cast.tick === 87,
      "Missing plain magic attack at tick 87",
    );
    const pfAt87 = findCast(
      pf,
      (cast) => cast.abilityId === "magic_attack" && cast.tick === 87,
      "Missing Planted Feet magic attack at tick 87",
    );
    expect(plainAt87.result.expected).toBeCloseTo(1000);
    expect(pfAt87.result.expected).toBeCloseTo(1500);
    const pfAt99 = findCast(
      pf,
      (cast) => cast.abilityId === "magic_attack" && cast.tick === 99,
      "Missing Planted Feet magic attack at tick 99",
    );
    expect(pfAt99.result.expected).toBeCloseTo(1000);
  });

  it("Planted Feet does not extend Greater Sunshine", () => {
    const setup = [...Array(12).fill("magic_attack"), "greater_sunshine", "magic_attack"];
    const plain = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    const pf = simulate({
      ...magicInput,
      plantedFeet: true,
      rotation: rotationOf(...setup),
    });
    const plainSunshine = findCast(
      plain,
      (cast) => cast.abilityId === "greater_sunshine",
      "Missing plain Greater Sunshine cast",
    );
    const plantedSunshine = findCast(
      pf,
      (cast) => cast.abilityId === "greater_sunshine",
      "Missing Planted Feet Greater Sunshine cast",
    );
    const plainNext = findCast(
      plain,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > plainSunshine.tick,
      "Missing plain follow-up magic attack",
    );
    const pfNext = findCast(
      pf,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > plantedSunshine.tick,
      "Missing Planted Feet follow-up magic attack",
    );
    expect(plainNext.result.expected).toBeCloseTo(pfNext.result.expected);
  });

  it("instability adds Lightning Surge EV on magic crits (not on 0% crit)", () => {
    const fund = [...Array(6).fill("magic_attack"), "instability", "magic_attack"];
    const noCrit = simulate({
      ...magicInput,
      crit: { chance: 0 },
      rotation: rotationOf(...fund),
    });
    expect(noCrit.ok).toBe(true);
    const inst = findCast(
      noCrit,
      (cast) => cast.abilityId === "instability",
      "Missing Instability cast",
    );
    expect(inst.result.expected).toBeCloseTo(1300);
    const follow = findCast(
      noCrit,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > inst.tick,
      "Missing magic attack after Instability",
    );
    expect(follow.result.expected).toBeCloseTo(1000);

    const allCrit = simulate({
      ...magicInput,
      crit: { chance: 1 },
      rotation: rotationOf(...fund),
    });
    const instCrit = findCast(
      allCrit,
      (cast) => cast.abilityId === "instability",
      "Missing crit Instability cast",
    );
    // The granting cast's own hit predates the buff: it crits but fires no surge.
    expect(instCrit.result.expected).toBeCloseTo(1950); // 120-140% band × 1.5 crit
    expect(allCrit.damageByTick[instCrit.tick + 1]).toBeUndefined();

    // A magic hit while the buff is active fires a surge 1 tick after the source hit.
    const followCrit = findCast(
      allCrit,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > instCrit.tick,
      "Missing crit follow-up magic attack",
    );
    expect(followCrit.result.expected).toBeCloseTo(2700); // 1500 crit hit + 1200 surge EV
    expect(allCrit.damageByTick[followCrit.tick + 1]).toBeCloseTo(1200);
  });
});

describe("simulate auto-weave", () => {
  it("weaves basics through an adrenaline shortfall instead of failing", () => {
    const s = simulate({ ...baseInput, autoWeave: true, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(true);
    expect(s.casts).toHaveLength(8);
    expect(s.casts.slice(0, 7).every((c) => c.abilityId === "attack" && c.auto)).toBe(true);
    expect(s.casts[7].abilityId).toBe("overpower");
    expect(s.casts[7].tick).toBe(21);
    expect(s.casts[7].adrenalineAfter).toBe(63 - 60);
    expect(s.casts[7].auto).toBeUndefined();
  });

  it("manual mode still fails the same shortfall honestly", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("overpower needs 60% adrenaline");
  });

  it("weaves through cooldown gaps and builds Bloodlust from the woven basics", () => {
    const s = simulate({
      ...baseInput,
      autoWeave: true,
      rotation: rotationOf("assault", "assault"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "attack@0",
      "attack@3",
      "attack@6",
      "assault@9",
      "attack@17",
      "attack@20",
      "attack@23",
      "assault@26",
    ]);
    expect(s.casts[3].result.expected).toBeCloseTo(4 * 1400);
    expect(s.casts[7].result.expected).toBeCloseTo(4 * 1800);
  });

  it("weaves the upcoming style's own basic", () => {
    const s = simulate({
      ...baseInput,
      abilities: RANGED_ABILITIES,
      autoWeave: true,
      rotation: rotationOf("imbue_shadows"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.slice(0, 5).every((c) => c.abilityId === "ranged_attack" && c.auto)).toBe(true);
    expect(lastCast(s).abilityId).toBe("imbue_shadows");
    expect(lastCast(s).tick).toBe(15);
    expect(lastCast(s).adrenalineAfter).toBe(45 - 40);
  });

  it("stops with an honest error when no weave can ever afford the cast", () => {
    const impossible = {
      id: "impossible_ult",
      name: "Impossible ult",
      style: "melee" as const,
      category: "ultimate" as const,
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 101 },
    };
    const s = simulate({
      ...baseInput,
      abilities: [...MELEE_ABILITIES, impossible],
      autoWeave: true,
      rotation: rotationOf("impossible_ult"),
    });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("unaffordable");
  });
});

describe("simulate — necromancy resources", () => {
  const necroAbilities = [...NECROMANCY_ABILITIES, volleyOfSouls(3)];
  const necroInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: necroAbilities,
    context: { style: "necromancy" },
  };

  it("Soul Sap builds residual souls and Soul Strike spends one", () => {
    const ctx = createCastContext(necroInput);
    const soulSap = abilityById(NECROMANCY_ABILITIES, "soul_sap");
    ctx.performCast(soulSap, 0, false);
    expect(ctx.getState().necro.residualSouls).toBe(1);
    ctx.performCast(soulSap, 3, false);
    expect(ctx.getState().necro.residualSouls).toBe(2);
    ctx.performCast(abilityById(NECROMANCY_ABILITIES, "soul_strike"), 6, false);
    expect(ctx.getState().necro.residualSouls).toBe(1);
  });

  it("fails Soul Strike without residual souls", () => {
    const s = simulate({ ...necroInput, rotation: rotationOf("soul_strike") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("residual souls");
  });

  it("Touch of Death builds Necrosis; FoD discounts cost and spends stacks", () => {
    const ctx = createCastContext(necroInput);
    const tod = abilityById(NECROMANCY_ABILITIES, "touch_of_death");
    const fod = abilityById(NECROMANCY_ABILITIES, "finger_of_death");
    ctx.performCast(tod, 0, false);
    ctx.performCast(tod, 3, false);
    expect(ctx.getState().necro.necrosisStacks).toBe(8);
    expect(ctx.costOf(fod)).toBe(0);
    ctx.performCast(fod, 6, false);
    expect(ctx.getState().necro.necrosisStacks).toBe(2);

    const s = simulate({
      ...necroInput,
      rotation: rotationOf("touch_of_death", "touch_of_death", "finger_of_death"),
    });
    expect(s.ok).toBe(true);
    expect(lastCast(s).result.expected).toBeCloseTo(3000);
  });

  it("Volley spends all souls and deals one hit per residual soul held", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf("soul_sap", "soul_sap", "soul_sap", "volley_of_souls"),
    });
    expect(s.ok).toBe(true);
    expect(lastCast(s).result.expected).toBeCloseTo(3 * 1500);
    const ctx = createCastContext(necroInput);
    const sap = abilityById(NECROMANCY_ABILITIES, "soul_sap");
    for (let i = 0; i < 3; i++) ctx.performCast(sap, i * 3, false);
    ctx.performCast(volleyOfSouls(3), 9, false);
    expect(ctx.getState().necro.residualSouls).toBe(0);
  });

  it("Living Death resets ToD/DS CDs, buffs FoD, and shortens Death Skulls CD", () => {
    const ctx = createCastContext(necroInput);
    const basic = abilityById(NECROMANCY_ABILITIES, "necromancy_basic");
    const tod = abilityById(NECROMANCY_ABILITIES, "touch_of_death");
    const ld = abilityById(NECROMANCY_ABILITIES, "living_death");
    const fod = abilityById(NECROMANCY_ABILITIES, "finger_of_death");
    const ds = abilityById(NECROMANCY_ABILITIES, "death_skulls");

    for (let i = 0; i < 12; i++) ctx.performCast(basic, i * 3, false);
    ctx.performCast(tod, 36, false);
    expect(ctx.getState().cooldowns["touch_of_death"]).toBeGreaterThan(ctx.getState().tick);
    expect(ctx.getState().necro.necrosisStacks).toBe(4);

    ctx.performCast(ld, 39, false);
    expect(ctx.getState().necro.livingDeathUntilTick).toBeGreaterThan(39);
    expect(ctx.getState().cooldowns["touch_of_death"]).toBeUndefined();
    expect(ctx.getState().cooldowns["death_skulls"]).toBeUndefined();

    ctx.performCast(basic, 42, false);
    expect(ctx.getState().necro.necrosisStacks).toBe(6);

    ctx.performCast(fod, 45, false);
    expect(ctx.getState().necro.necrosisStacks).toBe(0);

    for (let i = 0; i < 7; i++) ctx.performCast(basic, 48 + i * 3, false);
    const dsTick = 48 + 7 * 3;
    ctx.performCast(ds, dsTick, false);
    expect(ctx.getState().cooldowns["death_skulls"]).toBe(
      dsTick + DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS,
    );
  });

  it("Living Death multiplies Finger of Death damage in the full sim path", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf(
        ...Array(12).fill("necromancy_basic"),
        "touch_of_death",
        "living_death",
        "necromancy_basic",
        "finger_of_death",
      ),
    });
    expect(s.ok).toBe(true);
    const fodCast = findCast(
      s,
      (cast) => cast.abilityId === "finger_of_death",
      "Missing Finger of Death cast",
    );
    expect(fodCast.result.expected).toBeCloseTo(4500);
  });

  it("conjure skeleton summons and spirit autos contribute EV (never crit)", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf("conjure_skeleton_warrior", ...Array(20).fill("necromancy_basic")),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].abilityId).toBe("conjure_skeleton_warrior");
    expect(s.casts[0].result.expected).toBe(0);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    expect(s.damageByTick[7]).toBeGreaterThan(0);
    expect(s.totalExpected).toBeGreaterThan(s.casts.reduce((n, c) => n + c.result.expected, 0));
  });

  it("First Necromancer conjureBasicDamageMult scales spirit basic autos (not poison)", () => {
    const rot = rotationOf("conjure_skeleton_warrior", ...Array(20).fill("necromancy_basic"));
    const base = simulate({ ...necroInput, rotation: rot });
    const boosted = simulate({
      ...necroInput,
      rotation: rot,
      conjureBasicDamageMult: 1.35, // 5-piece First Necro
    });
    expect(base.ok && boosted.ok).toBe(true);
    const baseSpirit = base.perAbility["spirit_skeleton_warrior"] ?? 0;
    const boostSpirit = boosted.perAbility["spirit_skeleton_warrior"] ?? 0;
    expect(baseSpirit).toBeGreaterThan(0);
    expect(boostSpirit / baseSpirit).toBeCloseTo(1.35, 5);

    const zRot = rotationOf("conjure_putrid_zombie", ...Array(12).fill("necromancy_basic"));
    const zBase = simulate({ ...necroInput, rotation: zRot });
    const zBoost = simulate({ ...necroInput, rotation: zRot, conjureBasicDamageMult: 1.35 });
    const poisonBase = zBase.perAbility["spirit_putrid_zombie_poison"] ?? 0;
    const poisonBoost = zBoost.perAbility["spirit_putrid_zombie_poison"] ?? 0;
    expect(poisonBase).toBeGreaterThan(0);
    expect(poisonBoost / poisonBase).toBeCloseTo(1, 5);
    const autoBase = zBase.perAbility["spirit_putrid_zombie"] ?? 0;
    const autoBoost = zBoost.perAbility["spirit_putrid_zombie"] ?? 0;
    expect(autoBase).toBeGreaterThan(0);
    expect(autoBoost / autoBase).toBeCloseTo(1.35, 5);
  });

  it("command skeleton requires an active conjure", () => {
    const blocked = simulate({
      ...necroInput,
      rotation: rotationOf("command_skeleton_warrior"),
    });
    expect(blocked.ok).toBe(false);

    const ok = simulate({
      ...necroInput,
      rotation: rotationOf("conjure_skeleton_warrior", "command_skeleton_warrior"),
    });
    expect(ok.ok).toBe(true);
    expect(lastCast(ok).abilityId).toBe("command_skeleton_warrior");
    expect(lastCast(ok).result.hits.every((h) => h.critChance === 0)).toBe(true);
  });

  it("conjure undead army summons three spirits with auto EV", () => {
    const ctx = createCastContext(necroInput);
    const army = abilityById(NECROMANCY_ABILITIES, "conjure_undead_army");
    ctx.performCast(army, 0, false);
    const ids = ctx
      .getState()
      .conjures.spirits.map((s) => s.id)
      .sort();
    expect(ids).toEqual(["putrid_zombie", "skeleton_warrior", "vengeful_ghost"]);

    const s = simulate({
      ...necroInput,
      rotation: rotationOf("conjure_undead_army", ...Array(15).fill("necromancy_basic")),
    });
    expect(s.ok).toBe(true);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    expect(s.perAbility["spirit_vengeful_ghost"]).toBeGreaterThan(0);
    expect(s.perAbility["spirit_putrid_zombie"]).toBeGreaterThan(0);
  });
});

describe("simulate — channel occupancy (manual completes channels)", () => {
  it("Assault then another ability: the follow-up starts at castTick+8, not +3, with full channel damage", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 17]);
    expect(s.perAbility["assault"]).toBeCloseTo(4 * 1400);
    const assaultEvents = s.events.filter((e) => e.abilityId === "assault");
    expect(assaultEvents.map((e) => e.tick)).toEqual([10, 12, 14, 16]);
    expect(assaultEvents.every((e) => e.family === "hit" && !e.attached)).toBe(true);
  });

  it("Rapid Fire then another ability: follow-up at castTick+8 with full channel damage", () => {
    const s = simulate({
      ...baseInput,
      abilities: RANGED_ABILITIES,
      context: { style: "ranged" },
      rotation: rotationOf(
        "ranged_attack",
        "ranged_attack",
        "ranged_attack",
        "rapid_fire",
        "ranged_attack",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 17]);
    expect(s.perAbility["rapid_fire"]).toBeCloseTo(8 * 800);
  });

  it("Asphyxiate then another ability: follow-up at castTick+7 with full channel damage", () => {
    const s = simulate({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      rotation: rotationOf(
        "magic_attack",
        "magic_attack",
        "magic_attack",
        "asphyxiate",
        "magic_attack",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 16]);
    expect(s.perAbility["asphyxiate"]).toBeCloseTo(4 * 1300);
  });
});

describe("simulate — atomic cast transition", () => {
  it("a rejected cast (insufficient adrenaline) leaves state byte-identical", () => {
    const ctx = createCastContext(baseInput);
    ctx.performCast(abilityById(MELEE_ABILITIES, "attack"), 0, false);
    ctx.performCast(abilityById(MELEE_ABILITIES, "attack"), 3, false);
    const before = JSON.stringify(ctx.getState());
    const attempt = ctx.performCast(abilityById(MELEE_ABILITIES, "overpower"), 6, false);
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error).toContain("adrenaline");
    expect(JSON.stringify(ctx.getState())).toBe(before);
    const s = ctx.finish();
    expect(s.casts).toHaveLength(2);
  });

  it("a rejected cast (unmet residual-soul requirement) leaves state byte-identical", () => {
    const ctx = createCastContext({
      ...baseInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    });
    const before = JSON.stringify(ctx.getState());
    const attempt = ctx.performCast(abilityById(NECROMANCY_ABILITIES, "soul_strike"), 0, false);
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error).toContain("residual souls");
    expect(JSON.stringify(ctx.getState())).toBe(before);
    expect(ctx.finish().casts).toHaveLength(0);
  });

  it("advance-then-check: waiting out a cooldown under Meteor Strike's passive makes the repeat cast affordable", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        ...Array(7).fill("attack"),
        "meteor_strike",
        "attack",
        "attack",
        "overpower",
        "overpower",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 80]);
    const repeat = lastCast(s);
    expect(repeat.abilityId).toBe("overpower");
    // 24% at tick 33 → 100% after the passive-covered wait to the 50-tick cooldown.
    expect(repeat.tick).toBe(80);
  });
});

describe("simulate — event log", () => {
  it("is deterministic and orders same-tick events by (tick, seq) in hit-index order", () => {
    const rotation = rotationOf("attack", "adaptive_strike_dw", "attack", "dismember");
    const a = simulate({ ...baseInput, rotation });
    const b = simulate({ ...baseInput, rotation });
    expect(a.events).toEqual(b.events);
    expect(a).toEqual(b);
    const dw = a.events.filter((e) => e.abilityId === "adaptive_strike_dw");
    expect(dw.map((e) => e.tick)).toEqual([3, 3]);
    expect(dw[0].hitIndex).toBe(0);
    expect(dw[1].hitIndex).toBe(1);
    expect(dw[0].seq).toBeLessThan(dw[1].seq);
  });

  it("reconciles per cast: non-attached hit/dot events sum to that cast's hit damage", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault", "dismember"),
    });
    expect(s.ok).toBe(true);
    s.casts.forEach((cast, i) => {
      const owned = s.events.filter(
        (e) => e.sourceCast === i && e.family !== "proc" && !e.attached,
      );
      const eventSum = owned.reduce((n, e) => n + e.damage.expected, 0);
      expect(cast.result.expected).toBeCloseTo(eventSum, 10);
      expect(cast.result.min).toBeCloseTo(
        owned.reduce((n, e) => n + e.damage.min, 0),
        10,
      );
      expect(cast.result.max).toBeCloseTo(
        owned.reduce((n, e) => n + e.damage.max, 0),
        10,
      );
      expect(cast.result.hits.reduce((n, h) => n + h.expected, 0)).toBeCloseTo(eventSum, 10);
    });
  });

  it("folds Searing Winds into the source hit event — no separate event, and Galeshot never rides its own buff", () => {
    const s = simulate({
      ...baseInput,
      abilities: RANGED_ABILITIES,
      context: { style: "ranged" },
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    expect(s.ok).toBe(true);
    const galeshot = s.events.filter((e) => e.abilityId === "galeshot");
    expect(galeshot).toHaveLength(1);
    expect(galeshot[0].damage.expected).toBeCloseTo(1000);
    const attack = s.events.filter((e) => e.abilityId === "ranged_attack");
    expect(attack).toHaveLength(1);
    expect(attack[0].family).toBe("hit");
    expect(attack[0].attached).toBe(false);
    expect(attack[0].damage.expected).toBeCloseTo(1200);
    // The attached +20% is in the event damage but not in the real hit's own roll.
    expect(s.casts[1].result.hits[0].expected).toBeCloseTo(1000);
    expect(s.casts[1].result.expected).toBeCloseTo(1200);
  });

  it("schedules Instability's Lightning Surge as a proc event at sourceHitTick+1 (EV, non-recursive)", () => {
    const s = simulate({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      crit: { chance: 1 },
      rotation: rotationOf(...Array(6).fill("magic_attack"), "instability", "magic_attack"),
    });
    expect(s.ok).toBe(true);
    const instabilitySeq = s.casts.findIndex((c) => c.abilityId === "instability");
    const followSeq = s.casts.findIndex((c, i) => i > instabilitySeq);
    // The granting cast fires no surge: exactly one hit event, no proc.
    expect(s.events.filter((e) => e.sourceCast === instabilitySeq).map((e) => e.family)).toEqual([
      "hit",
    ]);
    const followEvents = s.events.filter((e) => e.sourceCast === followSeq);
    expect(followEvents.map((e) => e.family)).toEqual(["hit", "proc"]);
    const surge = followEvents[1];
    expect(surge.tick).toBe(s.casts[followSeq].tick + 1);
    expect(surge.procEligible).toBe(false);
    expect(surge.recursionAllowed).toBe(false);
    expect(surge.damage.expected).toBeCloseTo(1200);
    expect(surge.damage.min).toBe(0);
    expect(surge.damage.max).toBe(0);
    // Hit events reconcile with the cast record; the surge EV lands in expected.
    expect(s.casts[followSeq].result.expected).toBeCloseTo(2700);
    expect(s.casts[followSeq].result.hits).toHaveLength(1);
    expect(s.damageByTick[s.casts[followSeq].tick + 1]).toBeCloseTo(1200);
  });

  it("clips Bloodlust stacks when Berserk expires mid-wait, at the boundary tick", () => {
    const ctx = createCastContext(baseInput);
    const attack = abilityById(MELEE_ABILITIES, "attack");
    for (let i = 0; i < 12; i++) ctx.performCast(attack, i * 3, false);
    ctx.performCast(abilityById(MELEE_ABILITIES, "berserk"), 36, false);
    expect(ctx.getState().melee.stacks).toBe(8);
    expect(ctx.getState().berserkUntilTick).toBe(69);
    for (let t = 39; t <= 63; t += 3) ctx.performCast(attack, t, false);
    // Still inside the window at tick 66: no clip.
    expect(ctx.getState().tick).toBe(66);
    expect(ctx.getState().melee.stacks).toBe(8);
    expect(ctx.getState().melee.berserk).toBe(true);
    ctx.performCast(attack, 66, false);
    // The occupancy advance crosses tick 69 (the exclusive end): stacks clip to the base cap.
    expect(ctx.getState().tick).toBe(69);
    expect(ctx.getState().melee.berserk).toBe(false);
    expect(ctx.getState().melee.stacks).toBe(4);
    expect(ctx.getState().berserkUntilTick).toBe(0);
  });
});

describe("simulate — Bloodlust spend lifecycle", () => {
  it("an empowered Assault consumes 4 stacks atomically; the next spender rebuilds first", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().melee.stacks).toBe(4);
    expect(ctx.performCast(assault, ctx.firstLegalTick("assault"), false).ok).toBe(true);
    expect(ctx.getState().melee.stacks).toBe(0);
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().melee.stacks).toBe(3);
    expect(ctx.performCast(assault, ctx.firstLegalTick("assault"), false).ok).toBe(true);
    expect(ctx.getState().melee.stacks).toBe(3); // unempowered: no spend
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(4 * 1800); // empowered 170-190
    expect(s.casts[8].result.expected).toBeCloseTo(4 * 1400); // normal 130-150
  });

  it("an empowered Hurricane appends its sourced extra hit and spends 4 stacks", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(hurricane, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.stacks).toBe(0);
    const s = ctx.finish();
    const cast = lastCast(s);
    expect(cast.result.hits).toHaveLength(3);
    expect(cast.result.expected).toBeCloseTo(1500 + 1700 + 850);
    const events = s.events.filter((e) => e.abilityId === "hurricane");
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.hitIndex)).toEqual([0, 1, 2]);
    expect(events.every((e) => e.procEligible && !e.attached)).toBe(true);
  });

  it("an unempowered Hurricane keeps its two hits and its stacks", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(hurricane, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.stacks).toBe(3); // below threshold: no spend
    const s = ctx.finish();
    expect(lastCast(s).result.hits).toHaveLength(2);
    expect(lastCast(s).result.expected).toBeCloseTo(1500 + 1700);
  });

  it("an empowered Flurry scales with target missing LP when HP is provided", () => {
    const rotation = rotationOf("attack", "attack", "attack", "attack", "flurry");
    const low = simulate({ ...baseInput, targetHpPercent: 30, rotation });
    // 70% missing LP capped to +65%: 8 hits × 650 × 1.65.
    expect(lastCast(low).result.expected).toBeCloseTo(8 * 650 * 1.65);
    const full = simulate({ ...baseInput, targetHpPercent: 100, rotation });
    expect(lastCast(full).result.expected).toBeCloseTo(8 * 650);
  });

  it("an empowered Flurry without target HP spends stacks but invents no bonus", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const flurry = ctx.byId.get("flurry")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(flurry, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.stacks).toBe(0);
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(8 * 650);
  });
});

describe("simulate — next-hit effect scope", () => {
  it("Greater Fury guarantees only the first hit of a channel", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("attack", "attack", "greater_fury", "assault"),
    });
    expect(s.ok).toBe(true);
    const assault = lastCast(s);
    expect(assault.result.expected).toBeCloseTo(2100 + 3 * 1400);
    expect(assault.result.hits[0].critChance).toBe(1);
    expect(assault.result.hits[1].critChance).toBe(0);
  });

  it("Greater Fury guarantees exactly one hit of a non-channelled multihit", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("attack", "attack", "greater_fury", "hurricane"),
    });
    expect(lastCast(s).result.expected).toBeCloseTo(2250 + 1700);
  });

  it("Greater Fury expires at the 15s window boundary", () => {
    const ctx = createCastContext(baseInput);
    const greaterFury = ctx.byId.get("greater_fury")!;
    const attack = ctx.byId.get("attack")!;
    ctx.performCast(greaterFury, 0, false);
    expect(ctx.getState().greaterFuryUntilTick).toBe(25);
    ctx.performCast(attack, 24, false); // inside the window
    ctx.performCast(greaterFury, ctx.getState().tick, false); // recast: new window from cast tick
    const secondWindow = ctx.getState().greaterFuryUntilTick;
    ctx.performCast(attack, secondWindow, false); // exactly at its end: expired
    const s = ctx.finish();
    expect(s.casts[1].result.expected).toBeCloseTo(1800);
    expect(s.casts[3].result.expected).toBeCloseTo(1200);
  });

  it("Fury's +25% applies to a channel's first hit only", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("attack", "attack", "fury", "assault"),
    });
    expect(s.ok).toBe(true);
    const assault = lastCast(s);
    expect(assault.result.hits[0].critChance).toBeCloseTo(0.25);
    expect(assault.result.hits[1].critChance).toBe(0);
    expect(assault.result.expected).toBeCloseTo(1575 + 3 * 1400);
  });

  it("Chaos Roar multiplies only the first hit of a channel", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "chaos_roar", "assault"),
    });
    expect(lastCast(s).result.expected).toBeCloseTo(1400 * 1.75 + 3 * 1400);
  });

  it("Chaos Roar multiplies every hit of a non-channelled multihit", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "chaos_roar", "hurricane"),
    });
    // floor-per-stage rounding: (2362+2887)/2 + (2712+3237)/2
    expect(lastCast(s).result.expected).toBeCloseTo(2624.5 + 2974.5);
  });

  it("Chaos Roar also boosts bleed ticks", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("chaos_roar", "dismember") });
    expect(s.ok).toBe(true);
    // floor-per-stage rounding: (498 + 551) / 2
    for (let t = 5; t <= 19; t += 2) expect(s.damageByTick[t]).toBeCloseTo(524.5);
  });

  it("Chaos Roar expires at the 7.2s window boundary", () => {
    const ctx = createCastContext(baseInput);
    const chaosRoar = ctx.byId.get("chaos_roar")!;
    const attack = ctx.byId.get("attack")!;
    ctx.performCast(chaosRoar, 0, false);
    expect(ctx.getState().chaosRoarUntilTick).toBe(12);
    ctx.performCast(attack, 11, false); // inside the window
    ctx.performCast(chaosRoar, ctx.getState().tick, false);
    const secondWindow = ctx.getState().chaosRoarUntilTick;
    ctx.performCast(attack, secondWindow, false); // exactly at its end: expired
    const s = ctx.finish();
    expect(s.casts[1].result.expected).toBeCloseTo(1200 * 1.75);
    expect(s.casts[3].result.expected).toBeCloseTo(1200); // expired: half-open window
  });
});

describe("simulate — Deathspore lifecycle", () => {
  const rangedInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: RANGED_ABILITIES,
    context: { style: "ranged" },
  };

  it("a free cast outside the 15-tick window pays full cost", () => {
    // 12th stack lands at tick 33 → buff until 48; imbue at 54 is past it.
    const rotation = rotationOf(...Array(18).fill("ranged_attack"), "imbue_shadows");
    const s = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(s.ok).toBe(true);
    expect(lastCast(s).adrenalineAfter).toBe(100 - 40);
  });

  it("the free cast still needs the adrenaline on hand", () => {
    // 6 attacks (54 adrenaline, 6 stacks) → Rapid Fire drains 25 and its hits
    // build stacks 7-12; the buff opens at tick 23 with only 29 on hand, so
    // the free-but-40-cost imbue at 26 is rejected (wiki: "the player still
    // needs the necessary adrenaline in order to cast it").
    const broke = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf(...Array(6).fill("ranged_attack"), "rapid_fire", "imbue_shadows"),
    });
    expect(broke.ok).toBe(false);
    expect(broke.error).toContain("imbue_shadows needs 40% adrenaline");
    // With enough adrenaline rebuilt inside the window, the same cast spends 0.
    const funded = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf(
        ...Array(6).fill("ranged_attack"),
        "rapid_fire",
        ...Array(3).fill("ranged_attack"),
        "imbue_shadows",
      ),
    });
    expect(funded.ok).toBe(true);
    expect(lastCast(funded).adrenalineAfter).toBe(29 + 27); // spend 0
  });

  it("stacks cannot rebuild during the 50-tick cooldown, then build again", () => {
    const ctx = createCastContext({ ...rangedInput, ammo: "deathspore" });
    const attack = ctx.byId.get("ranged_attack")!;
    for (let i = 0; i < 12; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().ranged.deathspore.freeCastUntilTick).toBe(33 + 15);
    expect(ctx.getState().ranged.deathspore.cooldownUntilTick).toBe(33 + 50);
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().ranged.deathspore.stacks).toBe(0); // cooldown rejects
    ctx.advanceTo(83);
    ctx.performCast(attack, 83, false);
    expect(ctx.getState().ranged.deathspore.stacks).toBe(1); // building again
  });

  it("the free cast consumes the buff; the next spender pays again", () => {
    const rotation = rotationOf(
      ...Array(12).fill("ranged_attack"),
      "imbue_shadows",
      ...Array(20).fill("ranged_attack"),
      "imbue_shadows",
    );
    const s = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(s.ok).toBe(true);
    const imbues = s.casts.filter((c) => c.abilityId === "imbue_shadows");
    expect(imbues[0].adrenalineAfter).toBe(100); // free: spend 0
    // Second imbue: 20 more attacks cannot retrigger the buff before tick 83,
    // and 12 fresh stacks need 36 ticks of attacks after it — full price.
    expect(imbues[1].adrenalineAfter).toBe(100 - 40);
  });
});

describe("simulate — Searing Winds cast-time eligibility and Rapid Fire extension", () => {
  const rangedInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: RANGED_ABILITIES,
    context: { style: "ranged" },
  };

  it("a channel cast inside the window keeps the bonus on hits landing after expiry", () => {
    const ctx = createCastContext(rangedInput);
    const galeshot = ctx.byId.get("galeshot")!;
    const attack = ctx.byId.get("ranged_attack")!;
    const rapidFire = ctx.byId.get("rapid_fire")!;
    ctx.performCast(galeshot, 0, false); // Searing Winds until tick 10
    ctx.performCast(attack, 3, false);
    ctx.performCast(attack, 6, false);
    expect(ctx.performCast(rapidFire, 9, false).ok).toBe(true);
    const s = ctx.finish();
    expect(s.casts[0].result.expected).toBeCloseTo(1000); // Galeshot precludes its own buff
    const rf = s.casts[3];
    expect(rf.result.hits).toHaveLength(8); // attached, not phantom hits
    expect(rf.result.expected).toBeCloseTo(8 * (800 + 200));
  });

  it("each landed Rapid Fire hit extends the buff one tick; the next ability rides the extension", () => {
    const ctx = createCastContext(rangedInput);
    const galeshot = ctx.byId.get("galeshot")!;
    const attack = ctx.byId.get("ranged_attack")!;
    const rapidFire = ctx.byId.get("rapid_fire")!;
    ctx.performCast(galeshot, 0, false);
    ctx.performCast(attack, 3, false);
    ctx.performCast(attack, 6, false);
    ctx.performCast(rapidFire, 9, false);
    expect(ctx.getState().ranged.searingWinds.expiresAtTick).toBe(18);
    ctx.performCast(attack, 17, false); // inside the extended window
    ctx.performCast(attack, 20, false); // outside it
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[5].result.expected).toBeCloseTo(1000);
  });
});

describe("simulate — conjure Damage Potential and modifier routing", () => {
  const necroAbilities = [...NECROMANCY_ABILITIES, volleyOfSouls(3)];
  const necroInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: necroAbilities,
    context: { style: "necromancy" },
  };

  it("spirit autos always deal 100% of their damage potential", () => {
    const rotation = rotationOf("conjure_skeleton_warrior", ...Array(10).fill("necromancy_basic"));
    const full = simulate({ ...necroInput, rotation });
    const halved = simulate({ ...necroInput, accuracy: 0.5, rotation });
    expect(halved.perAbility["spirit_skeleton_warrior"]).toBeCloseTo(
      full.perAbility["spirit_skeleton_warrior"]!,
      10,
    );
    // The player's own hits still scale with their Damage Potential.
    expect(halved.perAbility["necromancy_basic"]).toBeCloseTo(
      full.perAbility["necromancy_basic"]! / 2,
      10,
    );
  });

  it("commands also use full damage potential", () => {
    const rotation = rotationOf(
      "conjure_skeleton_warrior",
      "command_skeleton_warrior",
      ...Array(6).fill("necromancy_basic"),
    );
    const full = simulate({ ...necroInput, rotation });
    const halved = simulate({ ...necroInput, accuracy: 0.5, rotation });
    expect(halved.perAbility["command_skeleton_warrior"]).toBeCloseTo(
      full.perAbility["command_skeleton_warrior"]!,
      10,
    );
  });

  const globalBuff: CombatModifier = {
    id: "test:global",
    stage: "onCast",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1.1) }),
    source: MODERNISATION_WIKI,
  };
  const prayerBuff: CombatModifier = {
    id: "prayer:test",
    stage: "ability",
    priority: 10,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1.2) }),
    source: MODERNISATION_WIKI,
  };

  it("spirit autos take global modifiers but never the player's prayers", () => {
    const rotation = rotationOf("conjure_skeleton_warrior", ...Array(10).fill("necromancy_basic"));
    const plain = simulate({ ...necroInput, rotation });
    const buffed = simulate({ ...necroInput, modifiers: [globalBuff], rotation });
    const prayed = simulate({ ...necroInput, modifiers: [globalBuff, prayerBuff], rotation });
    const spirit = (s: RotationSummary) => s.perAbility["spirit_skeleton_warrior"] ?? 0;
    expect(spirit(buffed)).toBeGreaterThan(spirit(plain));
    expect(spirit(prayed)).toBeCloseTo(spirit(buffed), 10);
  });

  it("array and function modifier forms give spirits identical damage (manual/Revolution parity)", () => {
    const rotation = rotationOf("conjure_skeleton_warrior", ...Array(10).fill("necromancy_basic"));
    const asArray = simulate({ ...necroInput, modifiers: [globalBuff], rotation });
    const asFunction = simulate({ ...necroInput, modifiers: () => [globalBuff], rotation });
    expect(asFunction.perAbility["spirit_skeleton_warrior"]).toBeCloseTo(
      asArray.perAbility["spirit_skeleton_warrior"]!,
      10,
    );
    expect(asFunction.totalExpected).toBeCloseTo(asArray.totalExpected, 10);
  });
});

describe("simulate — Command Skeleton Warrior scheduling", () => {
  const necroAbilities = [...NECROMANCY_ABILITIES, volleyOfSouls(3)];
  const necroInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: necroAbilities,
    context: { style: "necromancy" },
  };

  function skeletonEvents(s: RotationSummary) {
    return {
      autos: s.events.filter((e) => e.family === "conjureAuto"),
      commands: s.events.filter((e) => e.family === "command"),
    };
  }

  it("the command is locked for 6 ticks after summoning (initial 3.6s cooldown)", () => {
    const ctx = createCastContext(necroInput);
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    expect(ctx.firstLegalTick("command_skeleton_warrior")).toBe(6);
  });

  it("wiki example: command at 6 — RAAAR auto at 7, hits 8-17, autos resume 19, 24", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    ctx.performCast(
      ctx.byId.get("command_skeleton_warrior")!,
      ctx.firstLegalTick("command_skeleton_warrior"),
      false,
    );
    expect(ctx.getState().tick).toBe(9);
    while (ctx.getState().tick <= 26) ctx.performCast(basic, ctx.getState().tick, false);
    // Rage after the resumed auto at 24: 1 (auto at 7) + 10 (command) + 2 (autos).
    expect(ctx.getState().conjures.spirits[0].rageStacks).toBe(13);
    const s = ctx.finish();
    const { autos, commands } = skeletonEvents(s);
    expect(autos.map((e) => e.tick).slice(0, 3)).toEqual([7, 19, 24]);
    expect(autos.some((e) => e.tick === 12 || e.tick === 17)).toBe(false); // suppressed
    expect(commands.map((e) => e.tick)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(commands.map((e) => e.hitIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Rage: auto at 7 deals the plain 250 band; each command hit builds a stack
    // (damage first), so the 19-tick auto lands at 11 stacks (1.33x).
    expect(autos[0].damage.expected).toBeCloseTo(250);
    expect(commands[0].damage.expected).toBeCloseTo(257);
    expect(autos[1].damage.expected).toBeCloseTo(332);
  });

  it("wiki example: command at 11 — auto on the RAAAR tick fires, mid-command autos suppressed", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    for (let i = 0; i < 2; i++) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("command_skeleton_warrior")!, 11, false);
    while (ctx.getState().tick <= 30) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    const { autos, commands } = skeletonEvents(s);
    // Autos at 7 and 12 (the RAAAR tick) fire; 17/22 are suppressed; resume 24.
    expect(autos.map((e) => e.tick).slice(0, 4)).toEqual([7, 12, 24, 29]);
    expect(commands.map((e) => e.tick)).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  });

  it("a repeat command mutates the schedule again (25-tick cooldown)", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    ctx.performCast(
      ctx.byId.get("command_skeleton_warrior")!,
      ctx.firstLegalTick("command_skeleton_warrior"),
      false,
    );
    expect(ctx.firstLegalTick("command_skeleton_warrior")).toBe(31);
    while (ctx.getState().tick <= 28) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(
      ctx.byId.get("command_skeleton_warrior")!,
      ctx.firstLegalTick("command_skeleton_warrior"),
      false,
    );
    // The second command cast at 31: RAAAR 32, hits 33-42 below.
    while (ctx.getState().tick <= 46) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    const { commands } = skeletonEvents(s);
    expect(commands.map((e) => e.tick)).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
    ]);
  });

  it("command hits land up to 2 ticks past the skeleton's expiry, never more", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_skeleton_warrior")!, 0, false);
    while (ctx.getState().tick < 96) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("command_skeleton_warrior")!, 98, false);
    while (ctx.getState().tick <= 112) ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    const { autos, commands } = skeletonEvents(s);
    // Expiry is tick 105: command hits land 100..107, the 102 auto is suppressed,
    // and nothing schedules past the +2 tail.
    expect(commands.map((e) => e.tick)).toEqual([100, 101, 102, 103, 104, 105, 106, 107]);
    expect(autos.every((e) => e.tick !== 102)).toBe(true);
    expect(autos.every((e) => e.tick < 105)).toBe(true);
  });
});
