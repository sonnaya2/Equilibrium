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
import { simulate, type SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";

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
    expect(low.casts.at(-1)!.result.expected).toBeCloseTo(4 * 1400);

    const high = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault"),
    });
    const assault = high.casts.at(-1)!;
    expect(assault.tick).toBe(12);
    expect(assault.result.expected).toBeCloseTo(4 * 1800);
    expect(assault.adrenalineAfter).toBe(36 - 25);
  });

  it("stalls a repeated cast until its individual cooldown expires", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        "attack", "attack", "attack",
        "assault",
        "attack", "attack", "attack",
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
    // 60s = 100 ticks @ 0.6s
    const s = ctx.finish(undefined, 100);
    expect(s.ok).toBe(true);
    expect(s.perAbility.crackling).toBeCloseTo(2000, 5);
    expect(s.totalExpected).toBeCloseTo(2000, 5);
    // Mid-horizon damageByTick entry
    expect(s.damageByTick[50]).toBeCloseTo(2000, 5);
  });

  it("Aftershock: 100k ability damage, rank 1, base 1000 → 2 procs × 400 = 800 when H allows", () => {
    // attack expected = 1200 @ base 1000; need ≥100k → ≥84 attacks
    const n = 84;
    const s = simulate({
      ...baseInput,
      procs: { aftershockRank: 1 },
      rotation: rotationOf(...Array(n).fill("attack")),
    });
    expect(s.ok).toBe(true);
    const abilityExpected = n * 1200;
    expect(abilityExpected).toBeGreaterThanOrEqual(100_000);
    // elapsed horizon = n * 3 ticks * 0.6s ≥ 151s → room for many 6s gaps
    expect(s.perAbility.aftershock).toBeCloseTo(800, 5);
    expect(s.totalExpected).toBeCloseTo(abilityExpected + 800, 5);
  });

  it("Aftershock does not recurse on Crackling damage", () => {
    // Ability damage alone below 50k, but crackling on a long horizon would not count.
    const ctx = createCastContext({
      ...baseInput,
      procs: { cracklingRank: 4, aftershockRank: 4 },
    });
    // No casts: abilityExpected = 0 → aftershock 0; crackling alone over 60s
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
    // Per cast: 9*1.2 + 1.08 = 11.88
    expect(s.casts[0].adrenalineAfter).toBeCloseTo(11.88);
    expect(s.casts[1].adrenalineAfter).toBeCloseTo(23.76);
  });

  it("does not apply Invigorating/Impatient when there is no adrenaline gain", () => {
    // Rules only fire inside ability.adrenaline?.gain for basic/autoAttack casts.
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
    // floor(1350×1.75)+floor(2887.5…): the band ends floor before averaging.
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
    // Fury itself is unbuffed (110-130 mid).
    expect(s.casts[0].result.expected).toBeCloseTo(1200);
    expect(s.casts[0].result.hits[0].critChance).toBe(0);
    // Next attack: 0.75*1200 + 0.25*1800 = 1350 at level 99 (+50% crit dmg).
    expect(s.casts[1].result.hits[0].critChance).toBeCloseTo(0.25);
    expect(s.casts[1].result.expected).toBeCloseTo(1350);
    // Consumed after one attack.
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
    // 12 attacks -> berserk (until tick 36+33=69) -> 3 attacks -> gflurry (+8) -> attacks through 69.
    const rotation = rotationOf(
      ...Array(12).fill("attack"),
      "berserk",
      ...Array(3).fill("attack"),
      "greater_flurry",
      ...Array(7).fill("attack"),
    );
    const s = simulate({ ...baseInput, rotation });
    expect(s.ok).toBe(true);
    const last = s.casts.at(-1)!;
    expect(last.abilityId).toBe("attack");
    expect(last.tick).toBe(69);
    // Without the +8 tick extend, berserk would end at 69 (readyTick >= until).
    // With extend, tick 69 still multiplies: floor(1100*1.75)+floor(1300*1.75) avg.
    expect(last.result.expected).toBeCloseTo(2100);
  });

  it("does not invent a Berserk window when none is active", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(...Array(3).fill("attack"), "greater_flurry", "rend"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.at(-1)!.result.expected).toBeCloseTo(1500);
  });
});

describe("simulate — meteor_strike", () => {
  it("multiplies melee basic adrenaline by 1.5x inside the 30s window", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(...Array(7).fill("attack"), "meteor_strike", "attack"),
    });
    expect(s.ok).toBe(true);
    const meteor = s.casts.find((c) => c.abilityId === "meteor_strike")!;
    // 63 - 60 + 3 ticks * 4.5 passive across the GCD after cast.
    expect(meteor.adrenalineAfter).toBeCloseTo(3 + 3 * 4.5);
    const follow = s.casts.at(-1)!;
    // Prior adren + 9*1.5 basic + 3 ticks * 4.5 passive on this GCD.
    expect(follow.adrenalineAfter).toBeCloseTo(meteor.adrenalineAfter + 13.5 + 3 * 4.5);
  });

  it("does not 1.5x non-basic adrenaline costs or gains", () => {
    // Assault is enhanced (no adren gain); cost stays 25 — not multiplied.
    // GCD still accrues Meteor passive (+4.5 x 3) after the spend.
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(...Array(7).fill("attack"), "meteor_strike", ...Array(3).fill("attack"), "assault"),
    });
    expect(s.ok).toBe(true);
    const assault = s.casts.at(-1)!;
    const beforeAssault = s.casts[s.casts.length - 2].adrenalineAfter;
    expect(assault.adrenalineAfter).toBeCloseTo(beforeAssault - 25 + 3 * 4.5);
  });
});

describe("simulate — greater_fury / chaos_roar (already wired)", () => {
  it("greater fury guarantees crit on the next non-bleed melee", () => {
    const s = simulate({
      ...baseInput,
      crit: { chance: 0 },
      rotation: rotationOf("greater_fury", "attack"),
    });
    expect(s.ok).toBe(true);
    // Guaranteed crit at level 99: mid of floor(1100*1.5)..floor(1300*1.5) = 1800.
    expect(s.casts[1].result.expected).toBeCloseTo(1800);
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
    expect(withAmmo.casts.at(-1)!.adrenalineAfter).toBe(100);

    const without = simulate({ ...rangedInput, rotation });
    expect(without.casts.at(-1)!.adrenalineAfter).toBe(60);
  });

  it("searing winds adds its bonus hit inside the window only", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf("galeshot", "ranged_attack", "ranged_attack", "ranged_attack", "ranged_attack"),
    });
    expect(s.casts[1].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[2].result.expected).toBeCloseTo(1000 + 200);
    // Tick 9 is still inside the 10-tick window; tick 12 is outside it.
    expect(s.casts[3].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[4].result.expected).toBeCloseTo(1000);
  });

  it("shadow imbued grants adrenaline per ranged hit", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(...Array(5).fill("ranged_attack"), "imbue_shadows", "galeshot"),
    });
    expect(s.casts.at(-1)!.adrenalineAfter).toBe(5 + 9 + 5);
  });

  it("shadow tendrils without an active imbue grants no phantom adrenaline", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf("shadow_tendrils", "ranged_attack"),
    });
    expect(s.casts.map((c) => c.adrenalineAfter)).toEqual([0, 9]);
  });

  it("Planted Feet extends base Death's Swiftness buff window to 63 ticks", () => {
    // Fund 12 basics → DS@36; base expires 86, PF expires 99.
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
    const plainAt87 = plain.casts.find((c) => c.abilityId === "ranged_attack" && c.tick === 87);
    const pfAt87 = pf.casts.find((c) => c.abilityId === "ranged_attack" && c.tick === 87);
    expect(plainAt87!.result.expected).toBeCloseTo(1000);
    expect(pfAt87!.result.expected).toBeCloseTo(1500);
  });

  it("shadow tendrils crits guaranteed even at 0% crit chance", () => {
    const s = simulate({ ...rangedInput, crit: { chance: 0 }, rotation: rotationOf("shadow_tendrils") });
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
    // Fund 100 adren, cast sunshine@30, basic@33 (inside window), long tail outside.
    const setup = [
      ...Array(12).fill("magic_attack"),
      "sunshine",
      "magic_attack",
      ...Array(17).fill("magic_attack"), // advance well past base 50-tick beam
    ];
    const s = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const sun = s.casts.find((c) => c.abilityId === "sunshine")!;
    expect(sun.tick).toBe(36);
    // First basic after sunshine is at 39; buff starts at 37 → active.
    const inside = s.casts.filter((c) => c.abilityId === "magic_attack" && c.tick === 39)[0];
    expect(inside.result.expected).toBeCloseTo(1500); // 1000 × 1.5
    // Tick 36+50=86 is first inactive; cast at 87 (GCD grid) is outside.
    const outside = s.casts.filter((c) => c.abilityId === "magic_attack" && c.tick >= 87)[0];
    expect(outside).toBeDefined();
    expect(outside.result.expected).toBeCloseTo(1000);
  });

  it("greater sunshine multiplies magic damage for the longer window", () => {
    const setup = [
      ...Array(12).fill("magic_attack"),
      "greater_sunshine",
      "magic_attack",
    ];
    const s = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const gs = s.casts.find((c) => c.abilityId === "greater_sunshine")!;
    const next = s.casts.find((c) => c.abilityId === "magic_attack" && c.tick > gs.tick)!;
    expect(next.result.expected).toBeCloseTo(1500);
  });

  it("Planted Feet extends base Sunshine buff window to 63 ticks", () => {
    // Fund → sunshine@36 → pack casts so one lands at tick 98 (active under PF 63, dead under base 50).
    // Base: expires cast+50 = 86; PF: expires cast+63 = 99. Active on [37, 99).
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
    // Tick 87 is first base-outside on GCD grid (36+50=86 exclusive → 87 inactive).
    const plainAt87 = plain.casts.find((c) => c.abilityId === "magic_attack" && c.tick === 87);
    const pfAt87 = pf.casts.find((c) => c.abilityId === "magic_attack" && c.tick === 87);
    expect(plainAt87).toBeDefined();
    expect(pfAt87).toBeDefined();
    expect(plainAt87!.result.expected).toBeCloseTo(1000);
    expect(pfAt87!.result.expected).toBeCloseTo(1500);
    // Tick 99 is exclusive end of PF window (36+63).
    const pfAt99 = pf.casts.find((c) => c.abilityId === "magic_attack" && c.tick === 99);
    expect(pfAt99).toBeDefined();
    expect(pfAt99!.result.expected).toBeCloseTo(1000);
  });

  it("Planted Feet does not extend Greater Sunshine", () => {
    const setup = [
      ...Array(12).fill("magic_attack"),
      "greater_sunshine",
      "magic_attack",
    ];
    const plain = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    const pf = simulate({
      ...magicInput,
      plantedFeet: true,
      rotation: rotationOf(...setup),
    });
    const plainNext = plain.casts.find(
      (c) => c.abilityId === "magic_attack" && c.tick > plain.casts.find((x) => x.abilityId === "greater_sunshine")!.tick,
    )!;
    const pfNext = pf.casts.find(
      (c) => c.abilityId === "magic_attack" && c.tick > pf.casts.find((x) => x.abilityId === "greater_sunshine")!.tick,
    )!;
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
    const inst = noCrit.casts.find((c) => c.abilityId === "instability")!;
    // 120-140% of 1000, no crit, no surge.
    expect(inst.result.expected).toBeCloseTo(1300);
    const follow = noCrit.casts.find((c) => c.abilityId === "magic_attack" && c.tick > inst.tick)!;
    expect(follow.result.expected).toBeCloseTo(1000);

    const allCrit = simulate({
      ...magicInput,
      crit: { chance: 1 },
      rotation: rotationOf(...fund),
    });
    const instCrit = allCrit.casts.find((c) => c.abilityId === "instability")!;
    // Cast hit always crits + full Lightning Surge EV (p=1).
    expect(instCrit.result.expected).toBeGreaterThan(1300 * 1.4); // well above non-crit cast
    const followCrit = allCrit.casts.find(
      (c) => c.abilityId === "magic_attack" && c.tick > instCrit.tick,
    )!;
    // Follow-up basic also gets surge while buff is up.
    expect(followCrit.result.expected).toBeGreaterThan(1000);
    // Surge lands +1 tick after the source hit.
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
    const s = simulate({ ...baseInput, autoWeave: true, rotation: rotationOf("assault", "assault") });
    expect(s.ok).toBe(true);
    // Second assault's cooldown ends at 19, mid-GCD after the tick-18 basic — it
    // fires on the next grid slot, exactly as in game.
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "attack@0", "attack@3", "attack@6",
      "assault@9",
      "attack@12", "attack@15", "attack@18",
      "assault@21",
    ]);
    // First assault at 3 stacks uses the base band; the second, at 6, is empowered.
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
    expect(s.casts.at(-1)!.abilityId).toBe("imbue_shadows");
    expect(s.casts.at(-1)!.tick).toBe(15);
    expect(s.casts.at(-1)!.adrenalineAfter).toBe(45 - 40);
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
    ctx.performCast(NECROMANCY_ABILITIES.find((a) => a.id === "soul_sap")!, 0, false);
    expect(ctx.getState().necro.residualSouls).toBe(1);
    ctx.performCast(NECROMANCY_ABILITIES.find((a) => a.id === "soul_sap")!, 3, false);
    expect(ctx.getState().necro.residualSouls).toBe(2);
    ctx.performCast(NECROMANCY_ABILITIES.find((a) => a.id === "soul_strike")!, 6, false);
    expect(ctx.getState().necro.residualSouls).toBe(1);
  });

  it("fails Soul Strike without residual souls", () => {
    const s = simulate({ ...necroInput, rotation: rotationOf("soul_strike") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("residual souls");
  });

  it("Touch of Death builds Necrosis; FoD discounts cost and spends stacks", () => {
    const ctx = createCastContext(necroInput);
    const tod = NECROMANCY_ABILITIES.find((a) => a.id === "touch_of_death")!;
    const fod = NECROMANCY_ABILITIES.find((a) => a.id === "finger_of_death")!;
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
    expect(s.casts.at(-1)!.result.expected).toBeCloseTo(3000); // 270–330 mid, no LD
  });

  it("Volley spends all souls and deals one hit per residual soul held", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf("soul_sap", "soul_sap", "soul_sap", "volley_of_souls"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.at(-1)!.result.expected).toBeCloseTo(3 * 1500);
    // Final state not on summary — re-check via context path.
    const ctx = createCastContext(necroInput);
    const sap = NECROMANCY_ABILITIES.find((a) => a.id === "soul_sap")!;
    for (let i = 0; i < 3; i++) ctx.performCast(sap, i * 3, false);
    ctx.performCast(volleyOfSouls(3), 9, false);
    expect(ctx.getState().necro.residualSouls).toBe(0);
  });

  it("Living Death resets ToD/DS CDs, buffs FoD, and shortens Death Skulls CD", () => {
    const ctx = createCastContext(necroInput);
    const basic = NECROMANCY_ABILITIES.find((a) => a.id === "necromancy_basic")!;
    const tod = NECROMANCY_ABILITIES.find((a) => a.id === "touch_of_death")!;
    const ld = NECROMANCY_ABILITIES.find((a) => a.id === "living_death")!;
    const fod = NECROMANCY_ABILITIES.find((a) => a.id === "finger_of_death")!;
    const ds = NECROMANCY_ABILITIES.find((a) => a.id === "death_skulls")!;

    for (let i = 0; i < 12; i++) ctx.performCast(basic, i * 3, false);
    ctx.performCast(tod, 36, false);
    expect(ctx.getState().cooldowns["touch_of_death"]).toBeGreaterThan(ctx.getState().tick);
    expect(ctx.getState().necro.necrosisStacks).toBe(4);

    ctx.performCast(ld, 39, false);
    expect(ctx.getState().necro.livingDeathUntilTick).toBeGreaterThan(39);
    expect(ctx.getState().cooldowns["touch_of_death"]).toBeUndefined();
    expect(ctx.getState().cooldowns["death_skulls"]).toBeUndefined();

    // Basic under LD → +2 Necrosis (prior ToD left 4 → 6).
    ctx.performCast(basic, 42, false);
    expect(ctx.getState().necro.necrosisStacks).toBe(6);

    ctx.performCast(fod, 45, false);
    expect(ctx.getState().necro.necrosisStacks).toBe(0);

    // Rebuild adren for Death Skulls (60%).
    for (let i = 0; i < 7; i++) ctx.performCast(basic, 48 + i * 3, false);
    const dsTick = 48 + 7 * 3;
    ctx.performCast(ds, dsTick, false);
    expect(ctx.getState().cooldowns["death_skulls"]).toBe(dsTick + DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS);
  });

  it("Living Death multiplies Finger of Death damage in the full sim path", () => {
    // 12 basics → 100 adren + free weave room; ToD for stacks; LD; basic; FoD.
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
    const fodCast = s.casts.find((c) => c.abilityId === "finger_of_death")!;
    expect(fodCast.result.expected).toBeCloseTo(4500); // 1.5× of 3000
  });

  it("conjure skeleton summons and spirit autos contribute EV (never crit)", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf("conjure_skeleton_warrior", ...Array(20).fill("necromancy_basic")),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0]!.abilityId).toBe("conjure_skeleton_warrior");
    expect(s.casts[0]!.result.expected).toBe(0);
    expect(s.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(0);
    // First auto at tick 7 lands during the basic weave.
    expect(s.damageByTick[7]).toBeGreaterThan(0);
    // Spirit damage is in the total.
    expect(s.totalExpected).toBeGreaterThan(s.casts.reduce((n, c) => n + c.result.expected, 0));
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
    expect(ok.casts.at(-1)!.abilityId).toBe("command_skeleton_warrior");
    // Command hits are spirit damage — critEligible false on every hit.
    expect(ok.casts.at(-1)!.result.hits.every((h) => h.critChance === 0)).toBe(true);
  });

  it("conjure undead army summons three spirits with auto EV", () => {
    const ctx = createCastContext(necroInput);
    const army = NECROMANCY_ABILITIES.find((a) => a.id === "conjure_undead_army")!;
    ctx.performCast(army, 0, false);
    const ids = ctx.getState().conjures.spirits.map((s) => s.id).sort();
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
