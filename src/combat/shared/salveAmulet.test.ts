import { describe, expect, it } from "vitest";
import { mulFloor } from "../core/rounding";
import { runPipeline } from "../pipeline/modifierPipeline";
import { raceSlayerPerkModifier } from "./perks";
import {
  SALVE_AMULET_E_ITEM_ID,
  SALVE_AMULET_ITEM_ID,
  resolveSalve,
  salveDamageModifier,
} from "./salveAmulet";
import {
  FULL_SLAYER_HELMET_ITEM_ID,
  resolveSlayerHelmet,
  slayerHelmetDamageModifier,
} from "./slayerHelmet";

describe("resolveSalve", () => {
  it("Salve + undead: damage and hit chance ×1.15", () => {
    const r = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_ITEM_ID },
      targetUndead: true,
    });
    expect(r.active).toBe(true);
    expect(r.damageMult).toBe(1.15);
    expect(r.hitChanceMult).toBe(1.15);
  });

  it("Salve (e) + undead: damage and hit chance ×1.20", () => {
    const r = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      targetUndead: true,
    });
    expect(r.active).toBe(true);
    expect(r.damageMult).toBe(1.2);
    expect(r.hitChanceMult).toBe(1.2);
  });

  it("non-undead: no effect", () => {
    const r = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      targetUndead: false,
    });
    expect(r.active).toBe(false);
    expect(r.damageMult).toBe(1);
    expect(r.hitChanceMult).toBe(1);
  });

  it("amulet slot switch activates and deactivates", () => {
    expect(
      resolveSalve({ equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID }, targetUndead: true })
        .active,
    ).toBe(true);
    expect(resolveSalve({ equipmentSlots: {}, targetUndead: true }).active).toBe(false);
    expect(
      resolveSalve({
        equipmentSlots: { amulet: "item:am-zi" },
        targetUndead: true,
      }).active,
    ).toBe(false);
  });

  it("malformed dual list: amulet slot is authoritative (no stack)", () => {
    const r = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      equipmentIds: [SALVE_AMULET_ITEM_ID, SALVE_AMULET_E_ITEM_ID],
      targetUndead: true,
    });
    expect(r.active).toBe(true);
    expect(r.variant?.id).toBe("salve-e");
    expect(r.damageMult).toBe(1.2);
    expect(r.hitChanceMult).toBe(1.2);
  });
});

describe("salveDamageModifier", () => {
  it("applies on direct hits only (DoT and conjure unchanged)", () => {
    const r = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      targetUndead: true,
    });
    const mod = salveDamageModifier(r)!;
    expect(
      runPipeline({ damage: 1000 }, [mod], { style: "melee", damageSource: "direct" }).damage,
    ).toBe(mulFloor(1000, 1.2));
    expect(
      runPipeline({ damage: 1000 }, [mod], {
        style: "melee",
        damageSource: "dot",
        dotKind: "bleed",
      }).damage,
    ).toBe(1000);
    expect(
      runPipeline({ damage: 1000 }, [mod], { style: "melee", damageSource: "conjure" }).damage,
    ).toBe(1000);
  });
});

describe("slayer + salve stacking", () => {
  it("Full helmet + Salve on undead task: damage ×1.075×1.15, hit ×1.125×1.15", () => {
    const helm = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "melee",
    });
    const salve = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_ITEM_ID },
      targetUndead: true,
    });
    expect(helm.damageMult * salve.damageMult).toBeCloseTo(1.075 * 1.15, 10);
    expect(helm.hitChanceMult * salve.hitChanceMult).toBeCloseTo(1.125 * 1.15, 10);

    const mods = [slayerHelmetDamageModifier(helm)!, salveDamageModifier(salve)!];
    expect(
      runPipeline({ damage: 1000 }, mods, { style: "melee", damageSource: "direct" }).damage,
    ).toBe(mulFloor(mulFloor(1000, 1.075), 1.15));
  });

  it("Full helmet + Salve (e): damage ×1.075×1.20, hit ×1.125×1.20", () => {
    const helm = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "melee",
    });
    const salve = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      targetUndead: true,
    });
    expect(helm.damageMult * salve.damageMult).toBeCloseTo(1.075 * 1.2, 10);
    expect(helm.hitChanceMult * salve.hitChanceMult).toBeCloseTo(1.125 * 1.2, 10);
    const mods = [slayerHelmetDamageModifier(helm)!, salveDamageModifier(salve)!];
    expect(
      runPipeline({ damage: 1000 }, mods, { style: "melee", damageSource: "direct" }).damage,
    ).toBe(mulFloor(mulFloor(1000, 1.075), 1.2));
  });

  it("combined modifiers still exclude DoTs and conjures", () => {
    const helm = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "melee",
    });
    const salve = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      targetUndead: true,
    });
    const mods = [slayerHelmetDamageModifier(helm)!, salveDamageModifier(salve)!];
    expect(
      runPipeline({ damage: 1000 }, mods, {
        style: "melee",
        damageSource: "dot",
        dotKind: "burn",
      }).damage,
    ).toBe(1000);
    expect(
      runPipeline({ damage: 1000 }, mods, { style: "melee", damageSource: "conjure" }).damage,
    ).toBe(1000);
  });

  it("Undead Slayer perk remains separate and stacks", () => {
    const helm = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "melee",
    });
    const salve = resolveSalve({
      equipmentSlots: { amulet: SALVE_AMULET_ITEM_ID },
      targetUndead: true,
    });
    const perk = raceSlayerPerkModifier("undead", true);
    const mods = [slayerHelmetDamageModifier(helm)!, salveDamageModifier(salve)!, perk];
    const dmg = runPipeline({ damage: 1000 }, mods, {
      style: "melee",
      damageSource: "direct",
    }).damage;
    // onHit helm/salve then base-stage perk ordering depends on stage order:
    // base runs before onHit, so perk first.
    expect(dmg).toBe(mulFloor(mulFloor(mulFloor(1000, 1.07), 1.075), 1.15));
  });
});
