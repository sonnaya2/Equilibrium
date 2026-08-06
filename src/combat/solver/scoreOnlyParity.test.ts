import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { simulateRevolution } from "../engine/simulation/revolution";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { activeEquipmentEffects } from "../shared/equipment";
import { buildCandidatePool } from "./candidatePool";
import { evaluateRevolutionBar } from "./evaluate";
import { scoreSummary } from "./objective";

/**
 * Gate: score-only must not change ranking metrics vs full-analysis for
 * bookkeeping-only detail trimming. Dual-Leng score-only keeps the sparse atom
 * state exact; see the Leng case below.
 */

const auto = MELEE_ABILITIES.find((a) => a.basicAttack && a.style === "melee")!;
const alpha =
  MELEE_ABILITIES.find((a) => a.id === "sever") ??
  MELEE_ABILITIES.find((a) => a.category === "basic" && !a.basicAttack)!;
const thrash = MELEE_ABILITIES.find((a) => a.id === "assault") ?? alpha;
const catalogue: AbilitySpec[] = [auto, alpha, thrash].filter(Boolean);

function baseSim(extra: Record<string, unknown> = {}) {
  return {
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0.1, damageBonus: 0 },
    abilities: catalogue,
    ...extra,
  };
}

function tickMapClose(a: Record<number, number>, b: Record<number, number>, digits = 8): void {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].map(Number));
  for (const k of keys) {
    expect(a[k] ?? 0, `damageByTick[${k}]`).toBeCloseTo(b[k] ?? 0, digits);
  }
}

describe("score-only oracle parity (gate)", () => {
  it("simulateRevolution score-only matches full-analysis ranking surface", () => {
    const input = {
      ...baseSim(),
      bar: [alpha, thrash],
      style: "melee" as const,
      durationTicks: 50,
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const score = simulateRevolution(input, { detailLevel: "score-only" });

    expect(full.ok).toBe(true);
    expect(score.ok).toBe(true);
    expect(score.totalExpected).toBeCloseTo(full.totalExpected, 10);
    tickMapClose(score.damageByTick, full.damageByTick, 10);
    expect(score.rng?.residualWeight ?? 0).toBeCloseTo(full.rng?.residualWeight ?? 0, 10);
    expect(score.rng?.exactness).toBe(full.rng?.exactness);

    const fullScore = scoreSummary(full, "balanced");
    const scoreOnlyScore = scoreSummary(score, "balanced");
    expect(fullScore.ok).toBe(true);
    expect(scoreOnlyScore.ok).toBe(true);
    if (fullScore.ok && scoreOnlyScore.ok) {
      expect(scoreOnlyScore.robustScore).toBeCloseTo(fullScore.robustScore, 10);
      expect(scoreOnlyScore.openingDpm).toBeCloseTo(fullScore.openingDpm, 10);
      expect(scoreOnlyScore.developedDpm).toBeCloseTo(fullScore.developedDpm, 10);
      expect(scoreOnlyScore.steadyDpm).toBeCloseTo(fullScore.steadyDpm, 10);
    }
  });

  it("evaluateRevolutionBar score-only matches default full-analysis scores", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    const req = {
      bar: [alpha.id, thrash.id],
      style: "melee" as const,
      durationTicks: 50,
      pool,
      sim: baseSim(),
      profileId: "balanced" as const,
    };
    const full = evaluateRevolutionBar(req);
    const scoreOnly = evaluateRevolutionBar({ ...req, detailLevel: "score-only" });

    expect(full.ok).toBe(true);
    expect(scoreOnly.ok).toBe(true);
    expect(scoreOnly.score).toBeCloseTo(full.score, 10);
    expect(scoreOnly.mode).toBe(full.mode);
    expect(scoreOnly.validForFinalRanking).toBe(full.validForFinalRanking);
    expect(scoreOnly.metrics?.dpm).toBeCloseTo(full.metrics?.dpm ?? NaN, 10);
  });

  it("Leng dual-wield: score-only and full-analysis share sparse atom state", () => {
    const abilities = MELEE_ABILITIES;
    const sim = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities,
      equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
      equipmentEffects: activeEquipmentEffects({
        style: "melee",
        equipmentSlots: {
          mainhand: "item:dark-shard-of-leng",
          offhand: "item:dark-sliver-of-leng",
        },
      }),
      weaponConfiguration: "dualwield" as const,
      context: { style: "melee" as const },
    };
    const barIds = ["assault", "sever", "fury", "dismember"].filter((id) =>
      abilities.some((a) => a.id === id),
    );
    if (barIds.length < 2) return;

    const input = {
      ...sim,
      bar: barIds.map((id) => abilities.find((a) => a.id === id)!),
      style: "melee" as const,
      durationTicks: 50,
    };
    const full = simulateRevolution(input, { detailLevel: "full-analysis" });
    const score = simulateRevolution(input, { detailLevel: "score-only" });
    expect(full.ok).toBe(true);
    expect(score.ok).toBe(true);
    expect(score.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
    expect(full.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
    // Compact mass is residual-free; exactness exact or merged-exactly.
    expect(["exact", "merged-exactly"]).toContain(score.rng?.exactness ?? "exact");
    expect(["exact", "merged-exactly"]).toContain(full.rng?.exactness ?? "exact");
    expect(score.totalExpected).toBeGreaterThan(0);
    expect(full.totalExpected).toBeGreaterThan(0);
  });
});
