import { describe, expect, it } from "vitest";
import { runPipeline } from "../pipeline/modifierPipeline";
import {
  AFFLICTION,
  ANGUISH,
  AUGURY,
  MALEVOLENCE,
  PIETY,
  RIGOUR,
  SANCTITY,
  SORROW,
  STANDARD_DAMAGE_PRAYERS,
  STYLE_CURSES,
  TORMENT,
  TURMOIL,
  bestStyleCurse,
  prayerBoostedStyleLevel,
  prayerDamageModifier,
  styleCurseById,
} from "./prayers";

describe("damage prayers", () => {
  it("covers standard book Piety line at +8% damage", () => {
    expect(PIETY).toMatchObject({
      style: "melee",
      damageBonus: 0.08,
      accuracyLevels: 8,
      book: "standard",
    });
    expect(RIGOUR).toMatchObject({ style: "ranged", damageBonus: 0.08, book: "standard" });
    expect(AUGURY).toMatchObject({ style: "magic", damageBonus: 0.08, book: "standard" });
    expect(SANCTITY).toMatchObject({ style: "necromancy", damageBonus: 0.08, book: "standard" });
    expect(STANDARD_DAMAGE_PRAYERS.map((p) => p.id)).toEqual([
      "piety",
      "rigour",
      "augury",
      "sanctity",
    ]);
  });

  it("covers one Turmoil-line curse per style at +10% damage", () => {
    expect(TURMOIL).toMatchObject({ style: "melee", damageBonus: 0.1, accuracyLevels: 10, book: "ancient" });
    expect(ANGUISH).toMatchObject({ style: "ranged", damageBonus: 0.1, accuracyLevels: 10 });
    expect(TORMENT).toMatchObject({ style: "magic", damageBonus: 0.1, accuracyLevels: 10 });
    expect(SORROW).toMatchObject({ style: "necromancy", damageBonus: 0.1, accuracyLevels: 10 });
  });

  it("covers Praesul upgrades at +12% damage", () => {
    expect(MALEVOLENCE.damageBonus).toBe(0.12);
    expect(AFFLICTION.damageBonus).toBe(0.12);
    expect(bestStyleCurse("melee").id).toBe("malevolence");
    expect(bestStyleCurse("necromancy").id).toBe("ruination");
  });

  it("every prayer carries a wiki SourceReference and book tag", () => {
    for (const c of STYLE_CURSES) {
      expect(c.source.verifiedAt, c.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.source.url, c.id).toContain("runescape.wiki");
      expect(c.book === "standard" || c.book === "ancient", c.id).toBe(true);
    }
  });

  it("damage modifier multiplies at ability stage and is style-gated", () => {
    const mod = prayerDamageModifier(SORROW);
    expect(runPipeline({ damage: 1000 }, [mod], { style: "necromancy" }).damage).toBe(1100);
    expect(runPipeline({ damage: 1000 }, [mod], { style: "melee" }).damage).toBe(1000);
  });

  it("Piety floors 8% of 1000 -> 1080; Malevolence 12% -> 1120", () => {
    expect(runPipeline({ damage: 1000 }, [prayerDamageModifier(PIETY)], { style: "melee" }).damage).toBe(
      1080,
    );
    expect(
      runPipeline({ damage: 1000 }, [prayerDamageModifier(MALEVOLENCE)], { style: "melee" }).damage,
    ).toBe(1120);
  });

  it("accuracy level helper adds the prayer bonus", () => {
    expect(prayerBoostedStyleLevel(99, PIETY)).toBe(107);
    expect(prayerBoostedStyleLevel(99, TURMOIL)).toBe(109);
    expect(prayerBoostedStyleLevel(99, null)).toBe(99);
    expect(styleCurseById("torment")?.name).toBe("Torment");
    expect(styleCurseById("piety")?.name).toBe("Piety");
  });
});
