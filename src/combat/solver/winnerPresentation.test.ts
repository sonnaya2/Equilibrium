import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { buildCandidatePool } from "./candidatePool";
import { evaluateRevolutionBar, winnerPresentationFromEvaluation } from "./evaluate";
import { emptyModifierSources, defaultSerializableRequest } from "./worker/serializable";
import { solveFromRequest } from "./solveFromRequest";
import type { ActiveEquipmentEffects } from "../shared/equipment";
import { EQUIPMENT_SET_ACTIVATION } from "../shared/equipment";

const emptyEffects: ActiveEquipmentEffects = {
  activation: EQUIPMENT_SET_ACTIVATION,
  passiveIds: [],
  enchantments: [],
  weaponClass: null,
  defenderEquipped: false,
  passage: { active: false, agonyActive: false },
  amZiFlatDamage: 0,
  amHejDamageBonus: 0,
  vestments: {
    pieces: 0,
    heraldOfChaos: false,
    berserkExtension: false,
    increasedAdrenalineCap: false,
  },
};

const auto = MELEE_ABILITIES.find((a) => a.basicAttack && a.style === "melee")!;
const sever =
  MELEE_ABILITIES.find((a) => a.id === "sever") ??
  MELEE_ABILITIES.find((a) => a.category === "basic" && !a.basicAttack)!;
const assault =
  MELEE_ABILITIES.find((a) => a.id === "assault") ??
  MELEE_ABILITIES.find((a) => a.category === "enhanced" || a.category === "ultimate") ??
  sever;
const catalogue: AbilitySpec[] = [auto, sever, assault].filter(Boolean);

function baseSim() {
  return {
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0.1, damageBonus: 0 },
    abilities: catalogue,
  };
}

describe("winner full-analysis presentation", () => {
  it("projects evaluation summary into DTO presentation fields", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    const bar = [sever.id, assault.id];
    const evaluation = evaluateRevolutionBar({
      bar,
      style: "melee",
      durationTicks: 50,
      pool,
      sim: baseSim(),
      profileId: "balanced",
      detailLevel: "full-analysis",
    });
    expect(evaluation.ok).toBe(true);
    const presentation = winnerPresentationFromEvaluation(evaluation);
    expect(presentation).not.toBeNull();
    expect(presentation!.summary.ok).toBe(true);
    expect(presentation!.summary.totalExpected).toBeGreaterThan(0);
    expect(presentation!.recheckScore).toBe(evaluation.score);
    expect(Number.isFinite(presentation!.summary.dps)).toBe(true);
    expect(presentation!.summary.ticks).toBeGreaterThan(0);
  });

  it("score-only ranking score matches full-analysis recheck for same bar", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    const bar = [sever.id, assault.id];
    const req = {
      bar,
      style: "melee" as const,
      durationTicks: 50,
      pool,
      sim: baseSim(),
      profileId: "balanced" as const,
    };
    const scoreOnly = evaluateRevolutionBar({ ...req, detailLevel: "score-only" });
    const full = evaluateRevolutionBar({ ...req, detailLevel: "full-analysis" });
    expect(scoreOnly.ok).toBe(true);
    expect(full.ok).toBe(true);
    expect(full.score).toBeCloseTo(scoreOnly.score, 10);

    const presentation = winnerPresentationFromEvaluation(full);
    expect(presentation!.recheckScore).toBeCloseTo(scoreOnly.score, 10);
    expect(presentation!.summary.totalExpected).toBeCloseTo(
      scoreOnly.summary?.totalExpected ?? NaN,
      10,
    );
  });

  it("solveFromRequest attaches winner summary and keeps ranking score parity", async () => {
    const request = defaultSerializableRequest({
      style: "melee",
      durationTicks: 100,
      exploreDurationTicks: 40,
      tier: "thorough",
      profileId: "balanced",
      seed: 3,
      minBarSize: 2,
      maxBarSize: 3,
      unlockedRegions: ["misthalin", "havenhythe", "karamja"],
      loadout: {
        base: 1000,
        level: 99,
        accuracy: 1,
        crit: { chance: 0 },
        equipmentEffects: emptyEffects,
        league: {
          ruleset: "base",
          blessings: [],
          blessingIds: [],
          totalArmour: 0,
          maximumLife: 10_000,
          powerburstUntilTick: 0,
          targetTiles: 1,
        },
        equipmentIds: [],
        weaponConfiguration: "dualwield",
        startingAdrenaline: 100,
        modifierSources: emptyModifierSources(),
      },
    });

    const dto = await solveFromRequest(request);
    expect(dto.bar.length).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(dto.score)).toBe(true);
    // Phase 4: DTO only from validated full winners; no degraded exploratory apply path.
    expect(dto.proofLabel).not.toBe("degraded-exploratory-fallback");

    expect(dto.summary).toBeDefined();
    expect(dto.summary!.ok).toBe(true);
    expect(dto.summary!.totalExpected).toBeGreaterThan(0);
    expect(dto.proof?.recheckScore).toBeDefined();
    expect(dto.proof!.recheckScore!).toBeCloseTo(dto.score, 8);
    // Ranking score is the source of truth; recheck is independent full-analysis.
    expect(dto.proof?.notes?.some((n) => n.includes("winner full-analysis"))).toBe(true);
    expect(dto.proof?.notes?.some((n) => n === "score-analysis parity ok")).toBe(true);
  }, 120_000);
});
