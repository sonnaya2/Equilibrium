import { describe, expect, it } from "vitest";
import {
  getActiveInventionPerks,
  getCurrentArmourPerkRecipes,
  getPerkMaterialBottlenecks,
  getUtilityPerkRecipes,
} from "./inventionPlanner";

describe("inventionPlanner loaders", () => {
  it("lists active perks after the July 2026 removals", () => {
    const perks = getActiveInventionPerks();
    expect(perks.length).toBe(69);
    expect(perks.every((p) => p?.id && p?.name)).toBe(true);
    // These eight used to dual-claim with combat/perks.json; overlap authority
    // re-points the catalogue rows onto perk:* survivors so the list stays full.
    const names = new Set(perks.map((p) => p.name));
    for (const name of [
      "Biting",
      "Crackling",
      "Enhanced Devoted",
      "Impatient",
      "Invigorating",
      "Lucky",
      "Turtling",
      "Ultimatums",
    ]) {
      expect(names.has(name)).toBe(true);
    }
  });

  it("loads armour, utility recipes and bottlenecks", () => {
    expect(getCurrentArmourPerkRecipes().length).toBeGreaterThan(0);
    expect(getUtilityPerkRecipes().length).toBeGreaterThan(0);
    expect(getPerkMaterialBottlenecks().length).toBeGreaterThan(0);
  });
});
