import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import {
  DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS,
  NECROMANCY_ABILITIES,
  volleyOfSouls,
} from "../styles/necromancy/abilities";
import { rotationOf } from "./actions";
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

  it("stalls a repeated cast until its individual cooldown expires", () => {
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
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
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

  it("Aftershock: 100k ability damage, rank 1, base 1000 → 2 procs × 400 = 800 when H allows", () => {
    const n = 84;
    const s = simulate({
      ...baseInput,
      procs: { aftershockRank: 1 },
      rotation: rotationOf(...Array(n).fill("attack")),
    });
    expect(s.ok).toBe(true);
    const abilityExpected = n * 1200;
    expect(abilityExpected).toBeGreaterThanOrEqual(100_000);
    expect(s.perAbility.aftershock).toBeCloseTo(800, 5);
    expect(s.totalExpected).toBeCloseTo(abilityExpected + 800, 5);
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

  it("Impatient adds EV extra on basic gains (R4 non-l20: 0.36×3 = 1.08)", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientExpectedExtra: 0.36 * 3 },
      rotation: rotationOf("attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].adrenalineAfter).toBeCloseTo(9 + 1.08);
  });

  it("stacks Invigorating multiplier then Impatient EV on the same basic", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientExpectedExtra: 1.08 },
      rotation: rotationOf("attack", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].adrenalineAfter).toBeCloseTo(11.88);
    expect(s.casts[1].adrenalineAfter).toBeCloseTo(23.76);
  });

  it("does not apply Invigorating/Impatient when there is no adrenaline gain", () => {
    const plain = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
    });
    const noGain = simulate({
      ...baseInput,
      adrenaline: { basicGainMultiplier: 1.2, impatientExpectedExtra: 1.08 },
      rotation: rotationOf("dismember"), // enhanced bleed — no adrenaline field
    });
    expect(plain.casts[0].adrenalineAfter).toBe(9);
    expect(noGain.casts[0].adrenalineAfter).toBe(0);
  });
});

describe("simulate — Relentless EV cost refund", () => {
  it("refunds cost × chance after spend (R5: 25 cost → +1.25 EV)", () => {
    const plain = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault"),
    });
    const withR = simulate({
      ...baseInput,
      adrenaline: { relentlessRefundChance: 0.05 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault"),
    });
    expect(plain.ok).toBe(true);
    expect(withR.ok).toBe(true);
    const plainAssault = lastCast(plain);
    const rAssault = lastCast(withR);
    expect(plainAssault.abilityId).toBe("assault");
    expect(plainAssault.adrenalineAfter).toBeCloseTo(36 - 25, 10);
    expect(rAssault.adrenalineAfter).toBeCloseTo(36 - 25 + 25 * 0.05, 10);
  });

  it("does not refund when cost is 0 (basics / free casts)", () => {
    const plain = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
    });
    const withR = simulate({
      ...baseInput,
      adrenaline: { relentlessRefundChance: 0.05 },
      rotation: rotationOf("attack"),
    });
    expect(withR.casts[0].adrenalineAfter).toBeCloseTo(plain.casts[0].adrenalineAfter, 10);
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
  it("extends an active Berserk window by 0.6s per hit (8 ticks)", () => {
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
    expect(last.tick).toBe(69);
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

  it("does not 1.5x non-basic adrenaline costs or gains", () => {
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
    expect(assault.adrenalineAfter).toBeCloseTo(beforeAssault - 25 + 3 * 4.5);
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
    ctx.performCast(byId("assault"), 11, false);
    expect(ctx.getState().endlessAssaultUntilTick).toBe(0);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    expect(s.casts[1].result.min).toBe(1150);
    expect(s.casts[1].result.max).toBe(1510);
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

  it("shadow imbued grants adrenaline per ranged hit", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(
        ...Array(5).fill("ranged_attack"),
        "imbue_shadows",
        "galeshot",
        "ranged_attack",
      ),
    });
    expect(lastCast(s).result.hits).toHaveLength(2);
    expect(lastCast(s).adrenalineAfter).toBe(5 + 9 + 5 + 9 + 10);
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
      rotation: rotationOf("runic_charge", "magic_attack", "dragon_breath_empowered"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].tick).toBe(0);
    expect(s.casts[1].tick).toBe(0);
    expect(s.casts[2].result.expected).toBeCloseTo(2850);
  });

  it("empowered casts fail without an active charge", () => {
    const s = simulate({ ...magicInput, rotation: rotationOf("dragon_breath_empowered") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("requires an active Runic Charge");
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
    expect(instCrit.result.expected).toBeGreaterThan(1300 * 1.4); // well above non-crit cast
    const followCrit = findCast(
      allCrit,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > instCrit.tick,
      "Missing crit follow-up magic attack",
    );
    expect(followCrit.result.expected).toBeGreaterThan(1000);
    expect(allCrit.damageByTick[instCrit.tick + 1]).toBeGreaterThan(0);
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
      "attack@12",
      "attack@15",
      "attack@18",
      "assault@21",
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
