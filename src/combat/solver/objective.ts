import { TICK_SECONDS } from "../core/ticks";
import { RESIDUAL_FREE_TOLERANCE } from "../engine/simulation/stats";
import type {
  ObjectiveProfileId,
  ObjectiveScore,
  ObjectiveScoreFail,
  ObjectiveScoreOk,
  ObjectiveWeights,
  ObjectiveWindowId,
  ObjectiveWindowSpec,
  ScoreableSummary,
  SolverDamageTotalsBasis,
} from "./contracts";

/** Canonical full research horizon (unhinged). Thorough uses a shorter tier horizon. */

export const OBJECTIVE_HORIZON_SECONDS = 300;
export const OBJECTIVE_HORIZON_TICKS = 500;

/**
 * Shortest horizon that still gets three proportional open/mid/steady windows
 * and may rank for final (validForFinalRanking). Below this → exploratory DPM only.
 * 50 ticks = 30s wall-clock sim time.
 */
export const MIN_RANKABLE_HORIZON_TICKS = 50;

/**
 * Half-open tick windows for the canonical 500-tick / 300s horizon:
 * opening 0-60s, developed 60-180s, steady 180-300s.
 */
export const OBJECTIVE_WINDOWS: readonly ObjectiveWindowSpec[] = [
  { id: "opening", startTick: 0, endTick: 100, seconds: 60 },
  { id: "developed", startTick: 100, endTick: 300, seconds: 120 },
  { id: "steady", startTick: 300, endTick: 500, seconds: 120 },
] as const;

/**
 * Scale open / mid / steady to any rankable horizon (20% / 40% / 40% of ticks),
 * matching the classic 60 / 120 / 120 second split on a 300s run.
 */
export function objectiveWindowsForHorizon(horizonTicks: number): readonly ObjectiveWindowSpec[] {
  const h = Math.max(MIN_RANKABLE_HORIZON_TICKS, Math.floor(horizonTicks));
  if (h === OBJECTIVE_HORIZON_TICKS) return OBJECTIVE_WINDOWS;

  let oEnd = Math.max(1, Math.round(h * 0.2));
  let dEnd = Math.max(oEnd + 1, Math.round(h * 0.6));
  if (dEnd >= h) dEnd = h - 1;
  if (oEnd >= dEnd) oEnd = Math.max(1, dEnd - 1);

  return [
    { id: "opening", startTick: 0, endTick: oEnd, seconds: oEnd * TICK_SECONDS },
    {
      id: "developed",
      startTick: oEnd,
      endTick: dEnd,
      seconds: (dEnd - oEnd) * TICK_SECONDS,
    },
    {
      id: "steady",
      startTick: dEnd,
      endTick: h,
      seconds: (h - dEnd) * TICK_SECONDS,
    },
  ] as const;
}

export const OBJECTIVE_PRESETS: Readonly<
  Record<Exclude<ObjectiveProfileId, "custom">, ObjectiveWeights>
> = {
  balanced: {
    opening: 1,
    developed: 1,
    steady: 1,
    robustMean: 0.8,
    robustMin: 0.2,
  },
  burst: {
    opening: 0.7,
    developed: 0.2,
    steady: 0.1,
    robustMean: 1,
    robustMin: 0,
  },
  sustained: {
    opening: 0.1,
    developed: 0.35,
    steady: 0.55,
    robustMean: 0.7,
    robustMin: 0.3,
  },
};

export function resolveObjectiveWeights(
  profileId: ObjectiveProfileId,
  customWeights?: ObjectiveWeights,
): ObjectiveWeights | { error: string } {
  if (profileId === "custom") {
    if (!customWeights) return { error: "custom profile requires customWeights" };
    return customWeights;
  }
  return OBJECTIVE_PRESETS[profileId];
}

export function validateObjectiveWeights(weights: ObjectiveWeights): string | null {
  const fields: (keyof ObjectiveWeights)[] = [
    "opening",
    "developed",
    "steady",
    "robustMean",
    "robustMin",
  ];
  for (const key of fields) {
    const v = weights[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return `invalid weight ${key}=${String(v)}`;
    }
  }
  const windowSum = weights.opening + weights.developed + weights.steady;
  if (windowSum <= 0) return "window weights must sum to a positive value";
  const robustSum = weights.robustMean + weights.robustMin;
  if (robustSum <= 0) return "robustMean + robustMin must be positive";
  return null;
}

/** Sum damage with startTick <= tick < endTick (half-open). */
export function sumDamageInTickRange(
  damageByTick: Record<number, number>,
  startTick: number,
  endTick: number,
): number {
  let sum = 0;
  for (const key of Object.keys(damageByTick)) {
    const tick = Number(key);
    if (tick >= startTick && tick < endTick) sum += damageByTick[tick] ?? 0;
  }
  return sum;
}

/** Fixed-window DPM: damage / windowSeconds * 60. */
export function windowDpmFromDamageByTick(
  damageByTick: Record<number, number>,
  startTick: number,
  endTick: number,
): number {
  const ticks = endTick - startTick;
  if (!(ticks > 0)) return 0;
  const windowSeconds = ticks * TICK_SECONDS;
  const damage = sumDamageInTickRange(damageByTick, startTick, endTick);
  return (damage / windowSeconds) * 60;
}

function fail(profileId: ObjectiveProfileId, reason: string): ObjectiveScoreFail {
  return { ok: false, reason, robustScore: 0, profileId };
}

function windowDpms(
  damageByTick: Record<number, number>,
  windows: readonly ObjectiveWindowSpec[] = OBJECTIVE_WINDOWS,
): Record<ObjectiveWindowId, number> {
  const out = { opening: 0, developed: 0, steady: 0 };
  for (const w of windows) {
    out[w.id] = windowDpmFromDamageByTick(damageByTick, w.startTick, w.endTick);
  }
  return out;
}

/**
 * Score a damage ledger under a profile.
 * Hard-fails on invalid weights or insufficient horizon when horizonTicks is set.
 * Horizons below the canonical 500 ticks use proportional open/mid/steady windows.
 * Caller must only pass unit-mass ledgers (see summaryEligibleForObjectiveScore).
 */
export function scoreFromDamageByTick(
  damageByTick: Record<number, number>,
  profileId: ObjectiveProfileId,
  customWeights?: ObjectiveWeights,
  horizonTicks?: number,
): ObjectiveScore {
  const resolved = resolveObjectiveWeights(profileId, customWeights);
  if ("error" in resolved) return fail(profileId, resolved.error);

  const weightError = validateObjectiveWeights(resolved);
  if (weightError) return fail(profileId, weightError);

  if (horizonTicks !== undefined && horizonTicks < MIN_RANKABLE_HORIZON_TICKS) {
    return fail(
      profileId,
      `insufficient horizon: need ${MIN_RANKABLE_HORIZON_TICKS} ticks, got ${horizonTicks}`,
    );
  }

  const windows =
    horizonTicks === undefined ? OBJECTIVE_WINDOWS : objectiveWindowsForHorizon(horizonTicks);
  const dpm = windowDpms(damageByTick, windows);
  const windowSum = resolved.opening + resolved.developed + resolved.steady;
  const weightedMean =
    (dpm.opening * resolved.opening +
      dpm.developed * resolved.developed +
      dpm.steady * resolved.steady) /
    windowSum;
  const minDpm = Math.min(dpm.opening, dpm.developed, dpm.steady);
  const robustScore = weightedMean * resolved.robustMean + minDpm * resolved.robustMin;

  const ok: ObjectiveScoreOk = {
    ok: true,
    openingDpm: dpm.opening,
    developedDpm: dpm.developed,
    steadyDpm: dpm.steady,
    minDpm,
    weightedMean,
    robustScore,
    profileId,
    weights: resolved,
  };
  return ok;
}

/** Exactness values that are never rankable as exact objective scores. */
export const NON_EXACT_BRANCH_EXACTNESS = [
  "approximated",
  "bounded-approximation",
  "truncated",
  "resampled",
] as const;

export type NonExactBranchExactness = (typeof NON_EXACT_BRANCH_EXACTNESS)[number];

/** Totals bases that are never unit-mass EV and must not rank. */
export const NON_UNIT_MASS_TOTALS_BASIS = [
  "concrete-terminals",
  "known-mass-contribution",
] as const;

export type NonUnitMassTotalsBasis = (typeof NON_UNIT_MASS_TOTALS_BASIS)[number];

export function isNonExactBranchExactness(
  exactness: string | undefined,
): exactness is NonExactBranchExactness {
  return (
    exactness === "approximated" ||
    exactness === "bounded-approximation" ||
    exactness === "truncated" ||
    exactness === "resampled"
  );
}

export function isNonUnitMassTotalsBasis(
  basis: string | undefined,
): basis is NonUnitMassTotalsBasis {
  return basis === "concrete-terminals" || basis === "known-mass-contribution";
}

/**
 * Prefer damage.scope / rng.totalsBasis when present (engine wires both).
 * Absent on older payloads - residualWeight / exactness still gate.
 */
export function resolveTotalsBasis(summary: ScoreableSummary): string | undefined {
  const fromDamage = summary.damage?.scope;
  if (fromDamage !== undefined) return fromDamage;
  return summary.rng?.totalsBasis;
}

/**
 * Residual at or below this is treated as residual-free for ranking, fidelity, Apply.
 * Shared across objective, adaptive ladders, and DTO honesty.
 */
export { RESIDUAL_FREE_TOLERANCE };

/**
 * Why a summary cannot produce a rankable score (objective or exploratory).
 * Conditional concrete mean / known-mass ledgers never rank.
 * null when eligible for unit-mass scoring.
 */
export function summaryObjectiveIneligibilityReason(
  summary: ScoreableSummary,
  options?: { allowExpectedDamageApproximation?: boolean },
): string | null {
  if (!summary.ok) return summary.error ?? "simulation failed";
  const failedWeight = summary.rng?.failedWeight ?? 0;
  if (failedWeight > 0) return `simulation failedWeight=${failedWeight}`;
  const residualWeight = summary.rng?.residualWeight ?? 0;
  if (residualWeight > RESIDUAL_FREE_TOLERANCE) {
    return `simulation residualWeight=${residualWeight}`;
  }
  // Prefer damage.scope / rng.totalsBasis when present.
  const totalsBasis = resolveTotalsBasis(summary);
  if (isNonUnitMassTotalsBasis(totalsBasis)) {
    return `simulation totalsBasis=${totalsBasis}`;
  }
  const exactness = summary.rng?.exactness;
  if (
    isNonExactBranchExactness(exactness) &&
    !(
      options?.allowExpectedDamageApproximation === true &&
      (exactness === "bounded-approximation" || exactness === "approximated")
    )
  ) {
    return `simulation exactness=${exactness}`;
  }
  return null;
}

/**
 * True when a sim summary may produce a rankable objective or exploratory score.
 * Residual mass, non-unit-mass totals basis, or non-exact expansion never ranks.
 */
export function summaryEligibleForObjectiveScore(summary: ScoreableSummary): boolean {
  return summaryObjectiveIneligibilityReason(summary) === null;
}

/**
 * Exact proof labels require exact (or merged-exactly) branch expansion.
 * Residual / approximation never unlock full-objective-global-optimum claims.
 */
export function exactnessEligibleForExactProof(exactness: string | undefined): boolean {
  if (exactness === undefined) return true;
  if (isNonExactBranchExactness(exactness)) return false;
  return exactness === "exact" || exactness === "merged-exactly";
}

/**
 * Score a simulation summary - uses damageByTick only when unit-mass eligible.
 * Rejects residual / known-mass / concrete-terminals / non-exact / sim errors.
 * Conditional tick ledgers must never be treated as unit-mass EV.
 */
export function scoreSummary(
  summary: ScoreableSummary,
  profileId: ObjectiveProfileId,
  customWeights?: ObjectiveWeights,
  options?: { allowExpectedDamageApproximation?: boolean },
): ObjectiveScore {
  const reason = summaryObjectiveIneligibilityReason(summary, options);
  if (reason !== null) {
    return fail(profileId, reason);
  }
  // Unit-mass eligible only: scoreFromDamageByTick on residual/conditional ledgers is forbidden.
  return scoreFromDamageByTick(
    summary.damageByTick,
    profileId,
    customWeights,
    summary.horizonTicks,
  );
}

/** True when an eval result carries a finite numeric score usable for ranking. */
export function isFiniteEval(
  result: { score: number } | ObjectiveScore | null | undefined,
): boolean {
  if (result == null) return false;
  if ("ok" in result) {
    return result.ok === true && Number.isFinite(result.robustScore);
  }
  return typeof result.score === "number" && Number.isFinite(result.score);
}

/** Re-export basis token type for call sites that prefer objective.ts import. */
export type { SolverDamageTotalsBasis };
