import { describe, expect, it } from "vitest";
import { activeBlessings, BLESSING_IDS } from "./blessings";
import {
  emptyBuild,
  normalizeBuild,
  pickBlessing,
  resolveBlessingPersistence,
} from "./index";
import { validateBlessingsDocument } from "./blessingSchema";
import blessingsData from "#shard/league/blessings.json";

describe("stable blessing selection persistence", () => {
  it("migrates legacy path arrays to tier + blessingId selections", () => {
    const state = normalizeBuild({
      blessingPicks: ["Balance", "Chaos", "Chaos"],
    });
    expect(state.blessingPicks).toEqual(["Balance", "Chaos", "Chaos"]);
    expect(state.blessingSelections).toEqual([
      { tier: 1, blessingId: "big-boned" },
      { tier: 2, blessingId: "abyssal-cinders" },
      { tier: 3, blessingId: "avernic-rampage" },
    ]);
  });

  it("round-trips stable selections without depending on path-array order alone", () => {
    const selections = [
      { tier: 1, blessingId: "teragards-aegis" as const },
      { tier: 2, blessingId: "striking-light" as const },
    ];
    const state = normalizeBuild({ blessingSelections: selections });
    expect(state.blessingPicks).toEqual(["Order", "Order"]);
    expect(state.blessingSelections).toEqual(selections);
    expect(activeBlessings(state.blessingPicks).map((c) => c.id)).toEqual([
      "teragards-aegis",
      "striking-light",
    ]);
  });

  it("prunes invalid, duplicate, and tier-mismatched blessing ids", () => {
    const state = normalizeBuild({
      blessingSelections: [
        { tier: 2, blessingId: "big-boned" }, // big-boned is tier 1 only
        { tier: 1, blessingId: "teragards-aegis" },
        { tier: 1, blessingId: "teragards-aegis" }, // duplicate tier/id
        { tier: 2, blessingId: "not-a-real-blessing" },
        { tier: 2, blessingId: "barkscales" },
      ],
    });
    expect(state.blessingSelections).toEqual([
      { tier: 1, blessingId: "teragards-aegis" },
      { tier: 2, blessingId: "barkscales" },
    ]);
    expect(state.blessingPicks).toEqual(["Order", "Balance"]);
  });

  it("stops the contiguous prefix when a path tier is missing", () => {
    const state = normalizeBuild({
      blessingSelections: [
        { tier: 1, blessingId: "big-boned" },
        { tier: 3, blessingId: "avernic-rampage" },
      ],
    });
    // Tier 2 gap ends the prefix; tier 3 alone is not contiguous.
    expect(state.blessingPicks).toEqual(["Balance"]);
    expect(state.blessingSelections).toEqual([{ tier: 1, blessingId: "big-boned" }]);
  });

  it("pickBlessing keeps selections in sync with paths", () => {
    let state = emptyBuild();
    state = pickBlessing(state, 1, "Order");
    state = pickBlessing(state, 2, "Balance");
    expect(state.blessingSelections).toEqual([
      { tier: 1, blessingId: "teragards-aegis" },
      { tier: 2, blessingId: "barkscales" },
    ]);
  });

  it("does not change selected blessings when only path order is re-derived", () => {
    const a = resolveBlessingPersistence({
      blessingSelections: [
        { tier: 1, blessingId: "adrenaline-junkie" },
        { tier: 2, blessingId: "barkscales" },
      ],
    });
    const b = resolveBlessingPersistence({ blessingPicks: a.blessingPicks });
    expect(b.blessingSelections).toEqual(a.blessingSelections);
    expect(b.blessingPicks).toEqual(a.blessingPicks);
  });
});

describe("blessing schema validation", () => {
  it("accepts the generated blessings document", () => {
    expect(validateBlessingsDocument(blessingsData)).toEqual([]);
  });

  it("fails on duplicate ids, NaN combat values, and inverted bands", () => {
    const bad = {
      ...blessingsData,
      records: [
        {
          tier: 1,
          godTier: false,
          revealed: true,
          verified: true,
          paths: ["Order", "Balance", "Chaos"],
          choices: [
            {
              id: "dup",
              name: "A",
              path: "Order",
              effects: [],
              verified: true,
              support: {
                status: "modeled",
                mechanicsUnverified: false,
                excluded: [],
                assumptions: [],
              },
              combat: { maximumLifeMultiplier: Number.NaN },
            },
            {
              id: "dup",
              name: "B",
              path: "Balance",
              effects: [],
              verified: true,
              support: {
                status: "modeled",
                mechanicsUnverified: false,
                excluded: [],
                assumptions: [],
              },
              combat: {
                light: {
                  cooldownTicks: 1.5,
                  abilityDamageBand: [2, 1],
                  armourPercent: 1,
                },
              },
            },
          ],
          source: blessingsData.records[0]?.source,
        },
      ],
    };
    const issues = validateBlessingsDocument(bad);
    expect(issues.some((i) => /duplicate id/i.test(i.message))).toBe(true);
    expect(issues.some((i) => /finite/i.test(i.message))).toBe(true);
    expect(issues.some((i) => /band/i.test(i.message))).toBe(true);
  });

  it("derives BLESSING_IDS from the validated source", () => {
    expect([...BLESSING_IDS]).toEqual(
      blessingsData.records.flatMap((record) => record.choices.map((choice) => choice.id)),
    );
  });
});
