import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { calculateAbility } from "../../pipeline/calculateAbility";
import { activeBleedCount } from "../../styles/melee/effects";
import { activeEquipmentEffects, type ActiveEquipmentEffects } from "../../shared/equipment";
import type { ItemPassiveId } from "../../data/records";
import { resolveAbilityWithEquipment } from "../../shared/bleedDurationExtension";
import { rotationOf } from "./contracts";
import { simulate, type SimulateInput } from "./simulate";
import { createCastContext } from "./context";

function itemEffects(passiveIds: ItemPassiveId[]): ActiveEquipmentEffects {
  return {
    ...activeEquipmentEffects({ style: "melee" }),
    passiveIds,
  };
}

const baseInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

const spear = itemEffects(["masterwork-spear-bleed-extension"]);
const noSpear = itemEffects([]);

describe("Masterwork spear bleed extension in simulation and Quick parity", () => {
  it("schedules 12 Dismember hits with the spear and 8 without", () => {
    const withSpear = simulate({
      ...baseInput,
      equipmentEffects: spear,
      rotation: rotationOf("dismember"),
    });
    const without = simulate({
      ...baseInput,
      equipmentEffects: noSpear,
      rotation: rotationOf("dismember"),
    });
    expect(withSpear.ok).toBe(true);
    expect(without.ok).toBe(true);
    const spearHits = withSpear.events.filter((e) => e.abilityId === "dismember");
    const baseHits = without.events.filter((e) => e.abilityId === "dismember");
    expect(spearHits).toHaveLength(12);
    expect(baseHits).toHaveLength(8);
    expect(spearHits.map((e) => e.tick)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
  });

  it("Quick/calculateAbility matches rotation hit count and totals for Dismember", () => {
    const ability = MELEE_ABILITIES.find((a) => a.id === "dismember")!;
    const resolved = resolveAbilityWithEquipment(ability, spear);
    const quick = calculateAbility(resolved, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      context: { style: "melee" },
    });
    const sim = simulate({
      ...baseInput,
      equipmentEffects: spear,
      rotation: rotationOf("dismember"),
    });
    expect(quick.hits).toHaveLength(12);
    expect(sim.events.filter((e) => e.abilityId === "dismember")).toHaveLength(12);
    expect(sim.perAbility["dismember"]).toBeCloseTo(quick.expected, 6);
    expect(quick.min).toBeGreaterThan(0);
    expect(quick.max).toBeGreaterThan(quick.min);
  });

  it("Slaughter and Massacre land the sourced extended tails", () => {
    const slaughter = simulate({
      ...baseInput,
      equipmentEffects: spear,
      startingAdrenaline: 50,
      rotation: rotationOf("dismember", "slaughter"),
    });
    const massacre = simulate({
      ...baseInput,
      equipmentEffects: spear,
      startingAdrenaline: 100,
      rotation: rotationOf("dismember", "slaughter", "massacre"),
    });
    expect(slaughter.ok).toBe(true);
    expect(massacre.ok).toBe(true);
    expect(slaughter.events.filter((e) => e.abilityId === "slaughter")).toHaveLength(9);
    const massHits = massacre.events.filter((e) => e.abilityId === "massacre");
    // 1 direct + 9 bleed = 10
    expect(massHits).toHaveLength(10);
    expect(massHits.filter((e) => e.family === "dot")).toHaveLength(9);
    expect(massHits.filter((e) => e.family === "hit")).toHaveLength(1);
  });

  it("fixed-window excludes extended tails past the horizon", () => {
    // half-open [0, horizon): ticks 2,4,6,8 land when horizon is 10
    const ctx = createCastContext({
      ...baseInput,
      equipmentEffects: spear,
      abilities: MELEE_ABILITIES,
      horizonTicks: 10,
    });
    ctx.performCast(ctx.byId.get("dismember")!, 0, false);
    const s = ctx.finish(undefined, 10);
    const landed = s.events.filter((e) => e.abilityId === "dismember");
    expect(landed.map((e) => e.tick)).toEqual([2, 4, 6, 8]);
    expect(landed).toHaveLength(4);
  });

  it("natural completion includes every extended tick", () => {
    const s = simulate({
      ...baseInput,
      equipmentEffects: spear,
      rotation: rotationOf("dismember"),
    });
    expect(s.events.filter((e) => e.abilityId === "dismember")).toHaveLength(12);
  });

  it("extended ticks keep one unique dismember bleed on the target", () => {
    const ctx = createCastContext({
      ...baseInput,
      equipmentEffects: spear,
      abilities: MELEE_ABILITIES,
    });
    const dismember = ctx.byId.get("dismember")!;
    ctx.performCast(dismember, 0, false);
    // Mid-tail: many ticks landed, still a single bleedId on the target.
    ctx.advanceTo(12);
    expect(activeBleedCount(ctx.getState().target.melee, 12)).toBe(1);
    ctx.advanceTo(25);
    // After final extended tick expires (last land 24, expires at 25).
    expect(activeBleedCount(ctx.getState().target.melee, 25)).toBe(0);
  });

  it("ordinary spear does not change base Dismember hit count", () => {
    const ordinary = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { twohand: "item:spear-of-annihilation" },
    });
    expect(ordinary.passiveIds).not.toContain("masterwork-spear-bleed-extension");
    const s = simulate({
      ...baseInput,
      equipmentEffects: ordinary,
      rotation: rotationOf("dismember"),
    });
    expect(s.events.filter((e) => e.abilityId === "dismember")).toHaveLength(8);
  });

  it("base-game output without the passive is unchanged vs no equipmentEffects", () => {
    const bare = simulate({
      ...baseInput,
      rotation: rotationOf("dismember"),
    });
    const empty = simulate({
      ...baseInput,
      equipmentEffects: noSpear,
      rotation: rotationOf("dismember"),
    });
    expect(bare.perAbility["dismember"]).toBeCloseTo(empty.perAbility["dismember"]!, 10);
    expect(bare.events.filter((e) => e.abilityId === "dismember")).toHaveLength(8);
  });
});
