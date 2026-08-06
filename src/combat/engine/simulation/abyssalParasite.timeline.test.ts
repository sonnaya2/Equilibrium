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
 * - stacks only from player melee hits with the passive and damage.max > 0
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

function parasiteEvents(result: {
  events: {
    abilityId: string;
    tick: number;
    stackCount?: number;
    damage: { min: number; max: number; expected: number };
  }[];
}) {
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
    expect(parasite).toHaveLength(
      ABYSSAL_PARASITE_DURATION_TICKS / ABYSSAL_PARASITE_INTERVAL_TICKS,
    );
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

  it("Slaughter bleed ticks never open parasite", () => {
    const slaughter = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      startingAdrenaline: 100,
      rotation: rotationOf("dismember", "slaughter"),
    });
    expect(slaughter.ok).toBe(true);
    expect(parasiteEvents(slaughter)).toHaveLength(0);
  });

  it("Massacre direct hit opens parasite once; bleed ticks do not add stacks", () => {
    const massacre = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      startingAdrenaline: 100,
      rotation: rotationOf("dismember", "slaughter", "massacre"),
    });
    expect(massacre.ok).toBe(true);
    const massacreDirect = massacre.events.filter(
      (e) => e.abilityId === "massacre" && e.family === "hit",
    );
    const massacreBleeds = massacre.events.filter(
      (e) => e.abilityId === "massacre" && e.family === "dot",
    );
    expect(massacreDirect).toHaveLength(1);
    expect(massacreBleeds.length).toBeGreaterThan(0);

    const parasite = parasiteEvents(massacre);
    expect(parasite.length).toBe(ABYSSAL_PARASITE_DURATION_TICKS / ABYSSAL_PARASITE_INTERVAL_TICKS);
    const hitTick = massacreDirect[0]!.tick;
    expect(parasite.map((e) => e.tick)).toEqual(
      [3, 6, 9, 12, 15].map((offset) => hitTick + offset),
    );
    expect(Math.max(...parasite.map((e) => e.stackCount ?? 0))).toBe(1);
    expect(parasite.every((e) => e.stackCount === 1)).toBe(true);
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

  it("Endless Assault converted channel hits do not stack parasite", () => {
    const ctx = createCastContext({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      startingAdrenaline: 100,
    });
    // Bleed-only opener sets idle clock without stacking.
    expect(ctx.performCast(ctx.byId.get("dismember")!, 0, false).ok).toBe(true);
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(0);

    expect(ctx.performCast(ctx.byId.get("greater_barge")!, 8, false).ok).toBe(true);
    expect(ctx.getState().melee.endlessAssaultUntilTick).toBe(18);
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(1);

    expect(ctx.performCast(ctx.byId.get("assault")!, 11, false).ok).toBe(true);
    expect(ctx.getState().melee.endlessAssaultUntilTick).toBe(0);
    const result = ctx.finish();
    expect(result.ok).toBe(true);
    const converted = result.events.filter((e) => e.abilityId === "assault");
    expect(converted.length).toBe(4);
    expect(
      converted.every(
        (e) =>
          e.family === "dot" &&
          e.convertedChannel &&
          e.provenance.kind === "player_converted_channel",
      ),
    ).toBe(true);
    // Converted hits must not grow stacks past the barge direct hit.
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(1);
    expect(Math.max(...parasiteEvents(result).map((e) => e.stackCount ?? 0))).toBe(1);
  });

  it("parasite tick events do not self-stack", () => {
    const ctx = createCastContext({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
    });
    expect(ctx.performCast(ctx.byId.get("fury")!, 0, false).ok).toBe(true);
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(1);
    ctx.advanceTo(16);
    expect(ctx.getState().target.melee.abyssalParasite.stacks).toBe(1);
    const result = ctx.finish();
    expect(result.ok).toBe(true);
    const parasite = parasiteEvents(result);
    expect(parasite).toHaveLength(
      ABYSSAL_PARASITE_DURATION_TICKS / ABYSSAL_PARASITE_INTERVAL_TICKS,
    );
    expect(parasite.every((e) => e.stackCount === 1)).toBe(true);
  });

  it("a Basic Attack is direct player damage and stacks parasite", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("attack"),
    });
    expect(result.ok).toBe(true);
    const attack = result.events.find((e) => e.abilityId === "attack");
    expect(attack?.provenance.kind).toBe("player_direct");
    expect(result.analysis.bySource).toContainEqual({ kind: "basic-attack", damage: 1_200 });
    const parasite = parasiteEvents(result);
    expect(parasite).toHaveLength(
      ABYSSAL_PARASITE_DURATION_TICKS / ABYSSAL_PARASITE_INTERVAL_TICKS,
    );
    expect(parasite.every((e) => e.stackCount === 1)).toBe(true);
  });

  it("zero-damage hit does not stack parasite", () => {
    const result = simulate({
      ...meleeInput,
      base: 0,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      rotation: rotationOf("fury"),
    });
    expect(result.ok).toBe(true);
    const fury = result.events.find((e) => e.abilityId === "fury");
    expect(fury?.damage.max).toBe(0);
    expect(parasiteEvents(result)).toHaveLength(0);
  });

  it("invention proc path does not open or add parasite stacks", () => {
    const result = simulate({
      ...meleeInput,
      equipmentEffects: itemEffects(["abyssal-parasite"]),
      procs: { cracklingRank: 4 },
      rotation: rotationOf("attack"),
    });
    expect(result.ok).toBe(true);
    const crackling = result.events.filter((e) => e.abilityId === "crackling");
    expect(crackling.length).toBeGreaterThan(0);
    expect(crackling.every((e) => e.provenance.kind === "invention_proc")).toBe(true);
    // Attack stacks once; crackling must not open a second stack path.
    const parasite = parasiteEvents(result);
    expect(parasite.length).toBeGreaterThan(0);
    expect(Math.max(...parasite.map((e) => e.stackCount ?? 0))).toBe(1);
  });

  // Cadence refresh (rend+fury) and base Jaws bleed-count/adren 11/13 live in mechanics.test.ts.
  it("Jaws adrenaline counts parasite once live before a later basic", () => {
    const equipmentEffects = itemEffects(["jaws-of-the-abyss", "abyssal-parasite"]);
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
    // fury path without NI ends at 11; rend +9 + Jaws 2*2=4 => 24.
    expect(withParasite()).toBe(24);
    // fury with NI ends at 13; rend +9 +8 = 30.
    expect(withParasite(100)).toBe(30);
  });
});
