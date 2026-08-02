import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { vulnerabilityModifier } from "../../shared/vulnerability";
import { rotationOf } from "./contracts";
import { simulate, type SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";
import { simulateRevolution } from "./revolution";
import {
  activeEquipmentEffects,
  amHejDamageBonus,
  applyEquipmentDamagePotential,
  dynamicEquipmentCritBonus,
  staticEquipmentCritBonus,
  type ActiveEquipmentEffects,
  type EquipmentEnchantmentId,
} from "../../shared/equipment";
import { activeBleedCount } from "../../styles/melee/effects";
import type { ItemPassiveId, WeaponClass } from "../../data/records";

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

function itemEffects(
  passiveIds: ItemPassiveId[],
  enchantments: EquipmentEnchantmentId[] = [],
  weaponClass: WeaponClass | null = null,
  resolved: Partial<Pick<ActiveEquipmentEffects, "amZiFlatDamage" | "amHejDamageBonus">> = {},
): ActiveEquipmentEffects {
  return {
    ...activeEquipmentEffects({ style: "melee" }),
    passiveIds,
    enchantments,
    weaponClass,
    passage: {
      active: passiveIds.includes("enduring-ruin"),
      agonyActive: passiveIds.includes("enduring-ruin") && enchantments.includes("agony"),
    },
    ...resolved,
  };
}

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
    expect(initial.damage.expected).toBeCloseTo(2249.750830564784, 10);
    const tails = s.events.filter((e) => e.abilityId === "bloat" && e.hitIndex > 0);
    for (const tail of tails) {
      expect(tail.damage.expected).toBeCloseTo(562.437707641196, 10);
    }
    expect(s.perAbility["bloat"]).toBeCloseTo(7874.127906976744, 10);
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
    for (const event of events) {
      expect(event.damage.expected).toBeCloseTo(3749.750499001996, 10);
    }
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
    expect(ctx.getState().melee.bleedChainNext).toBe("slaughter");
    expect(ctx.getState().melee.bleedChainUntilTick).toBe(9 + 40);
    for (let i = 0; i < 2; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(slaughter, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bleedChainNext).toBe("massacre");
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(massacre, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bleedChainNext).toBeNull(); // reset after completion
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
    expect(ctx.getState().melee.bleedChainNext).toBe("slaughter"); // rejection mutates nothing
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

describe("item passive timelines", () => {
  it("counts unique bleeds for Jaws and doubles only that gain under Natural Instinct", () => {
    const equipmentEffects = itemEffects(["jaws-of-the-abyss", "abyssal-parasite"]);
    const run = (naturalInstinctUntilTick = 0) => {
      const ctx = createCastContext({
        ...meleeInput,
        equipmentEffects,
        naturalInstinctUntilTick,
      });
      ctx.performCast(ctx.byId.get("dismember")!, 0, false);
      expect(activeBleedCount(ctx.getState().target.melee, 3)).toBe(2);
      ctx.performCast(ctx.byId.get("fury")!, 3, false);
      return ctx.getState().adrenaline;
    };
    expect(run()).toBe(13);
    expect(run(100)).toBe(17);
  });

  it("keeps Parasite cadence and resolves a same-tick refresh with the old stacks", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("rend", "fury"),
    });
    const parasite = result.events.filter((event) => event.abilityId === "abyssal_parasite");
    expect(parasite.map((event) => event.tick)).toEqual([3, 6, 9, 12, 15, 18]);
    expect(parasite[0]!.damage).toMatchObject({ min: 18, max: 31, expected: 24.5 });
    expect(parasite[1]!.damage).toMatchObject({ min: 37, max: 62, expected: 49.5 });
  });

  it("grants Passage on Rend landing and combines its next attack additively with Am-hej", () => {
    const equipmentEffects = itemEffects(
      ["enduring-ruin", "am-hej", "abyssal-parasite"],
      ["agony"],
      null,
      { amHejDamageBonus: 0.06 },
    );
    const result = simulate({
      ...meleeInput,
      equipmentEffects,
      rotation: rotationOf("rend", "fury"),
    });
    const fury = result.casts.find((cast) => cast.abilityId === "fury")!;
    expect(fury.result.expected).toBeCloseTo(1463.5124378109454, 10);

    const bleeds = simulate({
      ...meleeInput,
      equipmentEffects,
      rotation: rotationOf("rend", "dismember"),
    });
    expect(
      bleeds.events.find((event) => event.abilityId === "abyssal_parasite")?.damage,
    ).toMatchObject({ min: 22, max: 38, expected: 30 });
    expect(bleeds.events.find((event) => event.abilityId === "dismember")?.damage).toMatchObject({
      min: 312,
      max: 437,
    });
  });

  it("adds Am-zi after the roll on direct hits and excludes bleeds", () => {
    const direct = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["am-zi"], [], null, { amZiFlatDamage: 162 }),
      rotation: rotationOf("fury"),
    });
    const bleed = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["am-zi"], [], null, { amZiFlatDamage: 162 }),
      rotation: rotationOf("dismember"),
    });
    expect(direct.casts[0]!.result.expected).toBe(1362);
    expect(bleed.casts[0]!.result.expected).toBe(8 * 300);
    expect(amHejDamageBonus(120)).toBe(0.06);
    expect(amHejDamageBonus(139)).toBe(0.06);
    expect(amHejDamageBonus(140)).toBe(0.07);
  });

  it("applies Heroism and Metaphysics from live bleed and channel-hit state", () => {
    const champion = dynamicEquipmentCritBonus(
      itemEffects(["champion-ring"], ["heroism"]),
      { style: "melee" },
      0,
      3,
    );
    expect(champion).toEqual({ chance: 0.04, damageBonus: 0.045 });

    const channeller = dynamicEquipmentCritBonus(
      itemEffects(["channeller-ring"], ["metaphysics"]),
      { style: "magic", channelTicks: 8 },
      4,
      0,
    );
    expect(channeller).toEqual({ chance: 0.2, damageBonus: 0.125 });
  });

  it("gates Stalker by bow class and leaves Reaver unenchanted", () => {
    expect(staticEquipmentCritBonus(itemEffects(["stalker-ring"], ["shadows"], "bow"))).toEqual({
      chance: 0.04,
      damageBonus: 0.03,
    });
    expect(
      staticEquipmentCritBonus(itemEffects(["stalker-ring"], ["shadows"], "crossbow")),
    ).toEqual({ chance: 0, damageBonus: 0 });
    expect(staticEquipmentCritBonus(itemEffects(["reaver-ring"]))).toEqual({
      chance: 0.05,
      damageBonus: 0,
    });
    expect(applyEquipmentDamagePotential(1, itemEffects(["reaver-ring"]))).toBe(0.95);
    expect(applyEquipmentDamagePotential(0.8, itemEffects(["reaver-ring"]))).toBe(0.75);
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
    for (let t = 2; t <= 16; t += 2) {
      expect(withVuln.damageByTick[t]).toBeCloseTo(329.55445544554453, 10);
    }
  });

  it("Chaos Roar's bleed boost is the sourced exception to the DoT rule", () => {
    const s = simulate({ ...meleeInput, rotation: rotationOf("chaos_roar", "dismember") });
    for (let t = 5; t <= 19; t += 2) {
      expect(s.damageByTick[t]).toBeCloseTo(524.6237623762377, 10);
    }
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
    expect(ctx.getState().magic.sunshine.expiresAtTick - castTick).toBe(63);
    const plain = createCastContext(magicInput);
    for (let i = 0; i < 12; i++) plain.performCast(basic, plain.getState().tick, false);
    const plainTick = plain.getState().tick;
    plain.performCast(plain.byId.get("sunshine")!, plainTick, false);
    expect(plain.getState().magic.sunshine.expiresAtTick - plainTick).toBe(50);
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

describe("Bloat recast overwrite", () => {
  it("a recast cancels the previous tails; damage after it comes only from the new Bloat", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    const bloat = ctx.byId.get("bloat")!;
    for (let i = 0; i < 3; i++) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(bloat, ctx.getState().tick, false); // Bloat at 9, tails 12..39
    for (let i = 0; i < 3; i++) ctx.performCast(basic, ctx.getState().tick, false);
    ctx.performCast(bloat, ctx.getState().tick, false); // recast at 21, tails 24..51
    const s = ctx.finish();
    const initials = s.events.filter((e) => e.abilityId === "bloat" && e.hitIndex === 0);
    const tails = s.events.filter((e) => e.abilityId === "bloat" && e.hitIndex > 0);
    expect(initials).toHaveLength(2);
    const oldSet = tails.filter((e) => e.derivedFrom === initials[0].seq);
    const newSet = tails.filter((e) => e.derivedFrom === initials[1].seq);
    // Old set: only the four tails that landed before/at the recast tick
    // (the +21 tail lands during the advance, before the cancellation).
    expect(oldSet.map((e) => e.tick)).toEqual([12, 15, 18, 21]);
    // New set: a full fresh ten, all derived from the new initial hit.
    expect(newSet.map((e) => e.tick)).toEqual([24, 27, 30, 33, 36, 39, 42, 45, 48, 51]);
    expect(s.damageByTick[21]).toBeCloseTo(1500 + 375); // new initial + last old tail
    expect(s.damageByTick[39]).toBeCloseTo(375); // new set only — old +39 tail is gone
  });

  it("a critical recast makes the fresh set inherit the new initial's crit", () => {
    const s = simulate({
      ...necroInput,
      crit: { chance: 0, guaranteed: true },
      rotation: rotationOf(
        ...Array(3).fill("necromancy_basic"),
        "bloat",
        ...Array(3).fill("necromancy_basic"),
        "bloat",
      ),
    });
    const initials = s.events.filter((e) => e.abilityId === "bloat" && e.hitIndex === 0);
    const newSet = s.events.filter(
      (e) => e.abilityId === "bloat" && e.derivedFrom === initials[1].seq,
    );
    expect(newSet).toHaveLength(10);
    for (const tail of newSet) {
      expect(tail.damage.expected).toBeCloseTo(562.437707641196, 10);
    }
  });

  it("unrelated DoTs survive a Bloat recast", () => {
    const mixed: Omit<SimulateInput, "rotation"> = {
      ...necroInput,
      abilities: [...NECROMANCY_ABILITIES, ...MAGIC_ABILITIES],
    };
    const s = simulate({
      ...mixed,
      rotation: rotationOf(
        "combust",
        ...Array(3).fill("necromancy_basic"),
        "bloat",
        ...Array(3).fill("necromancy_basic"),
        "bloat",
      ),
    });
    expect(s.ok).toBe(true);
    const burns = s.events.filter((e) => e.abilityId === "combust");
    expect(burns).toHaveLength(10); // the whole Combust burn ran, untouched
  });
});

describe("Blood Siphon occupancy", () => {
  it("occupies the actor for the full 9-tick channel; the finisher lands on release", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    const siphon = ctx.byId.get("blood_siphon")!;
    ctx.performCast(siphon, 0, false);
    expect(ctx.getState().tick).toBe(9); // not the 3-tick GCD
    ctx.performCast(basic, ctx.getState().tick, false);
    const s = ctx.finish();
    const finisher = s.events.find((e) => e.abilityId === "blood_siphon")!;
    expect(finisher.tick).toBe(9);
    expect(s.casts[1].tick).toBe(9); // next cast begins only after the channel
    // The canonical clock lands the finisher before the next cast on that tick.
    expect(s.events.filter((e) => e.tick === 9).map((e) => e.abilityId)).toEqual([
      "blood_siphon",
      "necromancy_basic",
    ]);
  });
});
