import { describe, expect, it } from "vitest";
import { combatUnlockCountForRegion, combatUnlockRegions } from "./combatClassification";

describe("combat unlock regions", () => {
  it("prefers explicit requirements over fallback hints", () => {
    expect(
      combatUnlockRegions({
        requiredRegions: ["misthalin", "desert"],
        regionHints: ["global"],
      }),
    ).toEqual(["misthalin", "desert"]);
    expect(combatUnlockRegions({ requiredRegions: [], regionHints: ["morytania"] })).toEqual([
      "morytania",
    ]);
  });

  it("counts only records explicitly assigned to a region", () => {
    expect(combatUnlockCountForRegion("morytania")).toBeGreaterThan(0);
    expect(combatUnlockCountForRegion("not-a-region")).toBe(0);
  });
});
