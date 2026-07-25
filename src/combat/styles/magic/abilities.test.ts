import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES, MAGIC_EFFECTS } from "./abilities";
import { NECROMANCY_ABILITIES, NECROMANCY_EFFECTS } from "../necromancy/abilities";

describe("magic ability data", () => {
  it("calculable records stay sourced and unique", () => {
    for (const a of MAGIC_ABILITIES) {
      expect(a.source.verifiedAt, a.id).toBeTruthy();
    }
    expect(new Set(MAGIC_ABILITIES.map((a) => a.id)).size).toBe(MAGIC_ABILITIES.length);
    const basic = MAGIC_ABILITIES.find((a) => a.id === "magic_attack")!;
    expect(basic.hits[0].band).toEqual({ minPct: 90, maxPct: 110 });
    expect(basic.adrenaline?.gain).toBe(9);
  });

  it("the empowered dragon breath models only its sourced band", () => {
    const empowered = MAGIC_ABILITIES.find((a) => a.id === "dragon_breath_empowered")!;
    expect(empowered.requiresAnima).toBe(true);
    expect(empowered.hits[0].band).toEqual({ minPct: 260, maxPct: 310 });
    expect(MAGIC_ABILITIES.some((a) => a.id === "dragon_breath")).toBe(false);
  });

  it("average-only numbers stay notes, never fabricated bands", () => {
    expect(MAGIC_ABILITIES.some((a) => a.id === "wild_magic")).toBe(false);
    for (const e of MAGIC_EFFECTS) {
      expect(e.source.verifiedAt, e.id).toBeTruthy();
      expect(e.notes.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe("necromancy ability data", () => {
  it("has no calculable records until bands are pinned", () => {
    expect(NECROMANCY_ABILITIES).toHaveLength(0);
    for (const e of NECROMANCY_EFFECTS) {
      expect(e.source.verifiedAt, e.id).toBeTruthy();
      expect(e.notes.length, e.id).toBeGreaterThan(0);
    }
  });
});
