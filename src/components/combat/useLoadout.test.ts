import { describe, expect, it } from "vitest";
import { POWERBURST_COOLDOWN_MS, POWERBURST_DURATION_MS } from "@/combat";
import {
  DEFAULT_LOADOUT,
  ARMOUR_GIZMO_CAPACITY,
  GIZMO_CAPACITY,
  gizmoCapacity,
  GIZMO_SLOTS,
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
  weaponStyle,
  withLoadoutBuffs,
  withAttackLevel,
  withCombatStyle,
  withStrengthLevel,
  withStyleLevel,
} from "./useLoadout";

describe("normalizeLoadout", () => {
  it("normalizes player poison controls for old and invalid saves", () => {
    expect(normalizeLoadout({}).buffs).toMatchObject({
      weaponPoison: "none",
      kwuarmPotency: 0,
      herbloreLevel: 99,
    });
    expect(
      normalizeLoadout({
        buffs: { weaponPoison: "weapon-plus-plus-plus", kwuarmPotency: 4 },
      }).buffs,
    ).toMatchObject({ weaponPoison: "weapon-plus-plus-plus", kwuarmPotency: 4 });
    expect(
      normalizeLoadout({ buffs: { weaponPoison: "invented", kwuarmPotency: 99 } }).buffs,
    ).toMatchObject({ weaponPoison: "none", kwuarmPotency: 0 });
    expect(normalizeLoadout({ buffs: { herbloreLevel: 120 } }).buffs.herbloreLevel).toBe(120);
    expect(normalizeLoadout({ buffs: { herbloreLevel: 999 } }).buffs.herbloreLevel).toBe(120);
  });
  it("returns defaults for null / non-objects", () => {
    expect(normalizeLoadout(null)).toEqual(DEFAULT_LOADOUT);
    expect(normalizeLoadout("nope")).toEqual(DEFAULT_LOADOUT);
  });

  it("defaults stored loadouts to automatic base damage and drops legacy overrides", () => {
    const legacy = normalizeLoadout({ base: 777, startingAdrenaline: 140 });
    expect(legacy.baseDamage).toEqual({ mode: "automatic" });
    expect(legacy.startingAdrenaline).toBe(100);
    expect(legacy.hitCapEnabled).toBe(false);
    expect(legacy.loadoutSchemaVersion).toBe(4);

    const manual = normalizeLoadout({
      baseDamage: { mode: "manual", manualValue: 1234 },
      startingAdrenaline: -5,
      hitCapEnabled: true,
    });
    expect(manual.baseDamage).toEqual({ mode: "automatic" });
    expect(manual.startingAdrenaline).toBe(0);
    expect(manual.hitCapEnabled).toBe(true);
  });

  it("migrates pre-v2 stored startingAdrenaline 0 to open-at-max null", () => {
    expect(normalizeLoadout({ startingAdrenaline: 0 }).startingAdrenaline).toBeNull();
    expect(normalizeLoadout({ startingAdrenaline: 0 }).loadoutSchemaVersion).toBe(4);
    expect(normalizeLoadout({}).startingAdrenaline).toBeNull();
    // Intentional 0 after schema v2 is preserved.
    expect(
      normalizeLoadout({ loadoutSchemaVersion: 2, startingAdrenaline: 0 }).startingAdrenaline,
    ).toBe(0);
    expect(
      normalizeLoadout({ loadoutSchemaVersion: 2, startingAdrenaline: 72 }).startingAdrenaline,
    ).toBe(72);
  });

  it("migrates a pre-v4 boss preset attack rate for incoming-hit effects", () => {
    const migrated = normalizeLoadout({
      loadoutSchemaVersion: 3,
      style: "melee",
      target: {
        targetPresetId: "boss:commander-zilyana",
        defenceLevel: 75,
        armour: 1694,
        affinity: 55,
      },
    });
    expect(migrated.loadoutSchemaVersion).toBe(4);
    expect(migrated.target?.incomingHitIntervalSeconds).toBe(1.2);

    const manual = normalizeLoadout({
      loadoutSchemaVersion: 3,
      style: "melee",
      target: {
        targetPresetId: "boss:commander-zilyana",
        defenceLevel: 75,
        armour: 1694,
        affinity: 55,
        incomingHitIntervalSeconds: 4.2,
      },
    });
    expect(manual.target?.incomingHitIntervalSeconds).toBe(4.2);

    const clearedAfterMigration = normalizeLoadout({
      loadoutSchemaVersion: 4,
      style: "melee",
      target: {
        targetPresetId: "boss:commander-zilyana",
        defenceLevel: 75,
        armour: 1694,
        affinity: 55,
      },
    });
    expect(clearedAfterMigration.target?.incomingHitIntervalSeconds).toBeUndefined();
  });

  it("ignores legacy manual base values", () => {
    expect(
      normalizeLoadout({ baseDamage: { mode: "manual", manualValue: -4 } }).baseDamage,
    ).toEqual({ mode: "automatic" });
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
      target: { defenceLevel: 88, armour: 420, affinity: 50 },
      baseDamage: { mode: "manual", manualValue: 4321 },
      startingAdrenaline: 72,
      hitCapEnabled: false,
    });

    expect(next).toMatchObject({
      // Stored "ranged" loses to the equipped seismic wand, which is magic.
      style: "magic",
      level: 108,
      attackLevel: 82,
      strengthLevel: 91,
      defenceLevel: 99,
      constitutionLevel: 99,
      currentLife: null,
      currentHealthPercent: 50,
      equipmentSlots: { mainhand: "item:seismic-wand" },
      equipmentIds: ["item:seismic-wand", "item:unlock-pin"],
      enchantments: ["agony"],
      perks: { biting: 4, impatient: 3 },
      // Anguish is the ranged curse, so following the wand moves it to Torment.
      buffs: { vulnerability: true, styleCurse: "torment", overload: "elder" },
      target: { defenceLevel: 88, armour: 420, affinity: 50 },
      baseDamage: { mode: "automatic" },
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

  it("normalizes the area-target scenario for persisted loadouts", () => {
    expect(
      normalizeLoadout({
        target: {
          defenceLevel: 80,
          affinity: 60,
          size: 3.8,
          occupiedTiles: 4,
          areaTargets: 7.9,
        },
      }).target,
    ).toMatchObject({ size: 3, occupiedTiles: 4, areaTargets: 7 });
    expect(
      normalizeLoadout({
        target: { defenceLevel: 80, affinity: 60, areaTargets: 0 },
      }).target?.areaTargets,
    ).toBe(1);
  });

  it("fills missing buffs and equipmentSlots", () => {
    const next = normalizeLoadout({ style: "magic", level: 99 });
    expect(next.buffs).toEqual(DEFAULT_LOADOUT.buffs);
    expect(next.currentHealthPercent).toBe(50);
    expect(next.equipmentSlots).toEqual({});
    expect(next.equipmentIds).toEqual([]);
    expect(next.perks.equilibrium).toBe(0);
    expect(next.perks.invigorating).toBe(0);
    expect(next.perks.impatient).toBe(0);
    expect(next.perks.impatientLevel20).toBe(false);
    expect(next.perks.plantedFeet).toBe(0);
  });

  it("migrates legacy affinity kind strings to exact percents", () => {
    expect(
      normalizeLoadout({ target: { defenceLevel: 80, affinity: "weak" } }).target?.affinity,
    ).toBe(70);
    expect(
      normalizeLoadout({ target: { defenceLevel: 80, affinity: "same" } }).target?.affinity,
    ).toBe(60);
    expect(
      normalizeLoadout({ target: { defenceLevel: 80, affinity: "strong" } }).target?.affinity,
    ).toBe(50);
    expect(
      normalizeLoadout({ target: { defenceLevel: 80, affinity: "weakness" } }).target?.affinity,
    ).toBe(90);
  });

  it("accepts exact numeric affinity including arbitrary 55", () => {
    expect(normalizeLoadout({ target: { defenceLevel: 80, affinity: 55 } }).target?.affinity).toBe(
      55,
    );
    expect(normalizeLoadout({ target: { defenceLevel: 80, affinity: 0 } }).target?.affinity).toBe(
      1,
    );
    expect(normalizeLoadout({ target: { defenceLevel: 80, affinity: 200 } }).target?.affinity).toBe(
      100,
    );
  });

  it("keeps a target when affinity is valid and drops only unusable affinity", () => {
    expect(normalizeLoadout({ target: { defenceLevel: 80, affinity: "nope" } }).target).toBeNull();
    expect(
      normalizeLoadout({
        target: { defenceLevel: 99, armour: 10, affinity: 55, demon: true },
      }).target,
    ).toMatchObject({ defenceLevel: 99, armour: 10, affinity: 55, demon: true });
  });

  it("drops the removed Aegis basis from saved builds", () => {
    const next = normalizeLoadout({ buffs: { aegisArmourBasis: "total-rating" } });
    expect(next.buffs).not.toHaveProperty("aegisArmourBasis");
  });

  it("migrates legacy berserkersFury buff into archaeology.selectedIds", () => {
    const next = normalizeLoadout({ buffs: { berserkersFury: true } });
    expect(next.archaeology.selectedIds).toContain("berserkers_fury");
    expect(next.buffs.berserkersFury).toBe(true);
  });

  it("syncs full archaeology buff flags from selectedIds", () => {
    // 350+150=500 under default 500; conservation (350) needs room of its own.
    const withHsFotS = normalizeLoadout({
      archaeology: {
        energyCap: 500,
        selectedIds: ["heightened_senses", "fury_of_the_small"],
      },
    });
    expect(withHsFotS.buffs.heightenedSenses).toBe(true);
    expect(withHsFotS.buffs.furyOfTheSmall).toBe(true);
    expect(withHsFotS.buffs.conservationOfEnergy).toBe(false);
    expect(withHsFotS.buffs.berserkersFury).toBe(false);
    expect(withHsFotS.archaeology.selectedIds).toEqual(["heightened_senses", "fury_of_the_small"]);

    // 350+150=500 under 650; HS+CoE is 700 so still illegal at extended cap.
    const withCoE = normalizeLoadout({
      archaeology: {
        energyCap: 650,
        selectedIds: ["conservation_of_energy", "fury_of_the_small"],
      },
    });
    expect(withCoE.buffs.conservationOfEnergy).toBe(true);
    expect(withCoE.buffs.furyOfTheSmall).toBe(true);
    expect(withCoE.buffs.heightenedSenses).toBe(false);
    expect(withCoE.archaeology.energyCap).toBe(650);
  });

  it("defaults archaeology to empty selection at 500 energy", () => {
    expect(DEFAULT_LOADOUT.archaeology).toEqual({ selectedIds: [], energyCap: 500 });
    expect(normalizeLoadout(null).archaeology).toEqual({ selectedIds: [], energyCap: 500 });
  });
  it("preserves plantedFeet rank; migrates legacy boolean true to 1", () => {
    expect(normalizeLoadout({ perks: { plantedFeet: true } }).perks.plantedFeet).toBe(1);
    expect(normalizeLoadout({ perks: { plantedFeet: 1 } }).perks.plantedFeet).toBe(1);
    expect(normalizeLoadout({ perks: { plantedFeet: false } }).perks.plantedFeet).toBe(0);
    expect(normalizeLoadout({ perks: {} }).perks.plantedFeet).toBe(0);
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
          bonfireLogType: "elder",
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
      bonfireLogType: null,
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
    expect(bonfire.buffs).toMatchObject({ bonfireLogType: "normal", totemOfVitality: false });
    const totem = withLoadoutBuffs(bonfire, { totemOfVitality: true });
    expect(totem.buffs).toMatchObject({
      bonfireLogType: null,
      bonfireFiremakingLevel: null,
      totemOfVitality: true,
    });
    const elder = withLoadoutBuffs(totem, { bonfireLogType: "elder" });
    expect(elder.buffs).toMatchObject({
      bonfireLogType: "elder",
      bonfireFiremakingLevel: 110,
      totemOfVitality: false,
    });
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

  it("equipment and style changes preserve automatic base calculation", () => {
    const automatic = { ...DEFAULT_LOADOUT };
    expect(equipInSlot(automatic, "helmet", "item:helm").baseDamage).toEqual({ mode: "automatic" });
    expect(clearEquipment(automatic).baseDamage).toEqual({ mode: "automatic" });
    expect(withCombatStyle(automatic, "magic").baseDamage).toEqual({ mode: "automatic" });
  });
});

describe("weapon-driven combat style", () => {
  it("takes the style from the equipped weapon rather than the stored one", () => {
    expect(
      normalizeLoadout({ style: "melee", equipmentSlots: { mainhand: "item:seismic-wand" } }),
    ).toMatchObject({ style: "magic" });
    expect(
      normalizeLoadout({ style: "magic", equipmentSlots: { twohand: "item:ek-zekkil" } }),
    ).toMatchObject({ style: "melee" });
  });

  it("lets a two-hand weapon outrank a stale main-hand entry", () => {
    expect(weaponStyle({ twohand: "item:ek-zekkil", mainhand: "item:seismic-wand" })).toBe("melee");
  });

  it("keeps the stored style while no weapon is equipped", () => {
    expect(weaponStyle({ helmet: "item:primal-full-helm-plus-5" })).toBeNull();
    expect(weaponStyle(undefined)).toBeNull();
    expect(normalizeLoadout({ style: "ranged" })).toMatchObject({ style: "ranged" });
  });

  it("switches style as the weapon is equipped and keeps it when unequipped", () => {
    const magic = equipInSlot(DEFAULT_LOADOUT, "mainhand", "item:seismic-wand");
    expect(magic.style).toBe("magic");
    const ranged = equipInSlot(magic, "mainhand", "item:ascension-crossbow");
    expect(ranged.style).toBe("ranged");
    // Removing the weapon leaves the last style in place instead of snapping back.
    expect(equipInSlot(ranged, "mainhand", null).style).toBe("ranged");
  });

  it("carries an active damage prayer to the matching tier in the new style", () => {
    const melee = { ...DEFAULT_LOADOUT, style: "melee" as const };
    const cursed = withLoadoutBuffs(melee, { styleCurse: "turmoil" });
    expect(withCombatStyle(cursed, "magic").buffs.styleCurse).toBe("torment");
    // The 99 tier maps to its own counterparts, not down to the 95 tier.
    const upgraded = withLoadoutBuffs(melee, { styleCurse: "malevolence" });
    expect(withCombatStyle(upgraded, "necromancy").buffs.styleCurse).toBe("ruination");
    // Standard book Piety line remaps across styles.
    const piety = withLoadoutBuffs(melee, { styleCurse: "piety" });
    expect(withCombatStyle(piety, "ranged").buffs.styleCurse).toBe("rigour");
    expect(withCombatStyle(piety, "magic").buffs.styleCurse).toBe("augury");
    expect(withCombatStyle(piety, "necromancy").buffs.styleCurse).toBe("sanctity");
    // No prayer stays none.
    expect(withCombatStyle(melee, "ranged").buffs.styleCurse).toBe("none");
  });

  it("carries the melee damage level across a style switch", () => {
    const melee = { ...DEFAULT_LOADOUT, style: "melee" as const, strengthLevel: 91, level: 91 };
    expect(withCombatStyle(melee, "magic").level).toBe(91);
    expect(withCombatStyle(melee, "melee")).toBe(melee);
  });
});

describe("level helpers", () => {
  it("withStyleLevel leaves saved melee levels intact", () => {
    const next = withStyleLevel(DEFAULT_LOADOUT, 110);
    expect(next).toMatchObject({ level: 110, attackLevel: 120, strengthLevel: 120 });
  });

  it("withAttackLevel only changes attack; withStrengthLevel also updates level alias", () => {
    const atk = withAttackLevel(DEFAULT_LOADOUT, 70);
    expect(atk.attackLevel).toBe(70);
    expect(atk.strengthLevel).toBe(120);
    expect(atk.level).toBe(120);
    const str = withStrengthLevel(DEFAULT_LOADOUT, 115);
    expect(str.strengthLevel).toBe(115);
    expect(str.level).toBe(115);
    expect(str.attackLevel).toBe(120);
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

  it("rejects a third perk on a full weapon gizmo", () => {
    let loadout = placePerkOnGizmo(DEFAULT_LOADOUT, "weapon1", "aftershock");
    loadout = placePerkOnGizmo(loadout, "weapon1", "equilibrium");
    const full = placePerkOnGizmo(loadout, "weapon1", "biting");
    expect(full.gizmos.weapon1).toEqual(["aftershock", "equilibrium"]);
    expect(gizmoSlotOf(full.gizmos, "biting")).toBeNull();
  });

  it("allows four perks on armour shells and rejects a fifth", () => {
    expect(gizmoCapacity("armour1")).toBe(ARMOUR_GIZMO_CAPACITY);
    expect(gizmoCapacity("armour2")).toBe(ARMOUR_GIZMO_CAPACITY);
    expect(gizmoCapacity("weapon1")).toBe(GIZMO_CAPACITY);
    let loadout = placePerkOnGizmo(DEFAULT_LOADOUT, "armour1", "biting");
    loadout = placePerkOnGizmo(loadout, "armour1", "impatient");
    loadout = placePerkOnGizmo(loadout, "armour1", "invigorating");
    loadout = placePerkOnGizmo(loadout, "armour1", "energising");
    expect(loadout.gizmos.armour1).toEqual(["biting", "impatient", "invigorating", "energising"]);
    const full = placePerkOnGizmo(loadout, "armour1", "ultimatums");
    expect(full.gizmos.armour1).toEqual(loadout.gizmos.armour1);
    expect(gizmoSlotOf(full.gizmos, "ultimatums")).toBeNull();
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
        // Duplicate of a perk already claimed by weapon1 - first slot wins.
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

  it("exposes two weapon shells and two armour shells (body + legs)", () => {
    expect(GIZMO_SLOTS).toEqual(["weapon1", "weapon2", "armour1", "armour2"]);
    expect(GIZMO_CAPACITY).toBe(2);
    expect(ARMOUR_GIZMO_CAPACITY).toBe(4);
    let loadout = placePerkOnGizmo(DEFAULT_LOADOUT, "armour1", "biting");
    loadout = placePerkOnGizmo(loadout, "armour2", "impatient");
    expect(loadout.gizmos.armour1).toEqual(["biting"]);
    expect(loadout.gizmos.armour2).toEqual(["impatient"]);
    expect(gizmoSlotOf(loadout.gizmos, "biting")).toBe("armour1");
    expect(gizmoSlotOf(loadout.gizmos, "impatient")).toBe("armour2");
  });
});

describe("skillcape buffs", () => {
  it("defaults skillcape perks off and normalizes truthy flags", () => {
    expect(DEFAULT_LOADOUT.buffs.strengthCape99).toBe(false);
    expect(DEFAULT_LOADOUT.buffs.attackCape120).toBe(false);
    expect(normalizeLoadout({ buffs: { strengthCape99: true } }).buffs.strengthCape99).toBe(true);
    expect(normalizeLoadout({ buffs: { attackCape120: 1 } }).buffs.attackCape120).toBe(false);
    expect(normalizeLoadout({ buffs: { attackCape120: true } }).buffs.attackCape120).toBe(true);
  });

  it("normalizes enchanted-bolt account and target facts conservatively", () => {
    expect(DEFAULT_LOADOUT.buffs.eliteSeersVillage).toBe(false);
    expect(
      normalizeLoadout({
        buffs: { eliteSeersVillage: true },
        target: { defenceLevel: 80, affinity: 60 },
      }),
    ).toMatchObject({
      buffs: { eliteSeersVillage: true },
      target: { elementalWeakness: "unknown", dragonfireImmune: false },
    });
    expect(
      normalizeLoadout({
        target: {
          defenceLevel: 80,
          affinity: 60,
          elementalWeakness: "water",
          dragonfireImmune: true,
        },
      }).target,
    ).toMatchObject({ elementalWeakness: "water", dragonfireImmune: true });
    expect(
      normalizeLoadout({
        target: {
          defenceLevel: 80,
          affinity: 60,
          elementalWeakness: "invented",
          dragonfireImmune: 1,
        },
      }).target,
    ).toMatchObject({ elementalWeakness: "unknown", dragonfireImmune: false });
  });
});
