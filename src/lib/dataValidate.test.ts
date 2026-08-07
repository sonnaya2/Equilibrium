import { describe, expect, it } from "vitest";
import {
  parseAbilityList,
  parseBlessingTier,
  parseCombatAbilityRow,
  parseLeagueRegion,
  parseRelicTier,
  parseSourceRef,
  parseTaskList,
  parseTaskRow,
  readDatasetRecords,
} from "./dataValidate";

describe("dataValidate — combat abilities", () => {
  it("accepts named ability rows", () => {
    expect(parseCombatAbilityRow({ name: "Slice", damage_percent: 95 })).toEqual(
      expect.objectContaining({ name: "Slice", damage_percent: 95 }),
    );
  });

  it("rejects malformed ability payloads", () => {
    expect(parseCombatAbilityRow(null)).toBeNull();
    expect(parseCombatAbilityRow({})).toBeNull();
    expect(parseCombatAbilityRow({ damage: 10 })).toBeNull();
    expect(parseAbilityList("not-array", "test")).toEqual([]);
    expect(parseAbilityList([{ name: "A" }, { nope: true }, null], "test")).toEqual([
      { name: "A" },
    ]);
  });
});

describe("dataValidate — tasks", () => {
  it("parses task rows and drops incomplete ones", () => {
    expect(
      parseTaskRow({ name: "Kill a goblin", tier: "easy", catalystCompletionRate: 0 }),
    ).toEqual(
      expect.objectContaining({ name: "Kill a goblin", tier: "easy", catalystCompletionRate: 0 }),
    );
    expect(parseTaskRow({ name: "No tier" })).toBeNull();
    expect(parseTaskList([{ name: "A", tier: "easy" }, { name: "B" }], "t")).toHaveLength(1);
  });

  it("handles envelope and bare arrays", () => {
    expect(parseTaskList({ records: [{ name: "A", tier: "easy" }] }, "env")).toHaveLength(1);
    expect(parseTaskList(null, "bad")).toEqual([]);
  });
});

describe("dataValidate — league", () => {
  it("parses regions, relics, blessings", () => {
    expect(
      parseLeagueRegion({ id: "misthalin", name: "Misthalin", availability: "starting" }),
    ).toEqual({ id: "misthalin", name: "Misthalin", availability: "starting" });
    expect(parseLeagueRegion({ id: "x" })).toBeNull();

    const relic = parseRelicTier({
      tier: 1,
      revealed: true,
      choices: [{ name: "Survivalist", effects: ["+1"] }],
    });
    expect(relic?.choices[0]?.name).toBe("Survivalist");

    const blessing = parseBlessingTier({
      progressionSlot: 1,
      tier: 1,
      revealed: false,
      paths: ["order"],
      godTier: null,
      passives: [],
      choices: [],
    });
    expect(blessing?.paths).toEqual(["order"]);
  });

  it("keeps relic seats and blessing paths, and drops cards missing either", () => {
    // A tier revealed only at the bottom seat must not slide that relic to the top.
    const relic = parseRelicTier({
      tier: 4,
      revealed: true,
      choices: [
        { name: "Crystal Grace", seat: 0 },
        { name: "Transmutation", seat: 2 },
        { seat: 1 },
      ],
    });
    expect(relic?.choices.map((c) => [c.name, c.seat])).toEqual([
      ["Crystal Grace", 0],
      ["Transmutation", 2],
    ]);

    // A blessing card names its own path, so a transposed column cannot mis-file it.
    const blessing = parseBlessingTier({
      progressionSlot: 1,
      tier: 1,
      revealed: true,
      paths: ["Order", "Balance", "Chaos"],
      godTier: null,
      passives: [],
      choices: [
        { path: "Chaos", name: "Adrenaline Junkie", effects: ["Maximum adrenaline +50%."] },
        { name: "No path" },
        { path: "Order" },
      ],
    });
    expect(blessing?.choices).toHaveLength(1);
    expect(blessing?.choices[0]).toMatchObject({ path: "Chaos", name: "Adrenaline Junkie" });
  });

  it("reads dataset envelopes gracefully", () => {
    const rows = readDatasetRecords(
      { records: [{ id: "a", name: "A", availability: "starting" }, { bad: true }] },
      parseLeagueRegion,
      "regions",
    );
    expect(rows).toHaveLength(1);
    expect(readDatasetRecords(null, parseLeagueRegion, "regions")).toEqual([]);
  });
});

describe("dataValidate — sources", () => {
  it("requires source + url", () => {
    expect(parseSourceRef({ source: "runescape-wiki", url: "https://runescape.wiki" })).toEqual(
      expect.objectContaining({ source: "runescape-wiki" }),
    );
    expect(parseSourceRef({ source: "x" })).toBeNull();
  });
});
