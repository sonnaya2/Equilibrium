import { describe, expect, it } from "vitest";
import { TICK_SECONDS } from "../core/ticks";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { simulateRevolution } from "../engine/simulation/revolution";
import { buildCandidatePool } from "./candidatePool";
import { compileEvaluationContext } from "./compiledContext";
import { evaluateRevolutionBar } from "./evaluate";
import {
  OBJECTIVE_HORIZON_TICKS,
  scoreSummary,
  sumDamageInTickRange,
  windowDpmFromDamageByTick,
} from "./objective";

function basic(id: string, name: string, minPct: number, maxPct: number): AbilitySpec {
  return {
    id,
    name,
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct, maxPct } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 5.4,
  };
}

/** Neutral fixture matching revolution tests: base 1000, level 99, full accuracy, no crit. */
const auto: AbilitySpec = {
  id: "attack",
  name: "Attack",
  style: "melee",
  category: "basic",
  autoAttack: true,
  hits: [{ band: { minPct: 110, maxPct: 130 } }],
  adrenaline: { gain: 9 },
};

const alpha = basic("alpha", "Alpha", 100, 100);
const beta = basic("beta", "Beta", 150, 150);
const catalogue = [auto, alpha, beta];

const baseSim = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: catalogue,
};

describe("evaluateRevolutionBar", () => {
  it("scores a short-horizon bar from totalExpected DPM (exploratory)", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    const durationTicks = 30;
    const evaluation = evaluateRevolutionBar({
      bar: ["alpha", "beta"],
      style: "melee",
      durationTicks,
      pool,
      sim: baseSim,
      profileId: "balanced",
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.exploratory).toBe(true);
    expect(evaluation.mode).toBe("search");
    expect(evaluation.validForFinalRanking).toBe(false);
    expect(evaluation.summary?.ok).toBe(true);
    expect(evaluation.resolved?.map((spec) => spec.id)).toEqual(["alpha", "beta"]);

    const direct = simulateRevolution({
      ...baseSim,
      bar: [alpha, beta],
      style: "melee",
      durationTicks,
    });
    expect(direct.ok).toBe(true);
    expect(evaluation.summary!.totalExpected).toBeCloseTo(direct.totalExpected, 10);

    const minutes = (durationTicks * TICK_SECONDS) / 60;
    const expectedDpm = direct.totalExpected / minutes;
    expect(evaluation.score).toBeCloseTo(expectedDpm, 10);
    expect(evaluation.metrics?.dpm).toBeCloseTo(expectedDpm, 10);

    // damageByTick sum over the horizon matches totalExpected.
    const fromTicks = sumDamageInTickRange(direct.damageByTick, 0, durationTicks);
    expect(fromTicks).toBeCloseTo(direct.totalExpected, 8);
  });

  it("uses objective.scoreSummary multi-window scoring at a rankable short horizon (30s)", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    // Thorough full score is 50 ticks - not the 500-tick research horizon.
    const durationTicks = 50;
    const evaluation = evaluateRevolutionBar({
      bar: ["alpha", "beta"],
      style: "melee",
      durationTicks,
      pool,
      sim: baseSim,
      profileId: "balanced",
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.exploratory).toBe(false);
    expect(evaluation.mode).toBe("full");
    expect(evaluation.validForFinalRanking).toBe(true);
    expect(evaluation.objective?.ok).toBe(true);

    const summary = evaluation.summary!;
    const scored = scoreSummary(
      {
        ok: true,
        horizonTicks: durationTicks,
        damageByTick: summary.damageByTick ?? {},
      },
      "balanced",
    );
    expect(scored.ok).toBe(true);
    if (!scored.ok || !evaluation.objective?.ok) return;
    expect(evaluation.score).toBeCloseTo(scored.robustScore, 8);
    expect(evaluation.metrics?.openingDpm).toBeCloseTo(scored.openingDpm, 8);

    // Window DPM matches scaled open window [0, 10) on a 50-tick horizon.
    const opening = windowDpmFromDamageByTick(summary.damageByTick ?? {}, 0, 10);
    expect(evaluation.metrics!.openingDpm).toBeCloseTo(opening, 8);
  });

  it("returns invalid reasons without simulating when the bar fails eligibility", () => {
    const offGcd: AbilitySpec = {
      id: "utility",
      name: "Utility",
      style: "melee",
      category: "utility",
      hits: [],
      offGcd: true,
    };
    const withUtility = buildCandidatePool([...catalogue, offGcd], "melee", {
      includeOffGcd: true,
    });
    const evaluation = evaluateRevolutionBar({
      bar: ["utility"],
      style: "melee",
      durationTicks: 30,
      pool: withUtility,
      sim: { ...baseSim, abilities: [...catalogue, offGcd] },
      profileId: "balanced",
    });
    expect(evaluation.ok).toBe(false);
    expect(evaluation.summary).toBeUndefined();
    expect(evaluation.score).toBe(Number.NEGATIVE_INFINITY);
    expect(evaluation.reasons.some((reason) => reason.code === "off-gcd")).toBe(true);
  });

  it("keeps robust score-failed visible after a successful simulation (no synthetic windows)", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    // Sim runs at full horizon; custom profile without weights fails scoreSummary.
    const evaluation = evaluateRevolutionBar({
      bar: ["alpha", "beta"],
      style: "melee",
      durationTicks: OBJECTIVE_HORIZON_TICKS,
      pool,
      sim: baseSim,
      profileId: "custom",
      // customWeights intentionally omitted → scoreSummary fails
    });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.mode).toBe("full");
    expect(evaluation.exploratory).toBe(false);
    expect(evaluation.validForFinalRanking).toBe(false);
    expect(evaluation.score).toBe(Number.NEGATIVE_INFINITY);
    expect(evaluation.reasons.some((r) => r.code === "score-failed")).toBe(true);
    // Simulation succeeded - summary present - but robust scoring failed.
    expect(evaluation.summary?.ok).toBe(true);
    expect(evaluation.objective?.ok).toBe(false);
    // No laundered synthetic opening/developed/steady metrics.
    expect(evaluation.metrics).toBeUndefined();
    expect(evaluation.failureReason).toMatch(/custom/i);
  });

  it("compiled abilityRegistry path matches rebuild simulate totals", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    const durationTicks = 50;
    const compiled = compileEvaluationContext({
      style: "melee",
      pool,
      catalogue,
      strengthCape99: false,
    });
    const evaluation = evaluateRevolutionBar({
      bar: ["alpha", "beta"],
      style: "melee",
      durationTicks,
      pool,
      sim: { ...baseSim, abilities: compiled.catalogue },
      compiled,
      profileId: "balanced",
    });
    const rebuild = simulateRevolution({
      ...baseSim,
      abilities: compiled.catalogue as AbilitySpec[],
      bar: [alpha, beta],
      style: "melee",
      durationTicks,
    });
    const withRegistry = simulateRevolution({
      ...baseSim,
      abilities: compiled.catalogue as AbilitySpec[],
      abilityRegistry: {
        byId: compiled.byId,
        basicByStyle: compiled.basicByStyle,
      },
      bar: [alpha, beta],
      style: "melee",
      durationTicks,
    });
    expect(evaluation.ok && rebuild.ok && withRegistry.ok).toBe(true);
    expect(evaluation.summary!.totalExpected).toBeCloseTo(rebuild.totalExpected, 10);
    expect(withRegistry.totalExpected).toBeCloseTo(rebuild.totalExpected, 10);
  });
});
