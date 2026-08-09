import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT, type Loadout } from "@/components/combat/useLoadout";
import { loadoutStats } from "@/components/combat/loadoutStats";
import { packSolverRequestFromUi } from "@/components/combat/useRevolutionSolver";
import { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";
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
import { isSerializableSimBase } from "./worker/serializable";

const NOW = 1_700_000_000_000;

const TARGET_DEFAULTS = {
  defenceLevel: 80,
  affinity: 60,
};

function withGear(patch: Partial<Loadout>): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
    target:
      patch.target === undefined
        ? DEFAULT_LOADOUT.target
        : patch.target === null
          ? null
          : { ...TARGET_DEFAULTS, ...patch.target },
  };
}

function pack(
  build: BuildState,
  opts?: {
    useBuildRegions?: boolean;
    unlockedRegions?: readonly RegionId[];
  },
) {
  const model = toResolvedCombatModel(DEFAULT_LOADOUT, { now: NOW });
  return packSolverRequest({
    model,
    style: model.style,
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

  it("unrestricted pool does not re-gate stand: locked-build stats keep helmet null", () => {
    // Stand needs Anachronia; stats built without it (Setup / Revolution path).
    // limitToRegions false still opens ability pool to all REGION_IDS.
    const loadout = withGear({
      style: "melee",
      buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
      target: { defenceLevel: 80, affinity: 60, onSlayerTask: true },
    });
    const locked = ["misthalin", "kandarin"] as const;
    const stats = loadoutStats(loadout, { unlockedRegions: [...locked] });
    expect(stats.slayerHelmet).toBeNull();

    const combatModel = toResolvedCombatModel(
      loadout,
      {
        unlockedRegions: [...locked],
        now: NOW,
      },
      stats,
    );
    expect(combatModel.modifierSources.slayerHelmet).toBeNull();

    const req = packSolverRequestFromUi({
      combatModel,
      loadout,
      build: emptyBuild(),
      modelled: [],
      solverTier: "thorough",
      solverProfile: "balanced",
      limitToRegions: false,
      barSizePreset: "range4_11",
      now: NOW,
    });
    expect(new Set(req.unlockedRegions)).toEqual(new Set(REGION_IDS));
    expect(req.includeUnknownAvailability).toBe(true);
    expect(isSerializableSimBase(req.loadout)).toBe(true);
    if (isSerializableSimBase(req.loadout)) {
      expect(req.loadout.modifierSources.slayerHelmet).toBeNull();
    }
  });
});
