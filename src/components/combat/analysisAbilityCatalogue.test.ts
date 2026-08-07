import { describe, expect, it } from "vitest";
import { ANALYSIS_ABILITY_ENTRIES, ANALYSIS_ABILITY_ENTRY_BY_ID } from "./analysisAbilityCatalogue";

describe("analysis ability catalogue", () => {
  it("uses a unique style-qualified identity for every rendered entry", () => {
    const ids = ANALYSIS_ABILITY_ENTRIES.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ANALYSIS_ABILITY_ENTRIES) {
      expect(ANALYSIS_ABILITY_ENTRY_BY_ID.get(entry.id)).toBe(entry);
    }
  });

  it.each(["sacrifice", "tuskas_wrath"])(
    "keeps the %s variants independently selectable",
    (abilityId) => {
      const variants = ANALYSIS_ABILITY_ENTRIES.filter((entry) => entry.ability.id === abilityId);

      expect(variants.map((entry) => entry.style)).toEqual(["melee", "ranged", "magic"]);
      expect(variants.map((entry) => entry.id)).toEqual([
        `melee:${abilityId}`,
        `ranged:${abilityId}`,
        `magic:${abilityId}`,
      ]);
    },
  );
});
