import regionsData from "#data/league/regions.json";
import { describe, expect, it } from "vitest";
import {
  canSelectElective,
  ELECTIVE_CAP,
  ELECTIVE_REGIONS,
  emptyBuild,
  isRegionUnlocked,
  MILESTONE_REGION,
  normalizeBuild,
  REGION_IDS,
  STARTING_REGIONS,
  toggleElective,
  UNLOCK_CAP,
  unlockedRegions,
} from "./index";

describe("canonical region contract", () => {
  it("keeps domain ids and availability groups aligned with data/league/regions.json", () => {
    const canonicalIds = regionsData.records.map((region) => region.id);
    const canonicalStarting = regionsData.records
      .filter((region) => region.availability === "starting")
      .map((region) => region.id);
    const canonicalMilestone = regionsData.records.find((region) => region.availability === "automatic_early")?.id;
    const canonicalElective = regionsData.records
      .filter((region) => region.availability === "elective")
      .map((region) => region.id);

    expect([...REGION_IDS]).toEqual(canonicalIds);
    expect([...STARTING_REGIONS]).toEqual(canonicalStarting);
    expect(MILESTONE_REGION).toBe(canonicalMilestone);
    expect([...ELECTIVE_REGIONS]).toEqual(canonicalElective);
  });
});

describe("unlockedRegions", () => {
  it("always includes the fixed starts and the Karamja milestone", () => {
    const unlocked = unlockedRegions(emptyBuild());
    expect(unlocked).toEqual([...STARTING_REGIONS, MILESTONE_REGION]);
  });

  it("caps total unlocks at 6 with a full elective set", () => {
    let state = emptyBuild();
    for (const id of ELECTIVE_REGIONS.slice(0, ELECTIVE_CAP)) state = toggleElective(state, id);
    expect(unlockedRegions(state)).toHaveLength(UNLOCK_CAP);
  });
});

describe("toggleElective", () => {
  it("selects and deselects elective regions", () => {
    let state = toggleElective(emptyBuild(), "desert");
    expect(state.elective).toEqual(["desert"]);
    state = toggleElective(state, "desert");
    expect(state.elective).toEqual([]);
  });

  it("rejects a fourth elective pick", () => {
    let state = emptyBuild();
    for (const id of ["desert", "morytania", "tirannwn"] as const) state = toggleElective(state, id);
    const rejected = toggleElective(state, "asgarnia");
    expect(rejected).toBe(state);
    expect(canSelectElective(state, "asgarnia")).toBe(false);
    expect(canSelectElective(state, "desert")).toBe(true);
  });

  it("rejects non-elective regions", () => {
    const state = emptyBuild();
    expect(toggleElective(state, "misthalin")).toBe(state);
    expect(toggleElective(state, "karamja")).toBe(state);
    expect(canSelectElective(state, "karamja")).toBe(false);
  });
});

describe("isRegionUnlocked", () => {
  it("reflects fixed, milestone, and elective unlocks", () => {
    const state = toggleElective(emptyBuild(), "anachronia");
    expect(isRegionUnlocked(state, "misthalin")).toBe(true);
    expect(isRegionUnlocked(state, "karamja")).toBe(true);
    expect(isRegionUnlocked(state, "anachronia")).toBe(true);
    expect(isRegionUnlocked(state, "fremennik")).toBe(false);
  });
});

describe("normalizeBuild", () => {
  it("passes a valid build through", () => {
    expect(normalizeBuild({ elective: ["desert", "tirannwn"] })).toEqual({
      elective: ["desert", "tirannwn"],
    });
  });

  it("recovers from garbage, unknown ids, duplicates, and over-cap state", () => {
    expect(normalizeBuild(null)).toEqual(emptyBuild());
    expect(normalizeBuild("junk")).toEqual(emptyBuild());
    expect(normalizeBuild({ elective: "desert" })).toEqual(emptyBuild());
    expect(
      normalizeBuild({ elective: ["desert", "not-a-region", "misthalin", "desert"] }),
    ).toEqual({ elective: ["desert"] });
    expect(
      normalizeBuild({ elective: ["asgarnia", "kandarin", "desert", "tirannwn", "fremennik"] }),
    ).toEqual({ elective: ["asgarnia", "kandarin", "desert"] });
  });
});
