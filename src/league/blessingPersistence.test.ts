import { describe, expect, it } from "vitest";
import { activeBlessings, BLESSING_IDS } from "./blessings";
import { emptyBuild, normalizeBuild, pickBlessing, resolveBlessingPersistence } from "./index";
import { validateBlessingsDocument } from "./blessingSchema";
import blessingsData from "#shard/league/blessings.json";

describe("stable blessing selection persistence", () => {
  it("migrates legacy path arrays to progression slot + public tier selections", () => {
    const state = normalizeBuild({
      blessingPicks: ["Balance", "Chaos", "Chaos"],
    });
    expect(state.blessingPicks).toEqual(["Balance", "Chaos", "Chaos"]);
    expect(state.blessingSelections).toEqual([
      { progressionSlot: 1, tier: 1, blessingId: "big-boned" },
      { progressionSlot: 2, tier: 2, blessingId: "abyssal-cinders" },
      { progressionSlot: 3, tier: 3, blessingId: "avernic-rampage" },
    ]);
  });

  it("round-trips stable selections without depending on path-array order alone", () => {
    const selections = [
      { progressionSlot: 1, tier: 1, blessingId: "teragards-aegis" as const },
      { progressionSlot: 2, tier: 2, blessingId: "striking-light" as const },
    ];
    const state = normalizeBuild({ blessingSelections: selections });
    expect(state.blessingPicks).toEqual(["Order", "Order"]);
    expect(state.blessingSelections).toEqual(selections);
    expect(activeBlessings(state.blessingPicks).map((c) => c.id)).toEqual([
      "teragards-aegis",
      "striking-light",
    ]);
  });

  it("round-trips Lord of Light and Tempered Heart in a complete path", () => {
    const selections = [
      { tier: 1, blessingId: "teragards-aegis" as const },
      { tier: 2, blessingId: "barkscales" as const },
      { tier: 3, blessingId: "avernic-rampage" as const },
      { tier: 5, blessingId: "true-equilibrium" as const },
      { tier: 6, blessingId: "lord-of-light" as const },
      { tier: 7, blessingId: "tempered-heart" as const },
    ];
    const state = normalizeBuild({ blessingSelections: selections });
    expect(state.blessingPicks).toEqual(["Order", "Balance", "Chaos", "Balance", "Order", "Order"]);
    expect(state.blessingSelections).toEqual([
      { progressionSlot: 1, tier: 1, blessingId: "teragards-aegis" },
      { progressionSlot: 2, tier: 2, blessingId: "barkscales" },
      { progressionSlot: 3, tier: 3, blessingId: "avernic-rampage" },
      { progressionSlot: 5, tier: 4, blessingId: "true-equilibrium" },
      { progressionSlot: 6, tier: 5, blessingId: "lord-of-light" },
      { progressionSlot: 7, tier: 6, blessingId: "tempered-heart" },
    ]);
    expect(activeBlessings(state.blessingPicks).map((choice) => choice.id)).toEqual(
      expect.arrayContaining(["lord-of-light", "tempered-heart"]),
    );
  });

  it("round-trips Genesis Essence as the Order God Tier 2 selection", () => {
    const state = normalizeBuild({
      blessingSelections: [
        { tier: 1, blessingId: "teragards-aegis" },
        { tier: 2, blessingId: "striking-light" },
        { tier: 3, blessingId: "steadfast-will" },
        { tier: 5, blessingId: "higher-power" },
        { tier: 6, blessingId: "lord-of-light" },
        { tier: 7, blessingId: "tempered-heart" },
      ],
    });
    expect(activeBlessings(state.blessingPicks).map((choice) => choice.id)).toContain(
      "genesis-essence",
    );
    expect(state.blessingSelections).toHaveLength(6);
  });

  it("persists the Chaos path that grants Chaotic Insight", () => {
    const state = normalizeBuild({ blessingPicks: Array(6).fill("Chaos") });
    expect(state.blessingPicks).toEqual(Array(6).fill("Chaos"));
    expect(activeBlessings(state.blessingPicks).map((choice) => choice.id)).toContain(
      "chaotic-insight",
    );
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
      { progressionSlot: 1, tier: 1, blessingId: "teragards-aegis" },
      { progressionSlot: 2, tier: 2, blessingId: "barkscales" },
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
    expect(state.blessingSelections).toEqual([
      { progressionSlot: 1, tier: 1, blessingId: "big-boned" },
    ]);
  });

  it("pickBlessing keeps selections in sync with paths", () => {
    let state = emptyBuild();
    state = pickBlessing(state, 1, "Order");
    state = pickBlessing(state, 2, "Balance");
    expect(state.blessingSelections).toEqual([
      { progressionSlot: 1, tier: 1, blessingId: "teragards-aegis" },
      { progressionSlot: 2, tier: 2, blessingId: "barkscales" },
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

  it("rejects an untyped tier passive effect", () => {
    const bad = {
      ...blessingsData,
      records: blessingsData.records.map((record, index) =>
        index === 4
          ? {
              ...record,
              passives: [
                {
                  id: "bad-passive",
                  name: "Bad passive",
                  description: "Missing a discriminated effect.",
                  kind: "combat",
                  effect: { type: "maximum-adrenaline", bonusPercent: "25" },
                },
              ],
            }
          : record,
      ),
    };
    expect(
      validateBlessingsDocument(bad).some((issue) => /bonusPercent/i.test(issue.message)),
    ).toBe(true);
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
