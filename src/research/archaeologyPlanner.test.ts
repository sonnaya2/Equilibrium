import { describe, expect, it } from "vitest";
import {
  getCollectionRelicRoutes,
  getMuseumCollectionMatrix,
  getMuseumCollectionMatrixByRegion,
  getRelicLoadoutProgression,
  getRelicSystemProgression,
  getUnobtainableMuseumCollections,
} from "./archaeologyPlanner";
import guildSource from "#shard/research/planner-expansions-archaeology-guild.json";
import museumMatrixSource from "#shard/research/planner-expansions-archaeology-museum-collections-matrix.json";

describe("archaeologyPlanner loaders", () => {
  it("filters the stale guildmaster second-loadout claim", () => {
    const system = getRelicSystemProgression();
    expect(system.some((row) => row.id === guildSource.stale_data_correction.target_id)).toBe(
      false,
    );
  });

  it("returns collection routes and loadout ladder", () => {
    expect(getCollectionRelicRoutes().length).toBeGreaterThan(0);
    expect(getRelicLoadoutProgression().length).toBe(3);
  });

  it("loads permanent museum collection matrix without seasonal content", () => {
    const matrix = getMuseumCollectionMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(80);
    expect(matrix.length).toBe(museumMatrixSource.collections.length);
    expect(getUnobtainableMuseumCollections()).toEqual([]);
    expect(
      matrix.some((row) => /hollow|bounty of bones|horrible hollow/i.test(String(row.name))),
    ).toBe(false);
  });

  it("filters museum matrix by region and keeps multi-region rows", () => {
    const desert = getMuseumCollectionMatrixByRegion("desert");
    expect(desert.length).toBeGreaterThan(0);
    expect(
      desert.every((row) => {
        const regions = [
          ...(row.required_regions ?? []),
          ...(row.artifact_regions ?? []),
          ...(row.collector_regions ?? []),
        ].map((r) => String(r).toLowerCase());
        return regions.includes("desert");
      }),
    ).toBe(true);
    const multi = getMuseumCollectionMatrix().filter(
      (row) => (row.required_regions ?? []).length > 1,
    );
    expect(multi.length).toBeGreaterThan(0);
    expect(multi.every((row) => Boolean(row.comboLabel))).toBe(true);
  });
});
