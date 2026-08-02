import { describe, expect, it } from "vitest";
import regionsData from "#shard/league/regions.json";
import relicsData from "#shard/league/relics.json";
import { BLESSING_RESET_COUNT, PATH_TIERS } from "./blessings";
import {
  blessingResetsLeft,
  canSelectElective,
  ELECTIVE_CAP,
  ELECTIVE_REGIONS,
  emptyBuild,
  isRegionUnlocked,
  MAX_RELIC_KEYS,
  MAX_RELIC_NAME_LEN,
  MILESTONE_REGION,
  normalizeBuild,
  pickBlessing,
  REGION_IDS,
  resetBlessings,
  STARTING_REGIONS,
  toggleElective,
  toggleRelic,
  UNLOCK_CAP,
  unlockedRegions,
} from "./index";

describe("region domain drift guard", () => {
  const idsWithAvailability = (availability: string) =>
    regionsData.records.filter((r) => r.availability === availability).map((r) => r.id);

  it("runtime grouping comes from data/league/regions.json", () => {
    expect([...STARTING_REGIONS]).toEqual(idsWithAvailability("starting"));
    expect([MILESTONE_REGION]).toEqual(idsWithAvailability("automatic_early"));
    expect([...ELECTIVE_REGIONS]).toEqual(idsWithAvailability("elective"));
  });

  it("the compile-time union covers every canonical id and nothing else", () => {
    expect([...REGION_IDS].sort()).toEqual(regionsData.records.map((r) => r.id).sort());
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
    for (const id of ["desert", "morytania", "tirannwn"] as const)
      state = toggleElective(state, id);
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
      relics: {},
      blessingPicks: [],
      blessingSelections: [],
      blessingResetsUsed: 0,
    });
  });

  it("recovers from garbage, unknown ids, duplicates, and over-cap state", () => {
    expect(normalizeBuild(null)).toEqual(emptyBuild());
    expect(normalizeBuild("junk")).toEqual(emptyBuild());
    expect(normalizeBuild({ elective: "desert" })).toEqual(emptyBuild());
    expect(normalizeBuild({ elective: ["desert", "not-a-region", "misthalin", "desert"] })).toEqual(
      {
        elective: ["desert"],
        relics: {},
        blessingPicks: [],
        blessingSelections: [],
        blessingResetsUsed: 0,
      },
    );
    expect(
      normalizeBuild({ elective: ["asgarnia", "kandarin", "desert", "tirannwn", "fremennik"] }),
    ).toEqual({
      elective: ["asgarnia", "kandarin", "desert"],
      relics: {},
      blessingPicks: [],
      blessingSelections: [],
      blessingResetsUsed: 0,
    });
  });

  it("keeps valid relic and blessing picks, drops garbage", () => {
    expect(
      normalizeBuild({
        elective: [],
        relics: { "1": "Survivalist", x: "bad", "2": "" },
        blessingPicks: ["Order", "junk", "Chaos"],
        blessingResetsUsed: 2.9,
      }),
    ).toEqual({
      elective: [],
      relics: { "1": "Survivalist" },
      blessingPicks: ["Order", "Chaos"],
      blessingSelections: [
        { tier: 1, blessingId: "teragards-aegis" },
        { tier: 2, blessingId: "abyssal-cinders" },
      ],
      blessingResetsUsed: 2,
    });
  });

  it("drops relic names outside revealed choices; keeps unrevealed-tier picks", () => {
    // Tiers come from the data, not pinned numbers: every reveal moves one tier
    // from the second group to the first, and a hardcoded tier turns that red.
    const revealed = relicsData.records.find((tier) => tier.choices.length > 0);
    const unrevealed = relicsData.records.find((tier) => tier.choices.length === 0);
    if (!revealed || !unrevealed) throw new Error("needs one revealed and one unrevealed tier");
    const open = String(revealed.tier);
    const closed = String(unrevealed.tier);
    const known = revealed.choices[0]!.name;

    expect(
      normalizeBuild({
        elective: [],
        relics: { [open]: "Not A Real Relic", [closed]: "Placeholder for unrevealed tier" },
      }).relics,
    ).toEqual({ [closed]: "Placeholder for unrevealed tier" });
    expect(
      normalizeBuild({
        elective: [],
        relics: { [open]: known, [closed]: "Still open" },
      }).relics,
    ).toEqual({ [open]: known, [closed]: "Still open" });
  });

  it("clamps resets to the data-owned count and caps picks at the path tier count", () => {
    const state = normalizeBuild({
      elective: [],
      relics: {},
      blessingPicks: Array(12).fill("Order"),
      blessingResetsUsed: 99,
    });
    expect(state.blessingPicks).toHaveLength(PATH_TIERS.length);
    expect(state.blessingResetsUsed).toBe(BLESSING_RESET_COUNT);
  });

  it("caps relic key count and name length so hostile hashes cannot pollute storage", () => {
    const flood: Record<string, string> = {};
    for (let i = 1; i <= MAX_RELIC_KEYS + 8; i++) flood[String(i)] = `Relic ${i}`;
    flood["99"] = "x".repeat(MAX_RELIC_NAME_LEN + 1);
    const state = normalizeBuild({ elective: [], relics: flood });
    expect(Object.keys(state.relics).length).toBeLessThanOrEqual(MAX_RELIC_KEYS);
    expect(state.relics["99"]).toBeUndefined();
    expect(Object.values(state.relics).every((n) => n.length <= MAX_RELIC_NAME_LEN)).toBe(true);
  });
});

describe("toggleRelic", () => {
  it("picks and unpicks one relic per tier, independently across tiers", () => {
    let state = toggleRelic(emptyBuild(), 1, "Survivalist");
    expect(state.relics).toEqual({ "1": "Survivalist" });
    state = toggleRelic(state, 2, "Unrevealed tier 2 relic");
    expect(state.relics).toEqual({ "1": "Survivalist", "2": "Unrevealed tier 2 relic" });
    state = toggleRelic(state, 1, "Golden Touch");
    expect(state.relics["1"]).toBe("Golden Touch");
    state = toggleRelic(state, 1, "Golden Touch");
    expect(state.relics).toEqual({ "2": "Unrevealed tier 2 relic" });
  });
});

describe("pickBlessing", () => {
  it("fills path tiers in order and rejects skipping", () => {
    let state = pickBlessing(emptyBuild(), 1, "Order");
    expect(state.blessingPicks).toEqual(["Order"]);
    expect(pickBlessing(state, 3, "Chaos").blessingPicks).toEqual(["Order"]);
    state = pickBlessing(state, 2, "Chaos");
    expect(state.blessingPicks).toEqual(["Order", "Chaos"]);
  });

  it("rejects god tiers and unknown tiers", () => {
    const state = emptyBuild();
    expect(pickBlessing(state, 4, "Order")).toBe(state);
    expect(pickBlessing(state, 8, "Chaos")).toBe(state);
    expect(pickBlessing(state, 99, "Order")).toBe(state);
  });

  it("re-picks an earlier tier in place; un-picking truncates later picks", () => {
    let state = emptyBuild();
    state = pickBlessing(state, 1, "Order");
    state = pickBlessing(state, 2, "Order");
    state = pickBlessing(state, 3, "Chaos");
    state = pickBlessing(state, 1, "Balance");
    expect(state.blessingPicks).toEqual(["Balance", "Order", "Chaos"]);
    state = pickBlessing(state, 2, "Order");
    expect(state.blessingPicks).toEqual(["Balance"]);
  });
});

describe("resetBlessings", () => {
  it("wipes picks and spends one reset", () => {
    let state = pickBlessing(pickBlessing(emptyBuild(), 1, "Order"), 2, "Order");
    state = resetBlessings(state);
    expect(state.blessingPicks).toEqual([]);
    expect(state.blessingResetsUsed).toBe(1);
    expect(blessingResetsLeft(state)).toBe(BLESSING_RESET_COUNT - 1);
  });

  it("does not spend a reset on empty picks", () => {
    const state = emptyBuild();
    expect(resetBlessings(state)).toBe(state);
  });

  it("stops spending at the data-owned cap", () => {
    let state = emptyBuild();
    for (let i = 0; i < BLESSING_RESET_COUNT; i++) {
      state = pickBlessing(state, 1, "Order");
      state = resetBlessings(state);
    }
    expect(state.blessingResetsUsed).toBe(BLESSING_RESET_COUNT);
    expect(blessingResetsLeft(state)).toBe(0);
    state = pickBlessing(state, 1, "Chaos");
    const blocked = resetBlessings(state);
    expect(blocked).toBe(state);
    expect(blocked.blessingPicks).toEqual(["Chaos"]);
  });
});
