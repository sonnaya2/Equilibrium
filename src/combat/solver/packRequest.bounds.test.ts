import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";
import { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";
import { emptyBuild } from "@/league";
import { packSolverRequest } from "./packRequest";
import { clampSolverBarSizes, MIN_SOLVER_BAR_SIZE } from "./barPolicy";

const NOW = 1_700_000_000_000;

function packBounds(
  minBarSize?: number,
  maxBarSize?: number,
  abilityRules: {
    disabledAbilityIds?: readonly string[];
    lockedAbilityIds?: readonly string[];
  } = {},
) {
  const loadout = { ...DEFAULT_LOADOUT };
  const model = toResolvedCombatModel(loadout, { now: NOW });
  return packSolverRequest({
    model,
    style: model.style,
    build: emptyBuild(),
    now: NOW,
    minBarSize,
    maxBarSize,
    ...abilityRules,
  });
}

describe("packSolverRequest bar bounds", () => {
  it("preserves fixed four-slot bounds through clamp + pack", () => {
    const clamped = clampSolverBarSizes(4, 4);
    expect(clamped).toEqual({ minBarSize: 4, maxBarSize: 4 });
    const req = packBounds(4, 4);
    expect(req.minBarSize).toBe(4);
    expect(req.maxBarSize).toBe(4);
  });

  it("preserves ranged windows 4..6, 5..8, 8..10, 6..6", () => {
    expect(packBounds(4, 6)).toMatchObject({ minBarSize: 4, maxBarSize: 6 });
    expect(packBounds(5, 8)).toMatchObject({ minBarSize: 5, maxBarSize: 8 });
    expect(packBounds(8, 10)).toMatchObject({ minBarSize: 8, maxBarSize: 10 });
    expect(packBounds(6, 6)).toMatchObject({ minBarSize: 6, maxBarSize: 6 });
  });

  it("does not silently expand a collapsed max to the full product range", () => {
    const req = packBounds(4, 6);
    expect(req.maxBarSize).toBe(6);
    expect(req.minBarSize).toBe(4);
    expect(req.maxBarSize).not.toBe(10);
  });

  it("clamps out-of-range input into 4..11 without inventing a wider intent", () => {
    expect(packBounds(1, 6)).toMatchObject({ minBarSize: MIN_SOLVER_BAR_SIZE, maxBarSize: 6 });
    expect(packBounds(5, 99)).toMatchObject({ minBarSize: 5, maxBarSize: 11 });
  });

  it("defaults to full product window when min/max omitted", () => {
    const req = packBounds();
    expect(req.minBarSize).toBe(4);
    expect(req.maxBarSize).toBe(11);
  });

  it("preserves fixed 7..11 lengths", () => {
    expect(packBounds(7, 7)).toMatchObject({ minBarSize: 7, maxBarSize: 7 });
    expect(packBounds(11, 11)).toMatchObject({ minBarSize: 11, maxBarSize: 11 });
  });

  it("packs disabled and locked ability ids", () => {
    expect(
      packBounds(4, 6, {
        disabledAbilityIds: ["slice"],
        lockedAbilityIds: ["berserk"],
      }),
    ).toMatchObject({
      disabledAbilityIds: ["slice"],
      lockedAbilityIds: ["berserk"],
    });
  });
});
