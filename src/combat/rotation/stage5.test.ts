import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../styles/necromancy/abilities";
import { vulnerabilityModifier } from "../shared/vulnerability";
import { rotationOf } from "./contracts";
import { simulate, type SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";
import { simulateRevolution } from "./revolution";

/**
 * Stage 5 regression coverage: Bloat's derived tails, Death Skulls' derived
 * bounces, the Dismember -> Slaughter -> Massacre chain, Planted Feet's
 * removed periodic damage, and the wiki DoT modifier rule.
 */

const meleeInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

const necroInput: Omit<SimulateInput, "rotation"> = {
  ...meleeInput,
  abilities: NECROMANCY_ABILITIES,
  context: { style: "necromancy" },
};

const magicInput: Omit<SimulateInput, "rotation"> = {
  ...meleeInput,
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" },
};

describe("Bloat derived tails", () => {
  it("tails are 25% of the resolved initial hit with provenance", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf(...Array(3).fill("necromancy_basic"), "bloat"),
    });
    expect(s.ok).toBe(true);
    const initial = s.events.find((e) => e.abilityId === "bloat" && e.hitIndex === 0)!;
    const tails = s.events.filter((e) => e.abilityId === "bloat" && e.hitIndex > 0);
    expect(initial.damage.expected).toBeCloseTo(1500);
    expect(tails).toHaveLength(10);
    expect(tails.map((e) => e.tick)).toEqual([12, 15, 18, 21, 24, 27, 30, 33, 36, 39]);
    for (const tail of tails) {
      expect(tail.damage.expected).toBeCloseTo(375);
      expect(tail.family).toBe("dot");
      expect(tail.derivedFrom).toBe(initial.seq);
      expect(tail.procEligible).toBe(false);
    }
    // Initial 1500 + 10 × 375; the basics add their own damage separately.
    expect(s.perAbility["bloat"]).toBeCloseTo(5250); // wiki average total 525%
  });

  it("a critical initial hit scales every tail (crit inheritance, never re-crit)", () => {
    const s = simulate({
      ...necroInput,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf(...Array(3).fill("necromancy_basic"), "bloat"),
    });
    const initial = s.events.find((e) => e.abilityId === "bloat" && e.hitIndex === 0)!;
    expect(initial.damage.expected).toBeCloseTo(1500 * 1.5);
    const tails = s.events.filter((e) => e.abilityId === "bloat" && e.hitIndex > 0);
    for (const tail of tails) expect(tail.damage.expected).toBeCloseTo(1500 * 1.5 * 0.25);
    expect(s.perAbility["bloat"]).toBeCloseTo(1500 * 1.5 * (1 + 10 * 0.25));
  });

  it("tails past the revolution horizon never land", () => {
    const bloat = NECROMANCY_ABILITIES.find((a) => a.id === "bloat")!;
    const basic = NECROMANCY_ABILITIES.find((a) => a.id === "necromancy_basic")!;
    const s = simulateRevolution({
      ...necroInput,
      bar: [bloat, basic],
      style: "necromancy",
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    // First Bloat at tick 9 (funded by basics); its tails at 12, 15, 18 land.
    // Revolution casts Bloat again at 18 — its initial lands, its tails are
    // all past the horizon and never count.
    const casts = s.casts.filter((c) => c.abilityId === "bloat");
    expect(casts[0].tick).toBe(9);
    const landed = s.events.filter((e) => e.abilityId === "bloat" && e.hitIndex > 0);
    expect(landed.map((e) => e.tick)).toEqual([12, 15, 18]);
    expect(s.perAbility["bloat"]).toBeCloseTo(2 * 1500 + 3 * 375, 5);
  });
});

describe("Death Skulls derived bounces", () => {
  it("bounces land at +2 and +4 for 100% of the resolved initial hit", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf(...Array(7).fill("necromancy_basic"), "death_skulls"),
    });
    expect(s.ok).toBe(true);
    const events = s.events.filter((e) => e.abilityId === "death_skulls");
    expect(events.map((e) => e.tick)).toEqual([21, 23, 25]);
    expect(events.map((e) => e.damage.expected)).toEqual([2500, 2500, 2500]);
    expect(events[1].derivedFrom).toBe(events[0].seq);
    expect(events[2].derivedFrom).toBe(events[0].seq);
    expect(events[1].family).toBe("hit");
  });

  it("a critical first hit makes every bounce critical (wiki correlation)", () => {
    const s = simulate({
      ...necroInput,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf(...Array(7).fill("necromancy_basic"), "death_skulls"),
    });
    const events = s.events.filter((e) => e.abilityId === "death_skulls");
    expect(events.map((e) => e.damage.expected)).toEqual([3750, 3750, 3750]);
  });
});

describe("Dismember recast chain", () => {
  it("Slaughter without a live Dismember is rejected without mutation", () => {
    const s = simulate({ ...meleeInput, rotation: rotationOf("slaughter") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("dismember");
    expect(s.casts).toHaveLength(0);
  });

  it("Dismember unlocks Slaughter for 40 ticks; Massacre unlocks after Slaughter", () => {
    const ctx = createCastContext(meleeInput);
    const attack = ctx.byId.get("attack")!;
    const dismember = ctx.byId.get("dismember")!;
    const slaughter = ctx.byId.get("slaughter")!;
    const massacre = ctx.byId.get("massacre")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    ctx.performCast(dismember, ctx.getState().tick, false);
    expect(ctx.getState().bleedChainNext).toBe("slaughter");
    expect(ctx.getState().bleedChainUntilTick).toBe(9 + 40);
    for (let i = 0; i < 2; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(slaughter, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().bleedChainNext).toBe("massacre");
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(massacre, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().bleedChainNext).toBeNull(); // reset after completion
    const s = ctx.finish();
    expect(s.casts.map((c) => c.abilityId)).toContain("slaughter");
    expect(s.casts.map((c) => c.abilityId)).toContain("massacre");
  });

  it("Massacre directly after Dismember (skipping Slaughter) is rejected", () => {
    const s = simulate({
      ...meleeInput,
      rotation: rotationOf("attack", "attack", "attack", "dismember", "massacre"),
    });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("slaughter");
  });

  it("the recast window expires at the 40-tick boundary", () => {
    const ctx = createCastContext(meleeInput);
    const dismember = ctx.byId.get("dismember")!;
    const slaughter = ctx.byId.get("slaughter")!;
    const attack = ctx.byId.get("attack")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    ctx.performCast(dismember, ctx.getState().tick, false); // cast at 9, window until 49
    for (let i = 0; i < 13; i++) ctx.performCast(attack, ctx.getState().tick, false);
    // tick is now 9+3+39 = 51 ≥ 49: the chain lapsed mid-rotation.
    const attempt = ctx.performCast(slaughter, ctx.getState().tick, false);
    expect(attempt.ok).toBe(false);
    expect(ctx.getState().bleedChainNext).toBe("slaughter"); // rejection mutates nothing
  });

  it("Revolution skips unavailable chain stages until the predecessor lands", () => {
    const dismember = MELEE_ABILITIES.find((a) => a.id === "dismember")!;
    const slaughter = MELEE_ABILITIES.find((a) => a.id === "slaughter")!;
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const s = simulateRevolution({
      ...meleeInput,
      bar: [slaughter, dismember, attack],
      style: "melee",
      durationTicks: 20,
    });
    expect(s.ok).toBe(true);
    const ids = s.casts.map((c) => c.abilityId);
    expect(ids).toContain("dismember");
    expect(ids).toContain("slaughter");
    expect(ids.indexOf("dismember")).toBeLessThan(ids.indexOf("slaughter"));
  });
});

describe("damage-over-time modifier rule", () => {
  it("bleeds ignore Berserk but still take Vulnerability (wiki DoT rule)", () => {
    const withBerserk = simulate({
      ...meleeInput,
      rotation: rotationOf(...Array(12).fill("attack"), "berserk", "dismember"),
    });
    expect(withBerserk.ok).toBe(true);
    // Dismember at 39, Berserk window covers the whole bleed — ticks stay 300.
    for (let t = 41; t <= 55; t += 2) expect(withBerserk.damageByTick[t]).toBeCloseTo(300);

    const withVuln = simulate({
      ...meleeInput,
      modifiers: [vulnerabilityModifier()],
      rotation: rotationOf("dismember"),
    });
    for (let t = 2; t <= 16; t += 2) expect(withVuln.damageByTick[t]).toBeCloseTo(330);
  });

  it("Chaos Roar's bleed boost is the sourced exception to the DoT rule", () => {
    const s = simulate({ ...meleeInput, rotation: rotationOf("chaos_roar", "dismember") });
    for (let t = 5; t <= 19; t += 2) expect(s.damageByTick[t]).toBeCloseTo(524.5);
  });
});

describe("Planted Feet", () => {
  it("base Sunshine with Planted Feet extends duration and schedules zero DoT events", () => {
    const withPf = simulate({
      ...magicInput,
      plantedFeet: true,
      rotation: rotationOf(...Array(12).fill("magic_attack"), "sunshine"),
    });
    expect(withPf.ok).toBe(true);
    const dotEvents = withPf.events.filter((e) => e.abilityId === "sunshine");
    expect(dotEvents).toHaveLength(0);

    const without = simulate({
      ...magicInput,
      rotation: rotationOf(...Array(12).fill("magic_attack"), "sunshine"),
    });
    const beams = without.events.filter((e) => e.abilityId === "sunshine");
    expect(beams).toHaveLength(16);
  });

  it("the Planted Feet Sunshine window runs 63 ticks", () => {
    const ctx = createCastContext({ ...magicInput, plantedFeet: true });
    const basic = ctx.byId.get("magic_attack")!;
    for (let i = 0; i < 12; i++) ctx.performCast(basic, ctx.getState().tick, false);
    const castTick = ctx.getState().tick;
    ctx.performCast(ctx.byId.get("sunshine")!, castTick, false);
    expect(ctx.getState().sunshine.expiresAtTick - castTick).toBe(63);
    const plain = createCastContext(magicInput);
    for (let i = 0; i < 12; i++) plain.performCast(basic, plain.getState().tick, false);
    const plainTick = plain.getState().tick;
    plain.performCast(plain.byId.get("sunshine")!, plainTick, false);
    expect(plain.getState().sunshine.expiresAtTick - plainTick).toBe(50);
  });

  it("Greater Sunshine keeps its beam with Planted Feet (perk is base-only)", () => {
    const s = simulate({
      ...magicInput,
      plantedFeet: true,
      rotation: rotationOf(...Array(12).fill("magic_attack"), "greater_sunshine"),
    });
    expect(s.events.filter((e) => e.abilityId === "greater_sunshine")).toHaveLength(21);
  });
});
