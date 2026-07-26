import { describe, expect, it } from "vitest";
import { runPipeline } from "../pipeline/modifierPipeline";
import {
  AFFLICTION,
  ANGUISH,
  MALEVOLENCE,
  SORROW,
  STYLE_CURSES,
  TORMENT,
  TURMOIL,
  bestStyleCurse,
  prayerBoostedStyleLevel,
  prayerDamageModifier,
  styleCurseById,
} from "./prayers";

describe("style curses", () => {
  it("covers one Turmoil-line curse per style at +10% damage", () => {
    expect(TURMOIL).toMatchObject({ style: "melee", damageBonus: 0.1, accuracyLevels: 10 });
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

  it("every curse carries a wiki SourceReference", () => {
    for (const c of STYLE_CURSES) {
      expect(c.source.verifiedAt, c.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.source.url, c.id).toContain("runescape.wiki");
    }
  });

  it("damage modifier multiplies at ability stage and is style-gated", () => {
    const mod = prayerDamageModifier(SORROW);
    expect(runPipeline({ damage: 1000 }, [mod], { style: "necromancy" }).damage).toBe(1100);
    expect(runPipeline({ damage: 1000 }, [mod], { style: "melee" }).damage).toBe(1000);
  });

  it("Malevolence floors 12% of 1000 → 1120", () => {
    const mod = prayerDamageModifier(MALEVOLENCE);
    expect(runPipeline({ damage: 1000 }, [mod], { style: "melee" }).damage).toBe(1120);
  });

  it("accuracy level helper adds the curse bonus", () => {
    expect(prayerBoostedStyleLevel(99, TURMOIL)).toBe(109);
    expect(prayerBoostedStyleLevel(99, null)).toBe(99);
    expect(styleCurseById("torment")?.name).toBe("Torment");
  });
});
