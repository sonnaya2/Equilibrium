import { describe, expect, it } from "vitest";
import { POWERBURST_COOLDOWN_MS, POWERBURST_DURATION_MS } from "@/combat";
import {
  DEFAULT_LOADOUT,
  activatePowerburstOfVitality,
  clearEquipment,
  equipInSlot,
  gizmoSlotOf,
  normalizeLoadout,
  isPowerburstOfVitalityReady,
  placePerkOnGizmo,
  pruneUnknownEquipment,
  removePerkFromGizmos,
  toggleEquipmentEnchantment,
  unlockOnlyIds,
  withLoadoutBuffs,
  withAttackLevel,
  withCombatStyle,
  withStrengthLevel,
  withStyleLevel,
} from "./useLoadout";

describe("normalizeLoadout", () => {
  it("returns defaults for null / non-objects", () => {
    expect(normalizeLoadout(null)).toEqual(DEFAULT_LOADOUT);
    expect(normalizeLoadout("nope")).toEqual(DEFAULT_LOADOUT);
  });

  it("defaults stored loadouts to automatic base damage and migrates the legacy base as a fallback", () => {
    const legacy = normalizeLoadout({ base: 777, startingAdrenaline: 140 });
    expect(legacy.baseDamage).toEqual({ mode: "automatic", manualValue: 777 });
    expect(legacy.startingAdrenaline).toBe(100);
    expect(legacy.hitCapEnabled).toBe(true);

    const manual = normalizeLoadout({
      baseDamage: { mode: "manual", manualValue: 1234 },
      startingAdrenaline: -5,
      hitCapEnabled: false,
    });
    expect(manual.baseDamage).toEqual({ mode: "manual", manualValue: 1234 });
    expect(manual.startingAdrenaline).toBe(0);
    expect(manual.hitCapEnabled).toBe(false);
  });

  it("rejects non-positive persisted manual base values", () => {
    expect(
      normalizeLoadout({ baseDamage: { mode: "manual", manualValue: -4 } }).baseDamage,
    ).toEqual({ mode: "manual", manualValue: 1 });
  });

  it("keeps up to 120 starting adrenaline with four Vestments pieces", () => {
    const next = normalizeLoadout({
      startingAdrenaline: 140,
      equipmentSlots: {
        helmet: "item:vestments-of-havoc-hood",
        body: "item:vestments-of-havoc-robe-top",
        legs: "item:vestments-of-havoc-robe-bottom",
        boots: "item:vestments-of-havoc-boots",
      },
    });
    expect(next.startingAdrenaline).toBe(120);
  });

  it("clamps saved adrenaline when Vestments loses a piece or the loadout switches weapon style", () => {
    const pieces = {
      helmet: "item:vestments-of-havoc-hood",
      body: "item:vestments-of-havoc-robe-top",
      legs: "item:vestments-of-havoc-robe-bottom",
      boots: "item:vestments-of-havoc-boots",
    } as const;
    expect(
      normalizeLoadout({
        style: "melee",
        startingAdrenaline: 120,
        equipmentSlots: { ...pieces, boots: undefined },
      }).startingAdrenaline,
    ).toBe(100);
    expect(
      normalizeLoadout({
        style: "melee",
        startingAdrenaline: 120,
        equipmentSlots: { ...pieces, mainhand: "item:seismic-wand" },
      }).startingAdrenaline,
    ).toBe(100);
  });

  it("drops legacy manual set overrides", () => {
    const perks = normalizeLoadout({ perks: { tectonicPieces: 3, insideSunshine: true } }).perks;
    expect("tectonicPieces" in perks).toBe(false);
    expect("insideSunshine" in perks).toBe(false);
  });

  it("migrates legacy { level } into attackLevel + strengthLevel", () => {
    const next = normalizeLoadout({ style: "melee", level: 112, weaponTier: 92 });
    expect(next.level).toBe(112);
    expect(next.attackLevel).toBe(112);
    expect(next.strengthLevel).toBe(112);
    expect(next.weaponTier).toBe(92);
  });

  it("forward-migrates a complete v1 loadout without losing existing state", () => {
    const next = normalizeLoadout({
      style: "ranged",
      level: 108,
      attackLevel: 82,
      strengthLevel: 91,
      equipmentSlots: { mainhand: "item:seismic-wand" },
      equipmentIds: ["item:seismic-wand", "item:unlock-pin"],
      enchantments: ["agony"],
      perks: { biting: 4, impatient: 3 },
      buffs: { vulnerability: true, styleCurse: "anguish", overload: "elder" },
      target: { defenceLevel: 88, armour: 420, affinity: "strong" },
      baseDamage: { mode: "manual", manualValue: 4321 },
      startingAdrenaline: 72,
      hitCapEnabled: false,
    });

    expect(next).toMatchObject({
      style: "ranged",
      level: 108,
      attackLevel: 82,
      strengthLevel: 91,
      defenceLevel: 99,
      constitutionLevel: 99,
      currentLife: null,
      equipmentSlots: { mainhand: "item:seismic-wand" },
      equipmentIds: ["item:seismic-wand", "item:unlock-pin"],
      enchantments: ["agony"],
      perks: { biting: 4, impatient: 3 },
      buffs: { vulnerability: true, styleCurse: "anguish", overload: "elder" },
      target: { defenceLevel: 88, armour: 420, affinity: "strong" },
      baseDamage: { mode: "manual", manualValue: 4321 },
      startingAdrenaline: 72,
      hitCapEnabled: false,
    });
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

  it("non-melee keeps stored Attack and Strength while using its own style level", () => {
    const next = normalizeLoadout({
      style: "ranged",
      level: 105,
      attackLevel: 1,
      strengthLevel: 2,
    });
    expect(next.level).toBe(105);
    expect(next.attackLevel).toBe(1);
    expect(next.strengthLevel).toBe(2);
  });

  it("normalizes Defence, Constitution, and current life to their canonical ranges", () => {
    expect(
      normalizeLoadout({ defenceLevel: 100, constitutionLevel: 1, currentLife: 99_000 }),
    ).toMatchObject({
      defenceLevel: 99,
      constitutionLevel: 10,
      currentLife: 99_000,
    });
    expect(
      normalizeLoadout({ defenceLevel: -1, constitutionLevel: 120, currentLife: -4 }),
    ).toMatchObject({
      defenceLevel: 1,
      constitutionLevel: 99,
      currentLife: 0,
    });
  });

  it("fills missing buffs and equipmentSlots", () => {
    const next = normalizeLoadout({ style: "magic", level: 99 });
    expect(next.buffs).toEqual({
      vulnerability: false,
      styleCurse: "none",
      overload: "none",
      fortitude: false,
      reaperCrew: false,
      fontOfLife: false,
      boonOfHet: false,
      bonfireFiremakingLevel: null,
      totemOfVitality: false,
      thermalBath: false,
      overheal: "none",
      powerburstOfVitalityUntil: null,
      powerburstOfVitalityCooldownUntil: null,
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
    expect(next.buffs).toMatchObject({
      vulnerability: true,
      styleCurse: "malevolence",
      overload: "supreme",
    });
    const bad = normalizeLoadout({
      buffs: { vulnerability: "yes", styleCurse: "not-a-curse", overload: "extreme" },
    });
    expect(bad.buffs).toMatchObject({
      vulnerability: false,
      styleCurse: "none",
      overload: "none",
    });
  });

  it("normalizes supported life effects and rejects incompatible stored combinations", () => {
    const now = 10_000;
    const next = normalizeLoadout(
      {
        buffs: {
          fortitude: true,
          styleCurse: "turmoil",
          reaperCrew: true,
          fontOfLife: true,
          boonOfHet: true,
          bonfireFiremakingLevel: 999,
          totemOfVitality: true,
          thermalBath: true,
          overheal: "soup-line",
          powerburstOfVitalityUntil: now + 99_000,
        },
      },
      now,
    );
    expect(next.buffs).toMatchObject({
      styleCurse: "turmoil",
      fortitude: false,
      reaperCrew: true,
      fontOfLife: true,
      boonOfHet: true,
      bonfireFiremakingLevel: null,
      totemOfVitality: true,
      thermalBath: true,
      overheal: "soup-line",
      powerburstOfVitalityUntil: now + POWERBURST_DURATION_MS,
      powerburstOfVitalityCooldownUntil: now + POWERBURST_COOLDOWN_MS,
    });
    expect(
      normalizeLoadout({ buffs: { powerburstOfVitalityUntil: now } }, now).buffs
        .powerburstOfVitalityUntil,
    ).toBeNull();
  });

  it("enforces prayer and maximum-life incompatibilities when controls change", () => {
    const fortified = withLoadoutBuffs(
      { ...DEFAULT_LOADOUT, buffs: { ...DEFAULT_LOADOUT.buffs, styleCurse: "turmoil" } },
      { fortitude: true },
    );
    expect(fortified.buffs).toMatchObject({ fortitude: true, styleCurse: "none" });
    const cursed = withLoadoutBuffs(fortified, { styleCurse: "turmoil" });
    expect(cursed.buffs).toMatchObject({ fortitude: false, styleCurse: "turmoil" });

    const bonfire = withLoadoutBuffs(DEFAULT_LOADOUT, { bonfireFiremakingLevel: 110 });
    expect(bonfire.buffs.totemOfVitality).toBe(false);
    const totem = withLoadoutBuffs(bonfire, { totemOfVitality: true });
    expect(totem.buffs).toMatchObject({ bonfireFiremakingLevel: null, totemOfVitality: true });
  });

  it("enforces Powerburst's six-second window and two-minute cooldown", () => {
    const now = 40_000;
    const next = activatePowerburstOfVitality(DEFAULT_LOADOUT, now);
    expect(next.buffs.powerburstOfVitalityUntil).toBe(now + POWERBURST_DURATION_MS);
    expect(next.buffs.powerburstOfVitalityCooldownUntil).toBe(now + POWERBURST_COOLDOWN_MS);
    expect(isPowerburstOfVitalityReady(next, now + POWERBURST_DURATION_MS)).toBe(false);

    const afterWindow = normalizeLoadout(next, now + POWERBURST_DURATION_MS);
    expect(afterWindow.buffs.powerburstOfVitalityUntil).toBeNull();
    expect(afterWindow.buffs.powerburstOfVitalityCooldownUntil).toBe(now + POWERBURST_COOLDOWN_MS);
    expect(activatePowerburstOfVitality(afterWindow, now + POWERBURST_DURATION_MS)).toBe(
      afterWindow,
    );
    expect(isPowerburstOfVitalityReady(afterWindow, now + POWERBURST_COOLDOWN_MS)).toBe(true);
  });

  it("merges slotted ids with unlock-only pins from legacy equipmentIds", () => {
    const next = normalizeLoadout({
      equipmentSlots: { mainhand: "item:a", helmet: "item:b" },
      equipmentIds: ["item:a", "item:unlock-only", "item:b"],
    });
    expect(next.equipmentIds).toEqual(["item:a", "item:b", "item:unlock-only"]);
    expect(unlockOnlyIds(next)).toEqual(["item:unlock-only"]);
  });

  it("keeps only unique known equipment enchantments", () => {
    expect(
      normalizeLoadout({ enchantments: ["agony", "agony", "unknown", 1] }).enchantments,
    ).toEqual(["agony"]);
  });

  it("defaults missing account enchantments on and preserves an explicit choice", () => {
    expect(normalizeLoadout({}).enchantments).toEqual([
      "agony",
      "heroism",
      "shadows",
      "metaphysics",
    ]);
    expect(toggleEquipmentEnchantment(DEFAULT_LOADOUT, "agony").enchantments).not.toContain(
      "agony",
    );
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

  it("default known drops catalogue-absent ids (deleted corpus items)", () => {
    const raw = {
      ...DEFAULT_LOADOUT,
      equipmentSlots: {
        pocket: "item:berserker-aura",
        helmet: "item:sirenic-mask",
      },
      equipmentIds: ["item:berserker-aura", "item:sirenic-mask", "item:not-in-catalogue"],
    };
    const next = pruneUnknownEquipment(raw);
    expect(next.equipmentSlots.pocket).toBeUndefined();
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

  it("equipment, equipment clearing, and style changes return manual base mode to automatic", () => {
    const manual = {
      ...DEFAULT_LOADOUT,
      baseDamage: { mode: "manual" as const, manualValue: 4321 },
    };
    expect(equipInSlot(manual, "helmet", "item:helm").baseDamage.mode).toBe("automatic");
    expect(clearEquipment(manual).baseDamage.mode).toBe("automatic");
    expect(withCombatStyle(manual, "magic").baseDamage.mode).toBe("automatic");
  });
});

describe("level helpers", () => {
  it("withStyleLevel leaves saved melee levels intact", () => {
    const next = withStyleLevel(DEFAULT_LOADOUT, 120);
    expect(next).toMatchObject({ level: 120, attackLevel: 99, strengthLevel: 99 });
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

describe("gizmo layout", () => {
  it("places a perk and moves it between gizmos rather than duplicating", () => {
    const placed = placePerkOnGizmo(DEFAULT_LOADOUT, "weapon1", "aftershock");
    expect(placed.gizmos.weapon1).toEqual(["aftershock"]);
    expect(gizmoSlotOf(placed.gizmos, "aftershock")).toBe("weapon1");

    const moved = placePerkOnGizmo(placed, "weapon2", "aftershock");
    expect(moved.gizmos.weapon1).toBeUndefined();
    expect(moved.gizmos.weapon2).toEqual(["aftershock"]);
  });

  it("rejects weapon-only perks on armour gizmos", () => {
    const placed = placePerkOnGizmo(DEFAULT_LOADOUT, "armour1", "aftershock");
    expect(placed).toBe(DEFAULT_LOADOUT);
  });

  it("rejects a third perk on a full gizmo", () => {
    let loadout = placePerkOnGizmo(DEFAULT_LOADOUT, "weapon1", "aftershock");
    loadout = placePerkOnGizmo(loadout, "weapon1", "equilibrium");
    const full = placePerkOnGizmo(loadout, "weapon1", "biting");
    expect(full.gizmos.weapon1).toEqual(["aftershock", "equilibrium"]);
    expect(gizmoSlotOf(full.gizmos, "biting")).toBeNull();
  });

  it("removePerkFromGizmos clears the perk but keeps its rank", () => {
    const placed = placePerkOnGizmo({ ...DEFAULT_LOADOUT }, "armour2", "biting");
    const cleared = removePerkFromGizmos(placed, "biting");
    expect(cleared.gizmos.armour2).toBeUndefined();
    expect(cleared.perks.biting).toBe(DEFAULT_LOADOUT.perks.biting);
  });

  it("normalizes stored gizmos: unknown keys, flags, overflow and duplicates drop", () => {
    const { gizmos } = normalizeLoadout({
      gizmos: {
        weapon1: ["aftershock", "not-a-perk", "eliteTectonic", "biting", "equilibrium"],
        // Duplicate of a perk already claimed by weapon1 — first slot wins.
        armour1: ["aftershock", "lunging", "impatient"],
        madeUpSlot: ["biting"],
      },
    });
    expect(gizmos.weapon1).toEqual(["aftershock", "biting"]);
    expect(gizmos.armour1).toEqual(["impatient"]);
    expect(Object.keys(gizmos)).toEqual(["weapon1", "armour1"]);
  });

  it("a loadout stored before gizmos existed normalizes to an empty layout", () => {
    expect(normalizeLoadout({ style: "magic" }).gizmos).toEqual({});
  });
});
