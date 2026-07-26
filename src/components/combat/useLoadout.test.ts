import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOADOUT,
  equipInSlot,
  normalizeLoadout,
  pruneUnknownEquipment,
  unlockOnlyIds,
  withAttackLevel,
  withStrengthLevel,
  withStyleLevel,
} from "./useLoadout";

describe("normalizeLoadout", () => {
  it("returns defaults for null / non-objects", () => {
    expect(normalizeLoadout(null)).toEqual(DEFAULT_LOADOUT);
    expect(normalizeLoadout("nope")).toEqual(DEFAULT_LOADOUT);
  });

  it("migrates legacy { level } into attackLevel + strengthLevel", () => {
    const next = normalizeLoadout({ style: "melee", level: 112, weaponTier: 92 });
    expect(next.level).toBe(112);
    expect(next.attackLevel).toBe(112);
    expect(next.strengthLevel).toBe(112);
    expect(next.weaponTier).toBe(92);
  });

  it("melee keeps split Attack/Strength; level aliases strength", () => {
    const next = normalizeLoadout({
      style: "melee",
      attackLevel: 80,
      strengthLevel: 110,
      level: 999,
    });
    expect(next.attackLevel).toBe(80);
    expect(next.strengthLevel).toBe(110);
    expect(next.level).toBe(110);
  });

  it("non-melee collapses attack/strength onto style level", () => {
    const next = normalizeLoadout({
      style: "ranged",
      level: 105,
      attackLevel: 1,
      strengthLevel: 2,
    });
    expect(next.level).toBe(105);
    expect(next.attackLevel).toBe(105);
    expect(next.strengthLevel).toBe(105);
  });

  it("fills missing buffs and equipmentSlots", () => {
    const next = normalizeLoadout({ style: "magic", level: 99 });
    expect(next.buffs).toEqual({
      vulnerability: false,
      styleCurse: "none",
      overload: "none",
    });
    expect(next.equipmentSlots).toEqual({});
    expect(next.equipmentIds).toEqual([]);
    expect(next.perks.equilibrium).toBe(0);
    expect(next.perks.invigorating).toBe(0);
    expect(next.perks.impatient).toBe(0);
    expect(next.perks.impatientLevel20).toBe(false);
    expect(next.perks.plantedFeet).toBe(false);
  });

  it("preserves plantedFeet when true; defaults false", () => {
    expect(normalizeLoadout({ perks: { plantedFeet: true } }).perks.plantedFeet).toBe(true);
    expect(normalizeLoadout({ perks: { plantedFeet: false } }).perks.plantedFeet).toBe(false);
    expect(normalizeLoadout({ perks: {} }).perks.plantedFeet).toBe(false);
  });

  it("clamps Invigorating / Impatient ranks and preserves impatientLevel20", () => {
    const next = normalizeLoadout({
      perks: { invigorating: 9, impatient: -2, impatientLevel20: true },
    });
    expect(next.perks.invigorating).toBe(4);
    expect(next.perks.impatient).toBe(0);
    expect(next.perks.impatientLevel20).toBe(true);
  });

  it("clamps Crackling / Aftershock ranks 0-4", () => {
    const next = normalizeLoadout({
      perks: { crackling: 9, aftershock: -1 },
    });
    expect(next.perks.crackling).toBe(4);
    expect(next.perks.aftershock).toBe(0);
    expect(normalizeLoadout({ perks: { crackling: 3, aftershock: 2 } }).perks).toMatchObject({
      crackling: 3,
      aftershock: 2,
    });
  });

  it("preserves valid buffs and drops invalid enum values", () => {
    const next = normalizeLoadout({
      buffs: {
        vulnerability: true,
        styleCurse: "malevolence",
        overload: "supreme",
      },
    });
    expect(next.buffs).toEqual({
      vulnerability: true,
      styleCurse: "malevolence",
      overload: "supreme",
    });
    const bad = normalizeLoadout({
      buffs: { vulnerability: "yes", styleCurse: "not-a-curse", overload: "extreme" },
    });
    expect(bad.buffs).toEqual({
      vulnerability: false,
      styleCurse: "none",
      overload: "none",
    });
  });

  it("merges slotted ids with unlock-only pins from legacy equipmentIds", () => {
    const next = normalizeLoadout({
      equipmentSlots: { mainhand: "item:a", helmet: "item:b" },
      equipmentIds: ["item:a", "item:unlock-only", "item:b"],
    });
    expect(next.equipmentIds).toEqual(["item:a", "item:b", "item:unlock-only"]);
    expect(unlockOnlyIds(next)).toEqual(["item:unlock-only"]);
  });
});

describe("pruneUnknownEquipment", () => {
  const known = (id: string) => id === "item:keep" || id === "item:pin";

  it("drops slotted ids and unlock pins missing from the catalogue", () => {
    const raw = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: {
        mainhand: "item:keep",
        helmet: "item:gone",
        ring: "item:also-gone",
      },
      equipmentIds: ["item:keep", "item:gone", "item:also-gone", "item:pin", "item:dead-pin"],
    };
    const next = pruneUnknownEquipment(raw, known);
    expect(next.equipmentSlots).toEqual({ mainhand: "item:keep" });
    expect(next.equipmentIds).toEqual(["item:keep", "item:pin"]);
    expect(unlockOnlyIds(next)).toEqual(["item:pin"]);
  });

  it("does not promote a pruned slot orphan into an unlock pin", () => {
    const raw = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: { body: "item:ghost" },
      equipmentIds: ["item:ghost"],
    };
    const next = pruneUnknownEquipment(raw, () => false);
    expect(next.equipmentSlots).toEqual({});
    expect(next.equipmentIds).toEqual([]);
  });

  it("default known drops catalogue-absent ids (retired auras deleted from JSON)", () => {
    const raw = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: {
        // Post-2026 combat auras were stripped from equipment.json entirely.
        aura: "item:berserker-aura",
        helmet: "item:sirenic-mask",
      },
      equipmentIds: ["item:berserker-aura", "item:sirenic-mask", "item:not-in-catalogue"],
    };
    const next = pruneUnknownEquipment(raw);
    expect(next.equipmentSlots.aura).toBeUndefined();
    expect(next.equipmentSlots.helmet).toBe("item:sirenic-mask");
    expect(next.equipmentIds).toEqual(["item:sirenic-mask"]);
    expect(unlockOnlyIds(next)).toEqual([]);
  });
});

describe("equipInSlot twohand exclusivity", () => {
  it("twohand clears mainhand and offhand", () => {
    let loadout = equipInSlot(DEFAULT_LOADOUT, "mainhand", "item:mh");
    loadout = equipInSlot(loadout, "offhand", "item:oh");
    loadout = equipInSlot(loadout, "twohand", "item:2h");
    expect(loadout.equipmentSlots).toEqual({ twohand: "item:2h" });
    expect(loadout.equipmentIds).toEqual(["item:2h"]);
  });

  it("mainhand or offhand clears twohand", () => {
    let loadout = equipInSlot(DEFAULT_LOADOUT, "twohand", "item:2h");
    loadout = equipInSlot(loadout, "mainhand", "item:mh");
    expect(loadout.equipmentSlots.twohand).toBeUndefined();
    expect(loadout.equipmentSlots.mainhand).toBe("item:mh");

    loadout = equipInSlot(DEFAULT_LOADOUT, "twohand", "item:2h");
    loadout = equipInSlot(loadout, "offhand", "item:oh");
    expect(loadout.equipmentSlots.twohand).toBeUndefined();
    expect(loadout.equipmentSlots.offhand).toBe("item:oh");
  });

  it("clearing a slot removes it without touching unrelated slots", () => {
    let loadout = equipInSlot(DEFAULT_LOADOUT, "helmet", "item:helm");
    loadout = equipInSlot(loadout, "ring", "item:ring");
    loadout = equipInSlot(loadout, "helmet", null);
    expect(loadout.equipmentSlots).toEqual({ ring: "item:ring" });
  });
});

describe("level helpers", () => {
  it("withStyleLevel mirrors attack and strength", () => {
    const next = withStyleLevel(DEFAULT_LOADOUT, 120);
    expect(next).toMatchObject({ level: 120, attackLevel: 120, strengthLevel: 120 });
  });

  it("withAttackLevel only changes attack; withStrengthLevel also updates level alias", () => {
    const atk = withAttackLevel(DEFAULT_LOADOUT, 70);
    expect(atk.attackLevel).toBe(70);
    expect(atk.strengthLevel).toBe(99);
    expect(atk.level).toBe(99);
    const str = withStrengthLevel(DEFAULT_LOADOUT, 115);
    expect(str.strengthLevel).toBe(115);
    expect(str.level).toBe(115);
    expect(str.attackLevel).toBe(99);
  });
});
