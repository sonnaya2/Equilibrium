import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import { getResearchCatalog } from "@/research/catalog";
import { makeRegionDetail, _classify } from "./regionDetail";

const catalog = getResearchCatalog();
const regionDetail = new Map(
  catalog.regions.map((region) => [region.id, makeRegionDetail(region)]),
);

describe("regionDetail", () => {
  it("covers all 11 regions", () => {
    expect([...regionDetail.keys()].sort()).toEqual([...REGION_IDS].sort());
  });

  it("puts every content and upgrade row in exactly one bucket", () => {
    for (const region of catalog.regions) {
      const detail = regionDetail.get(region.id);
      expect(detail, region.id).toBeDefined();
      const content = detail!.bosses.length + detail!.skilling.length + detail!.otherContent.length;
      expect(content, `${region.id} content`).toBe(region.content.length);
      const upgrades = detail!.gear.length + detail!.skillItems.length;
      expect(upgrades, `${region.id} upgrades`).toBe(region.upgrades.length);
    }
  });

  it("carries the training methods through, with their skill recovered", () => {
    let total = 0;
    for (const region of catalog.regions) {
      const detail = regionDetail.get(region.id)!;
      expect(detail.training.length, `${region.id} training`).toBe(region.training.length);
      total += detail.training.length;
      for (const row of detail.training) expect(row.skill, `${region.id}/${row.id}`).not.toBe("");
    }
    expect(total, "the catalog carries training methods to show").toBeGreaterThan(50);
  });

  it("routes the kinds a player would expect to the boss tab", () => {
    for (const kind of ["boss", "bossing", "Elite Dungeon", "God Wars Dungeon 1", "Barrows", "Slayer/bossing"]) {
      expect(_classify.classifyContent(kind), kind).toBe("boss");
    }
    for (const kind of ["skilling", "Fishing", "Agility", "Divination", "city/skilling hub"]) {
      expect(_classify.classifyContent(kind), kind).toBe("skilling");
    }
  });

  it("splits upgrades into combat gear and skilling items", () => {
    for (const category of ["combat gear", "combat cape", "tier-95 Magic / prayer / scripture", "combat Archaeology relic"]) {
      expect(_classify.classifyUpgrade(category), category).toBe("gear");
    }
    for (const category of [
      "tier-90 augmentable Woodcutting tool cross-region chain",
      "Hunter skilling off-hand cross-region chain",
      "cross-region augmentable Mining tool",
    ]) {
      expect(_classify.classifyUpgrade(category), category).toBe("skillItem");
    }
  });

  it("finds real bosses and real training in the regions that have them", () => {
    const desert = regionDetail.get("desert")!;
    expect(desert.training.length, "desert training methods").toBeGreaterThan(5);
    const asgarnia = regionDetail.get("asgarnia")!;
    expect(asgarnia.bosses.map((b) => b.name).join(" ")).toContain("Graardor");
  });
});
