import { describe, expect, it } from "vitest";
import {
  barHasRequiredAbilities,
  dualVersionDenyIds,
  ensureRequiredAbilityIds,
  preferGreaterUltTwin,
  styleRequiredAbilityIds,
} from "./stylePolicy";

describe("stylePolicy dual versions", () => {
  it("prefers greater Sunshine/DS when Planted Feet is off", () => {
    expect(preferGreaterUltTwin(false)).toBe(true);
    const deny = dualVersionDenyIds({
      style: "magic",
      plantedFeet: false,
      availableIds: ["sunshine", "greater_sunshine", "asphyxiate"],
    });
    expect(deny).toContain("sunshine");
    expect(deny).not.toContain("greater_sunshine");
  });

  it("prefers base Sunshine/DS when Planted Feet is on", () => {
    expect(preferGreaterUltTwin(true)).toBe(false);
    const deny = dualVersionDenyIds({
      style: "ranged",
      plantedFeet: true,
      availableIds: ["deaths_swiftness", "greater_deaths_swiftness", "imbue_shadows"],
    });
    expect(deny).toContain("greater_deaths_swiftness");
    expect(deny).not.toContain("deaths_swiftness");
  });

  it("prefers igneous ult when cape passive is live", () => {
    const deny = dualVersionDenyIds({
      style: "melee",
      plantedFeet: false,
      passiveIds: ["igneous-overpower"],
      availableIds: ["overpower", "overpower_igneous", "berserk"],
    });
    expect(deny).toContain("overpower");
    expect(deny).not.toContain("overpower_igneous");
  });

  it("prefers base ult when igneous passive is absent", () => {
    const deny = dualVersionDenyIds({
      style: "necromancy",
      plantedFeet: false,
      passiveIds: [],
      availableIds: ["death_skulls", "death_skulls_igneous"],
    });
    expect(deny).toContain("death_skulls_igneous");
    expect(deny).not.toContain("death_skulls");
  });

  it("does not deny when only one twin is available", () => {
    expect(
      dualVersionDenyIds({
        style: "magic",
        plantedFeet: false,
        availableIds: ["sunshine"],
      }),
    ).toEqual([]);
  });
});

describe("stylePolicy required abilities", () => {
  it("resolves style requireds that are present in the pool", () => {
    expect(styleRequiredAbilityIds("melee", ["berserk", "assault"])).toEqual(["berserk"]);
    expect(
      styleRequiredAbilityIds("necromancy", [
        "conjure_undead_army",
        "finger_of_death",
        "touch_of_death",
        "soul_sap",
      ]),
    ).toEqual(["conjure_undead_army", "finger_of_death", "touch_of_death"]);
    expect(
      styleRequiredAbilityIds("ranged", ["greater_deaths_swiftness", "imbue_shadows", "ricochet"]),
    ).toEqual(["greater_deaths_swiftness", "imbue_shadows"]);
    expect(styleRequiredAbilityIds("magic", ["sunshine", "asphyxiate"])).toEqual(["sunshine"]);
  });

  it("skips required families missing from the pool", () => {
    expect(styleRequiredAbilityIds("melee", ["assault"])).toEqual([]);
  });

  it("ensureRequired prepends missing ids", () => {
    expect(ensureRequiredAbilityIds(["a", "b"], ["berserk"])).toEqual(["berserk", "a", "b"]);
    expect(ensureRequiredAbilityIds(["berserk", "a"], ["berserk"])).toEqual(["berserk", "a"]);
  });

  it("barHasRequired checks membership", () => {
    expect(barHasRequiredAbilities(["berserk", "a"], ["berserk"])).toBe(true);
    expect(barHasRequiredAbilities(["a"], ["berserk"])).toBe(false);
  });
});
