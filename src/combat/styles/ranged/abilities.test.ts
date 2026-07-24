import { describe, expect, it } from "vitest";
import { RANGED_ABILITIES, RANGED_EFFECTS } from "./abilities";

describe("ranged ability data", () => {
  it("every record carries a source and sane bands", () => {
    for (const a of RANGED_ABILITIES) {
      expect(a.source.verifiedAt, a.id).toBeTruthy();
      for (const h of a.hits) expect(h.band.minPct, a.id).toBeLessThanOrEqual(h.band.maxPct);
    }
    expect(new Set(RANGED_ABILITIES.map((a) => a.id)).size).toBe(RANGED_ABILITIES.length);
  });

  it("shadow tendrils is a guaranteed crit with the modernised band", () => {
    const tendrils = RANGED_ABILITIES.find((a) => a.id === "shadow_tendrils")!;
    expect(tendrils.guaranteedCrit).toBe(true);
    expect(tendrils.hits[0].band).toEqual({ minPct: 200, maxPct: 240 });
  });

  it("records without corpus bands stay effect notes, not calculable abilities", () => {
    expect(RANGED_ABILITIES.some((a) => a.id === "bombardment")).toBe(false);
    expect(RANGED_EFFECTS.some((e) => e.id === "bombardment")).toBe(true);
    for (const e of RANGED_EFFECTS) expect(e.source.verifiedAt, e.id).toBeTruthy();
  });
});
