import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import catalogSource from "#data/research/catalog.json";
import { getResearchCatalog } from "./catalog";

describe("research catalog", () => {
  it("has 11 regions whose ids match REGION_IDS", () => {
    const catalog = getResearchCatalog();
    expect(catalog.regions).toHaveLength(11);
    expect(catalog.datasets.regions).toBe(11);
    expect(catalog.regions.map((r) => r.id).sort()).toEqual([...REGION_IDS].sort());
  });

  it("derives dataset counts from live arrays", () => {
    const catalog = getResearchCatalog();
    const methodCount = catalogSource.skills.reduce(
      (n, skill) => n + skill.methods.length,
      0,
    );
    expect(catalog.datasets.regions).toBe(11);
    expect(catalog.datasets.regions).toBe(catalog.regions.length);
    expect(catalog.datasets.skills).toBe(catalog.skills.length);
    expect(catalog.datasets.trainingMethods).toBe(methodCount);
    expect(catalog.datasets.trainingMethods).toBe(
      new Set(
        catalogSource.skills.flatMap((skill) => skill.methods.map((m) => m.id)),
      ).size,
    );
  });

  it("resolves every region trainingMethodId (no orphans)", () => {
    const methodIds = new Set(
      catalogSource.skills.flatMap((skill) => skill.methods.map((m) => m.id)),
    );
    const orphans: string[] = [];
    for (const region of catalogSource.regions) {
      for (const id of region.trainingMethodIds ?? []) {
        if (!methodIds.has(id)) orphans.push(`${region.id}:${id}`);
      }
    }
    expect(orphans).toEqual([]);
  });
});
