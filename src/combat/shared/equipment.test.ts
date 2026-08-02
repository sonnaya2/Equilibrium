import { describe, expect, it } from "vitest";
import {
  activeEquipmentEffects,
  deathdealer90SetFacts,
  equipmentSetById,
  equippedSetCounts,
  firstNecromancerConjureDamageMult,
  firstNecromancerConjureDurationMult,
  firstNecromancerSetFacts,
  loadoutFirstNecromancerConjureDamageMult,
  loadoutSetCritChance,
  setDamageModifiers,
  setEffectsSummary,
  tectonicSet,
  tumekensSunshineSet,
  vestmentsOfHavocSetFacts,
} from "./equipment";

describe("shared/equipment set effects", () => {
  it("makes the pre-activated static-loadout model explicit", () => {
    const effects = activeEquipmentEffects({
      style: "melee",
      equipmentIds: [
        "item:vestments-of-havoc-hood",
        "item:vestments-of-havoc-robe-top",
        "item:vestments-of-havoc-robe-bottom",
        "item:vestments-of-havoc-boots",
      ],
    });
    expect(effects.activation).toBe("pre-activated-static-loadout");
    expect(effects.vestments).toMatchObject({
      pieces: 4,
      heraldOfChaos: true,
      berserkExtension: true,
      increasedAdrenalineCap: true,
    });
  });

  it("tectonic grants +1% crit chance per piece, elite +2%", () => {
    expect(tectonicSet(3).critChanceBonus).toBeCloseTo(0.03, 10);
    expect(tectonicSet(3, true).critChanceBonus).toBeCloseTo(0.06, 10);
    expect(tectonicSet(0).critChanceBonus).toBe(0);
  });

  it("Tumeken's set(3) applies only inside Sunshine", () => {
    expect(tumekensSunshineSet(3, true).critChanceBonus).toBeCloseTo(0.045, 10);
    expect(tumekensSunshineSet(3, false).critChanceBonus).toBe(0);
  });

  it("Tumeken's crit requires at least 3 pieces", () => {
    expect(tumekensSunshineSet(2, true).critChanceBonus).toBe(0);
    expect(tumekensSunshineSet(1, true).critChanceBonus).toBe(0);
  });

  it("rejects impossible piece counts", () => {
    expect(() => tectonicSet(4)).toThrow(RangeError);
    expect(() => tumekensSunshineSet(-1, true)).toThrow(RangeError);
  });

  it("every set effect carries provenance", () => {
    expect(tectonicSet(3).source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tumekensSunshineSet(3, true).source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("3 tectonic pieces from mock equipment → +3% crit", () => {
    const loadout = {
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
    };
    const counts = equippedSetCounts(loadout);
    expect(counts.get("tectonic")).toBe(3);
    expect(loadoutSetCritChance(loadout)).toBeCloseTo(0.03, 10);
  });

  it("tumeken 3 in sunshine → +4.5%", () => {
    const loadout = {
      equipmentSlots: {
        helmet: "item:tumekens-resplendence-helm",
        body: "item:tumekens-resplendence-body",
        legs: "item:tumekens-resplendence-legs",
      },
      insideSunshine: true,
    };
    expect(equippedSetCounts(loadout).get("tumekens-resplendence")).toBe(3);
    expect(loadoutSetCritChance(loadout)).toBeCloseTo(0.045, 10);
    expect(loadoutSetCritChance({ ...loadout, insideSunshine: false })).toBe(0);
  });

  it("empty gear → 0 set crit", () => {
    expect(loadoutSetCritChance({ equipmentSlots: {} })).toBe(0);
    expect(loadoutSetCritChance({})).toBe(0);
  });

  it("does not activate set bonuses without equipped pieces", () => {
    expect(loadoutSetCritChance({ equipmentSlots: {} })).toBe(0);
  });

  it("elite tectonic gear uses +2%/piece", () => {
    const loadout = {
      equipmentSlots: {
        helmet: "item:elite-tectonic-mask",
        body: "item:elite-tectonic-robe-top",
        legs: "item:elite-tectonic-robe-bottom",
      },
    };
    expect(equippedSetCounts(loadout).get("elite-tectonic")).toBe(3);
    expect(loadoutSetCritChance(loadout)).toBeCloseTo(0.06, 10);
  });

  it("setEffectsSummary lists equipped catalogue sets", () => {
    const summary = setEffectsSummary({
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
    });
    expect(summary).toEqual([
      {
        setId: "tectonic",
        pieces: 3,
        label: "Tectonic (Fracture Point)",
        support: "modeled",
      },
    ]);
    expect(setEffectsSummary({ equipmentSlots: {} })).toEqual([]);
  });

  it("facts-only helpers return 0 modifiers with wiki facts", () => {
    const fn = firstNecromancerSetFacts(5);
    expect(fn.modifiers).toEqual([]);
    expect(fn.facts.length).toBeGreaterThan(0);
    expect(fn.source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const vest = vestmentsOfHavocSetFacts(4);
    expect(vest.modifiers).toEqual([]);
    expect(vest.facts.some((f) => /adrenaline/i.test(f))).toBe(true);

    const dd = deathdealer90SetFacts(5);
    expect(dd.modifiers).toEqual([]);
    expect(dd.facts.some((f) => /Death Mark/i.test(f))).toBe(true);
  });

  it("firstNecromancerConjureDamageMult is +7%/piece from set(2), cap 5", () => {
    expect(firstNecromancerConjureDamageMult(0)).toBe(1);
    expect(firstNecromancerConjureDamageMult(1)).toBe(1);
    expect(firstNecromancerConjureDamageMult(2)).toBeCloseTo(1.14, 10);
    expect(firstNecromancerConjureDamageMult(3)).toBeCloseTo(1.21, 10);
    expect(firstNecromancerConjureDamageMult(5)).toBeCloseTo(1.35, 10);
    expect(firstNecromancerConjureDamageMult(9)).toBeCloseTo(1.35, 10);
  });

  it("First Necromancer set(4+) extends conjure lifetime by 5% per piece", () => {
    expect(firstNecromancerConjureDurationMult(3)).toBe(1);
    expect(firstNecromancerConjureDurationMult(4)).toBeCloseTo(1.2, 10);
    expect(firstNecromancerConjureDurationMult(5)).toBeCloseTo(1.25, 10);
  });

  it("the First Necromancer visage counts as two pieces and the set caps at five", () => {
    const loadout = {
      equipmentSlots: {
        helmet: "item:visage-of-the-first-necromancer",
        body: "item:first-necromancer-body",
        legs: "item:first-necromancer-legs",
        gloves: "item:first-necromancer-gloves",
        boots: "item:first-necromancer-boots",
      },
    };
    expect(equippedSetCounts(loadout).get("first-necromancer")).toBe(5);
    expect(setEffectsSummary(loadout)[0]?.pieces).toBe(5);
    expect(loadoutFirstNecromancerConjureDamageMult(loadout)).toBeCloseTo(1.35, 10);
  });

  it("loadout First Necro gear drives conjure mult; not player setDamageModifiers", () => {
    const loadout = {
      equipmentSlots: {
        helmet: "item:first-necromancer-helm",
        body: "item:first-necromancer-body",
        legs: "item:first-necromancer-legs",
        gloves: "item:first-necromancer-gloves",
        boots: "item:first-necromancer-boots",
      },
    };
    expect(equippedSetCounts(loadout).get("first-necromancer")).toBe(5);
    expect(loadoutFirstNecromancerConjureDamageMult(loadout)).toBeCloseTo(1.35, 10);
    expect(setDamageModifiers(equippedSetCounts(loadout))).toEqual([]);
    expect(equipmentSetById("first-necromancer")?.effects).toEqual([]);
  });

  it("catalogue documents anima core / vestments / trimmed as non-player-AD", () => {
    for (const id of [
      "vestments-of-havoc",
      "trimmed-masterwork",
      "virtus",
      "anima-core-zaros",
      "anima-core-seren",
      "anima-core-zamorak",
      "anima-core-sliske",
    ]) {
      const def = equipmentSetById(id);
      expect(def, id).toBeDefined();
      expect(def!.effects, id).toEqual([]);
      expect(def!.source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
