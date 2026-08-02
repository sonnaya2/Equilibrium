import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";
import { loadoutStats } from "@/components/combat/loadoutStats";
import {
  emptyBuild,
  MILESTONE_REGION,
  REGION_IDS,
  STARTING_REGIONS,
  toggleElective,
  type BuildState,
  type RegionId,
} from "@/league";
import { packSolverRequest } from "./packRequest";

const NOW = 1_700_000_000_000;

function pack(
  build: BuildState,
  opts?: {
    useBuildRegions?: boolean;
    unlockedRegions?: readonly RegionId[];
  },
) {
  const loadout = { ...DEFAULT_LOADOUT };
  const stats = loadoutStats(loadout);
  return packSolverRequest({
    stats,
    loadout,
    build,
    now: NOW,
    ...opts,
  });
}

describe("packSolverRequest region modes", () => {
  it("defaults to Build unlocked regions when useBuildRegions is omitted", () => {
    let build = emptyBuild();
    build = toggleElective(build, "desert");
    build = toggleElective(build, "asgarnia");
    const req = pack(build);
    const expected = new Set<string>([...STARTING_REGIONS, MILESTONE_REGION, "desert", "asgarnia"]);
    expect(new Set(req.unlockedRegions)).toEqual(expected);
    expect(req.unlockedRegions.length).toBeLessThan(REGION_IDS.length);
  });

  it("useBuildRegions true ignores unlockedRegions override", () => {
    let build = emptyBuild();
    build = toggleElective(build, "morytania");
    const req = pack(build, {
      useBuildRegions: true,
      unlockedRegions: [...REGION_IDS],
    });
    const expected = new Set<string>([...STARTING_REGIONS, MILESTONE_REGION, "morytania"]);
    expect(new Set(req.unlockedRegions)).toEqual(expected);
  });

  it("useBuildRegions false uses the override list exactly", () => {
    let build = emptyBuild();
    build = toggleElective(build, "desert");
    const override = ["kandarin", "fremennik"] as RegionId[];
    const req = pack(build, {
      useBuildRegions: false,
      unlockedRegions: override,
    });
    expect([...req.unlockedRegions].sort()).toEqual([...override].sort());
    expect(req.unlockedRegions).not.toContain("desert");
  });

  it("useBuildRegions false with full REGION_IDS is the unlimited UI path", () => {
    const req = pack(emptyBuild(), {
      useBuildRegions: false,
      unlockedRegions: [...REGION_IDS],
    });
    expect(new Set(req.unlockedRegions)).toEqual(new Set(REGION_IDS));
    expect(req.includeUnknownAvailability).toBe(true);
  });

  it("useBuildRegions false without override defaults to all REGION_IDS", () => {
    let build = emptyBuild();
    build = toggleElective(build, "desert");
    const req = pack(build, { useBuildRegions: false });
    expect(new Set(req.unlockedRegions)).toEqual(new Set(REGION_IDS));
    expect(req.includeUnknownAvailability).toBe(true);
  });

  it("empty build still includes starting and milestone when limited", () => {
    const req = pack(emptyBuild(), { useBuildRegions: true });
    const expected = new Set<string>([...STARTING_REGIONS, MILESTONE_REGION]);
    expect(new Set(req.unlockedRegions)).toEqual(expected);
  });
});
