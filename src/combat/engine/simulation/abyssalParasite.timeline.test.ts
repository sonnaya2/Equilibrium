import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import {
  ABYSSAL_PARASITE_DURATION_TICKS,
  ABYSSAL_PARASITE_INTERVAL_TICKS,
  activeBleedCount,
  abyssalParasiteDamage,
} from "../../styles/melee/effects";
import {
  activeEquipmentEffects,
  type ActiveEquipmentEffects,
  type EquipmentEnchantmentId,
} from "../../shared/equipment";
import type { ItemPassiveId, WeaponClass } from "../../data/records";
import { rotationOf } from "./contracts";
import { simulate, type SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";

/**
 * Abyssal Parasite stack/timeline law:
 * - stacks only from player_direct / player_auto melee hits with the passive and damage.max > 0
 * - never from Dismember/Slaughter/Massacre bleed ticks, parasite ticks, procs, blessings, attached
 * - multi-hit direct melee: each hit stacks once
 * - cadence: interval 3, duration 15 ticks, max 50 stacks
 * - Jaws activeBleedCount: parasite counts only while active (needs a direct hit first)
 */

const meleeInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

function itemEffects(
  passiveIds: ItemPassiveId[],
  enchantments: EquipmentEnchantmentId[] = [],
  weaponClass: WeaponClass | null = null,
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
  };
}

function parasiteEvents(result: { events: { abilityId: string; tick: number; stackCount?: number; damage: { min: number; max: number; expected: number } }[] }) {
  return result.events.filter((event) => event.abilityId === "abyssal_parasite");
}

describe("Abyssal Parasite timeline", () => {
  it("one direct hit (fury) opens a 1-stack path with ticks at +3..+15", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("fury"),
    });
    expect(result.ok).toBe(true);
    const parasite = parasiteEvents(result);
    const hitTick = result.events.find((e) => e.abilityId === "fury")!.tick;
    const expectedTicks = [3, 6, 9, 12, 15].map((offset) => hitTick + offset);
    expect(parasite.map((e) => e.tick)).toEqual(expectedTicks);
    expect(parasite).toHaveLength(ABYSSAL_PARASITE_DURATION_TICKS / ABYSSAL_PARASITE_INTERVAL_TICKS);
    const one = abyssalParasiteDamage(1);
    for (const tick of parasite) {
      expect(tick.stackCount).toBe(1);
      expect(tick.damage).toMatchObject({
        min: one.min,
        max: one.max,
        expected: (one.min + one.max) / 2,
      });
    }
    expect(result.events.filter((e) => e.abilityId === "fury")).toHaveLength(1);
  });

  it("one direct hit via rend matches the same cadence and 1-stack damage", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("rend"),
    });
    expect(result.ok).toBe(true);
    const parasite = parasiteEvents(result);
    expect(parasite.map((e) => e.tick)).toEqual([3, 6, 9, 12, 15]);
    expect(parasite.every((e) => e.stackCount === 1)).toBe(true);
    expect(parasite[0]!.damage).toMatchObject({ min: 18, max: 31, expected: 24.5 });
  });

  it("multi-hit hurricane stacks once per direct hit (N=2)", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      weaponConfiguration: "twohand",
      startingAdrenaline: 100,
      rotation: rotationOf("hurricane"),
    });
    expect(result.ok).toBe(true);
    const hits = result.events.filter((e) => e.abilityId === "hurricane" && e.family === "hit");
    expect(hits).toHaveLength(2);
    const parasite = parasiteEvents(result);
    // Both hits land same tick; cadence anchors on that land, stacks = 2 before first tick.
    expect(parasite.map((e) => e.tick)).toEqual([3, 6, 9, 12, 15]);
    const two = abyssalParasiteDamage(2);
    for (const tick of parasite) {
      expect(tick.stackCount).toBe(2);
      expect(tick.damage).toMatchObject({
        min: two.min,
        max: two.max,
        expected: (two.min + two.max) / 2,
      });
    }
  });

  it("multi-hit assault stacks once per channelled direct hit (N=4)", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      startingAdrenaline: 100,
      rotation: rotationOf("assault"),
    });
    expect(result.ok).toBe(true);
    const hits = result.events.filter((e) => e.abilityId === "assault" && e.family === "hit");
    expect(hits).toHaveLength(4);
    const parasite = parasiteEvents(result);
    expect(parasite.length).toBeGreaterThan(0);
    // First assault hit lands at cast+1; cadence starts there. Later hits only grow stacks.
    const firstHitTick = hits[0]!.tick;
    expect(parasite[0]!.tick).toBe(firstHitTick + ABYSSAL_PARASITE_INTERVAL_TICKS);
    const maxStacks = Math.max(...parasite.map((e) => e.stackCount ?? 0));
    expect(maxStacks).toBe(4);
    expect(parasite[parasite.length - 1]!.stackCount).toBe(4);
  });

  it("Dismember alone yields zero abyssal_parasite events and no stacks", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("dismember"),
    });
    expect(result.ok).toBe(true);
    expect(parasiteEvents(result)).toHaveLength(0);
    expect(result.events.filter((e) => e.abilityId === "dismember").length).toBeGreaterThan(0);

    const ctx = createCastContext({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
    });
    ctx.performCast(ctx.byId.get("dismember")!, 0, false);
    ctx.advanceTo(16);
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(0);
    expect(activeBleedCount(ctx.getState().target.melee, 8)).toBe(1);
  });

  it("Slaughter and Massacre bleed ticks do not open parasite either", () => {
    const slaughter = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      startingAdrenaline: 100,
      rotation: rotationOf("dismember", "slaughter"),
    });
    expect(slaughter.ok).toBe(true);
    expect(parasiteEvents(slaughter)).toHaveLength(0);

    const massacre = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      startingAdrenaline: 100,
      rotation: rotationOf("dismember", "slaughter", "massacre"),
    });
    // Massacre has one direct hit; that alone may open parasite. Bleed ticks must not add further.
    expect(massacre.ok).toBe(true);
    const parasite = parasiteEvents(massacre);
    const massacreDirect = massacre.events.filter(
      (e) => e.abilityId === "massacre" && e.family === "hit",
    );
    expect(massacreDirect).toHaveLength(1);
    if (parasite.length > 0) {
      expect(Math.max(...parasite.map((e) => e.stackCount ?? 0))).toBe(1);
    }
  });

  it("bleed ticks after a direct hit do not add stacks beyond the direct hit", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("fury", "dismember"),
    });
    expect(result.ok).toBe(true);
    const parasite = parasiteEvents(result);
    expect(parasite.length).toBeGreaterThan(0);
    expect(parasite.every((e) => e.stackCount === 1)).toBe(true);
    const one = abyssalParasiteDamage(1);
    expect(parasite[0]!.damage).toMatchObject({
      min: one.min,
      max: one.max,
      expected: (one.min + one.max) / 2,
    });
  });

  it("refresh before expiry (rend then fury) preserves cadence; same-tick tick uses old stacks", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("rend", "fury"),
    });
    expect(result.ok).toBe(true);
    const parasite = parasiteEvents(result);
    // Rend at 0 schedules 3..15; fury at 3 refreshes duration without shifting the live cadence.
    expect(parasite.map((e) => e.tick)).toEqual([3, 6, 9, 12, 15, 18]);
    expect(parasite[0]!.stackCount).toBe(1);
    expect(parasite[0]!.damage).toMatchObject({ min: 18, max: 31, expected: 24.5 });
    expect(parasite[1]!.stackCount).toBe(2);
    expect(parasite[1]!.damage).toMatchObject({ min: 37, max: 62, expected: 49.5 });
    expect(parasite.slice(1).every((e) => e.stackCount === 2)).toBe(true);
  });

  it("Jaws activeBleedCount is 1 after dismember alone and 2 after a direct hit opens parasite", () => {
    const equipmentEffects = itemEffects(["jaws-of-the-abyss", "abyssal-parasite"]);
    const ctx = createCastContext({ ...meleeInput, equipmentEffects });
    ctx.performCast(ctx.byId.get("dismember")!, 0, false);
    // Dismember first land is tick 2; at 3 the bleed is live and parasite is not.
    expect(activeBleedCount(ctx.getState().target.melee, 3)).toBe(1);
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(0);

    ctx.performCast(ctx.byId.get("fury")!, 3, false);
    // Fury lands at 3, opens parasite; dismember bleed still live.
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(1);
    expect(activeBleedCount(ctx.getState().target.melee, 3)).toBe(2);
  });

  it("Jaws adrenaline uses live unique bleeds only (parasite after a direct hit)", () => {
    const equipmentEffects = itemEffects(["jaws-of-the-abyss", "abyssal-parasite"]);
    const dismemberOnlyThenFury = (naturalInstinctUntilTick = 0) => {
      const ctx = createCastContext({
        ...meleeInput,
        equipmentEffects,
        naturalInstinctUntilTick,
      });
      ctx.performCast(ctx.byId.get("dismember")!, 0, false);
      expect(activeBleedCount(ctx.getState().target.melee, 3)).toBe(1);
      ctx.performCast(ctx.byId.get("fury")!, 3, false);
      return ctx.getState().adrenaline;
    };
    // Fury +9; Jaws 2 * 1 bleed (dismember only at cast time). NI doubles the Jaws grant only.
    expect(dismemberOnlyThenFury()).toBe(11);
    expect(dismemberOnlyThenFury(100)).toBe(13);

    // Direct hit first so parasite is live before the next basic.
    const withParasite = (naturalInstinctUntilTick = 0) => {
      const ctx = createCastContext({
        ...meleeInput,
        equipmentEffects,
        naturalInstinctUntilTick,
      });
      ctx.performCast(ctx.byId.get("dismember")!, 0, false);
      ctx.performCast(ctx.byId.get("fury")!, 3, false);
      expect(activeBleedCount(ctx.getState().target.melee, 6)).toBe(2);
      ctx.performCast(ctx.byId.get("rend")!, 6, false);
      return ctx.getState().adrenaline;
    };
    // After fury: adren 11. Rend +9 + Jaws 2*2=4 => 24. With NI: +9 + 8 => 28 from 13 path...
    // Recompute from the with-parasite path starting from zero:
    // fury path without NI ends at 11; rend +9 +4 = 24.
    expect(withParasite()).toBe(24);
    // fury with NI ends at 13; rend +9 +8 = 30.
    expect(withParasite(100)).toBe(30);
  });
});
