import { describe, expect, it } from "vitest";
import {
  getCollectionRelicRoutes,
  getRelicLoadoutProgression,
  getRelicSystemProgression,
} from "./archaeologyPlanner";
import guildSource from "../../data/research/planner-expansions-archaeology-guild.json";

describe("archaeologyPlanner loaders", () => {
  it("filters the stale guildmaster second-loadout claim", () => {
    const system = getRelicSystemProgression();
    expect(system.some((row) => row.id === guildSource.stale_data_correction.target_id)).toBe(false);
  });

  it("returns collection routes and loadout ladder", () => {
    expect(getCollectionRelicRoutes().length).toBeGreaterThan(0);
    expect(getRelicLoadoutProgression().length).toBe(3);
  });
});
