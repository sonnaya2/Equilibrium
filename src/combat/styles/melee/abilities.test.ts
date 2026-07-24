import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES, MELEE_EFFECTS } from "./abilities";

describe("melee ability data", () => {
  it("every record carries a source and sane bands", () => {
    for (const a of MELEE_ABILITIES) {
      expect(a.source.verifiedAt, a.id).toBeTruthy();
      for (const h of a.hits) expect(h.band.minPct, a.id).toBeLessThanOrEqual(h.band.maxPct);
    }
    expect(new Set(MELEE_ABILITIES.map((a) => a.id)).size).toBe(MELEE_ABILITIES.length);
  });

  it("Bloodlust builders declare generation per record", () => {
    expect(MELEE_ABILITIES.find((a) => a.id === "attack")!.bloodlustGain).toBe(1);
    expect(MELEE_ABILITIES.find((a) => a.id === "attack")!.adrenaline?.gain).toBe(9);
    expect(MELEE_ABILITIES.find((a) => a.id === "rend")!.bloodlustGain).toBe(2);
  });

  it("bleed chains name their enabler", () => {
    expect(MELEE_ABILITIES.find((a) => a.id === "dismember")!.enables).toBe("slaughter");
    expect(MELEE_ABILITIES.find((a) => a.id === "slaughter")!.enables).toBe("massacre");
  });

  it("Assault carries its 4-Bloodlust band as data", () => {
    expect(MELEE_ABILITIES.find((a) => a.id === "assault")!.bloodlustScale).toEqual({
      threshold: 4,
      band: { minPct: 170, maxPct: 190 },
    });
  });

  it("effect records stay sourced", () => {
    for (const e of MELEE_EFFECTS) expect(e.source.verifiedAt, e.id).toBeTruthy();
  });
});
