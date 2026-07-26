import { describe, expect, it } from "vitest";
import {
  getAllArchaeologyRelicAcquisitions,
  getAllInventionComponentChains,
  getAllSlayerMethods,
  getSlayerMethodsByRegion,
  getStaleSlayerMethodCorrections,
} from "./slayerPlanner";

describe("slayerPlanner loaders", () => {
  it("composes all Slayer method packs without empty region_options", () => {
    const methods = getAllSlayerMethods();
    expect(methods.length).toBeGreaterThanOrEqual(20);
    for (const method of methods) {
      expect(method.region_options?.length).toBeGreaterThan(0);
      expect(method.monster || method.id).toBeTruthy();
    }
  });

  it("filters by region option", () => {
    const forinthry = getSlayerMethodsByRegion("forinthry");
    expect(forinthry.length).toBeGreaterThan(0);
    expect(forinthry.every((m) => m.region_options.some((r) => r.toLowerCase() === "forinthry"))).toBe(
      true,
    );
  });

  it("exposes invention chains, archaeology relics, and stale corrections", () => {
    expect(getAllInventionComponentChains().length).toBeGreaterThan(0);
    expect(getAllArchaeologyRelicAcquisitions().length).toBeGreaterThan(0);
    expect(getStaleSlayerMethodCorrections().length).toBeGreaterThan(0);
  });
});
