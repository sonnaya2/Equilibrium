import { TICK_SECONDS } from "../core/ticks";
import type {
  ObjectiveProfileId,
  ObjectiveScore,
  ObjectiveScoreFail,
  ObjectiveScoreOk,
  ObjectiveWeights,
  ObjectiveWindowId,
  ObjectiveWindowSpec,
  ScoreableSummary,
} from "./contracts";

/** Fixed-window robust objective over a 300s / 500-tick horizon. */

export const OBJECTIVE_HORIZON_SECONDS = 300;
export const OBJECTIVE_HORIZON_TICKS = 500;

/**
 * Half-open tick windows covering [0, 500):
 * opening 0–60s, developed 60–180s, steady 180–300s.
 */
export const OBJECTIVE_WINDOWS: readonly ObjectiveWindowSpec[] = [
  { id: "opening", startTick: 0, endTick: 100, seconds: 60 },
  { id: "developed", startTick: 100, endTick: 300, seconds: 120 },
  { id: "steady", startTick: 300, endTick: 500, seconds: 120 },
] as const;

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

function windowDpms(damageByTick: Record<number, number>): Record<ObjectiveWindowId, number> {
  const out = { opening: 0, developed: 0, steady: 0 };
  for (const w of OBJECTIVE_WINDOWS) {
    out[w.id] = windowDpmFromDamageByTick(damageByTick, w.startTick, w.endTick);
  }
  return out;
}

/**
 * Score a damage ledger under a profile.
 * Hard-fails on invalid weights or insufficient horizon when horizonTicks is set.
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

  if (horizonTicks !== undefined && horizonTicks < OBJECTIVE_HORIZON_TICKS) {
    return fail(
      profileId,
      `insufficient horizon: need ${OBJECTIVE_HORIZON_TICKS} ticks, got ${horizonTicks}`,
    );
  }

  const dpm = windowDpms(damageByTick);
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

/** Score a simulation summary — uses damageByTick only; rejects sim errors. */
export function scoreSummary(
  summary: ScoreableSummary,
  profileId: ObjectiveProfileId,
  customWeights?: ObjectiveWeights,
): ObjectiveScore {
  if (!summary.ok) {
    return fail(profileId, summary.error ?? "simulation failed");
  }
  const failedWeight = summary.rng?.failedWeight ?? 0;
  if (failedWeight > 0) {
    return fail(profileId, `simulation failedWeight=${failedWeight}`);
  }
  return scoreFromDamageByTick(
    summary.damageByTick,
    profileId,
    customWeights,
    summary.horizonTicks,
  );
}

/** True when an eval result carries a finite numeric score usable for ranking. */
export function isFiniteEval(result: { score: number } | ObjectiveScore | null | undefined): boolean {
  if (result == null) return false;
  if ("ok" in result) {
    return result.ok === true && Number.isFinite(result.robustScore);
  }
  return typeof result.score === "number" && Number.isFinite(result.score);
}
