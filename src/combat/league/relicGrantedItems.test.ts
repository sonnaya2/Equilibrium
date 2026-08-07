import { describe, expect, it } from "vitest";
import { ICYENIC_FAITH_RELIC, TOME_OF_THE_ICYENE_ID } from "./icyenicFaith";
import { NARAGI_EDICT_RELIC, SLIVER_OF_EDICTS_ID } from "./naragiEdict";
import {
  AVERNIC_STAR_ID,
  filterRelicGrantedRecords,
  INFERNAL_FIRE_RELIC,
  isRelicGrantedItem,
  isRelicGrantedItemAvailable,
  relicRequiredForItem,
  stripUnavailableRelicItems,
} from "./relicGrantedItems";

describe("relicGrantedItems", () => {
  it("maps each granted pocket item to its relic", () => {
    expect(isRelicGrantedItem(TOME_OF_THE_ICYENE_ID)).toBe(true);
    expect(isRelicGrantedItem(SLIVER_OF_EDICTS_ID)).toBe(true);
    expect(isRelicGrantedItem(AVERNIC_STAR_ID)).toBe(true);
    expect(isRelicGrantedItem("item:scripture-of-amascut")).toBe(false);
    expect(relicRequiredForItem(TOME_OF_THE_ICYENE_ID)).toBe(ICYENIC_FAITH_RELIC);
    expect(relicRequiredForItem(SLIVER_OF_EDICTS_ID)).toBe(NARAGI_EDICT_RELIC);
    expect(relicRequiredForItem(AVERNIC_STAR_ID)).toBe(INFERNAL_FIRE_RELIC);
  });

  it("hides granted items when relic inactive", () => {
    expect(isRelicGrantedItemAvailable(TOME_OF_THE_ICYENE_ID, [])).toBe(false);
    expect(isRelicGrantedItemAvailable(SLIVER_OF_EDICTS_ID, [])).toBe(false);
    expect(isRelicGrantedItemAvailable(AVERNIC_STAR_ID, [])).toBe(false);
    expect(isRelicGrantedItemAvailable(TOME_OF_THE_ICYENE_ID, [ICYENIC_FAITH_RELIC])).toBe(true);
    expect(isRelicGrantedItemAvailable(SLIVER_OF_EDICTS_ID, [NARAGI_EDICT_RELIC])).toBe(true);
    expect(isRelicGrantedItemAvailable(AVERNIC_STAR_ID, [INFERNAL_FIRE_RELIC])).toBe(true);
    expect(isRelicGrantedItemAvailable(TOME_OF_THE_ICYENE_ID, [NARAGI_EDICT_RELIC])).toBe(false);
    expect(isRelicGrantedItemAvailable(SLIVER_OF_EDICTS_ID, [ICYENIC_FAITH_RELIC])).toBe(false);
    expect(isRelicGrantedItemAvailable("item:scripture-of-amascut", [])).toBe(true);
  });

  it("strips invalid pocket grants without auto-equip", () => {
    const withTome = { pocket: TOME_OF_THE_ICYENE_ID, ring: "item:ring-of-vigour" };
    expect(stripUnavailableRelicItems(withTome, [])).toEqual({ ring: "item:ring-of-vigour" });
    expect(stripUnavailableRelicItems(withTome, [ICYENIC_FAITH_RELIC])).toBe(withTome);

    const withSliver = { pocket: SLIVER_OF_EDICTS_ID };
    expect(stripUnavailableRelicItems(withSliver, [NARAGI_EDICT_RELIC])).toBe(withSliver);
    expect(stripUnavailableRelicItems(withSliver, [ICYENIC_FAITH_RELIC])).toEqual({});

    const withStar = { pocket: AVERNIC_STAR_ID };
    expect(stripUnavailableRelicItems(withStar, [INFERNAL_FIRE_RELIC])).toBe(withStar);
    expect(stripUnavailableRelicItems(withStar, [NARAGI_EDICT_RELIC])).toEqual({});
  });

  it("filters record lists for pickers", () => {
    const rows = [
      { id: TOME_OF_THE_ICYENE_ID },
      { id: SLIVER_OF_EDICTS_ID },
      { id: AVERNIC_STAR_ID },
      { id: "item:other" },
    ];
    expect(filterRelicGrantedRecords(rows, []).map((r) => r.id)).toEqual(["item:other"]);
    expect(filterRelicGrantedRecords(rows, [ICYENIC_FAITH_RELIC]).map((r) => r.id)).toEqual([
      TOME_OF_THE_ICYENE_ID,
      "item:other",
    ]);
    expect(filterRelicGrantedRecords(rows, [NARAGI_EDICT_RELIC]).map((r) => r.id)).toEqual([
      SLIVER_OF_EDICTS_ID,
      "item:other",
    ]);
    expect(filterRelicGrantedRecords(rows, [INFERNAL_FIRE_RELIC]).map((r) => r.id)).toEqual([
      AVERNIC_STAR_ID,
      "item:other",
    ]);
  });
});
