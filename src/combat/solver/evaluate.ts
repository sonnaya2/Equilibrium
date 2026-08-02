import { TICK_SECONDS } from "../core/ticks";
import { simulateRevolution, type RevolutionInput } from "../engine/simulation/revolution";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { withStrengthCape99Dismember } from "../styles/melee/abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "../shared/perks";
import type {
  CandidatePoolOptions,
  ExclusionReason,
  RevolutionBarEvaluation,
  RevolutionEvalRequest,
  ScoreEvalMode,
} from "./contracts";
import { validateBarEligibility } from "./eligibility";
import { MIN_RANKABLE_HORIZON_TICKS, scoreSummary } from "./objective";

export type {
  ObjectiveProfileId,
  ObjectiveWeights,
  RevolutionBarEvaluation,
  RevolutionEvalRequest,
} from "./contracts";

function exploratoryDpm(totalExpected: number, durationTicks: number): number {
  const minutes = (durationTicks * TICK_SECONDS) / 60;
  return minutes > 0 ? totalExpected / minutes : 0;
}

function modeForHorizon(durationTicks: number): ScoreEvalMode {
  return durationTicks >= MIN_RANKABLE_HORIZON_TICKS ? "full" : "search";
}

function failEval(
  request: RevolutionEvalRequest,
  reasons: ExclusionReason[],
  extra: Partial<RevolutionBarEvaluation> = {},
): RevolutionBarEvaluation {
  const horizonTicks = request.durationTicks;
  const mode = modeForHorizon(horizonTicks);
  return {
    ok: false,
    mode,
    exploratory: mode === "search",
    validForFinalRanking: false,
    horizonTicks,
    objectiveType: request.profileId,
    score: Number.NEGATIVE_INFINITY,
    reasons,
    failureReason: reasons[0]?.message,
    bar: request.bar,
    profileId: request.profileId,
    ...extra,
  };
}

/**
 * Exact Revolution evaluation: eligibility → resolve → simulateRevolution → score.
 * Does not search; scores one bar against the real driver.
 *
 * When durationTicks >= MIN_RANKABLE_HORIZON_TICKS, scores via objective.scoreSummary
 * (proportional open/mid/steady windows). Shorter runs use a single totalExpected
 * DPM fallback marked exploratory:true and validForFinalRanking:false.
 *
 * Robust objective failure is never laundered into a successful robust score.
 */
export function evaluateRevolutionBar(request: RevolutionEvalRequest): RevolutionBarEvaluation {
  const { bar, style, durationTicks, pool, sim, profileId, customWeights, includePartial, size } =
    request;

  const reasons: ExclusionReason[] = [];
  const simFields = sim as Omit<RevolutionInput, "bar" | "style" | "durationTicks">;
  const weaponConfiguration = simFields.weaponConfiguration as
    | CandidatePoolOptions["weaponConfiguration"]
    | undefined;
  const equipmentIds = simFields.equipmentIds;

  if (pool.style !== style) {
    reasons.push({
      code: "style-mismatch",
      message: `pool style ${pool.style} does not match request style ${style}`,
    });
  }

  reasons.push(
    ...validateBarEligibility(bar, pool, {
      includePartial,
      size,
      weaponConfiguration,
      equipmentIds,
    }),
  );

  if (reasons.length > 0) {
    return failEval(request, reasons);
  }

  const resolved: AbilitySpec[] = [];
  for (const id of bar) {
    const ability = pool.byId.get(id) as AbilitySpec | undefined;
    if (!ability) {
      reasons.push({
        code: "unknown-id",
        abilityId: id,
        message: `ability ${id} is not in the candidate pool`,
      });
      return failEval(request, reasons);
    }
    resolved.push(ability);
  }

  const abilityMap = new Map<string, AbilitySpec>();
  for (const ability of simFields.abilities) abilityMap.set(ability.id, ability);
  for (const ability of pool.byId.values()) {
    abilityMap.set(ability.id, ability as AbilitySpec);
  }
  for (const ability of resolved) abilityMap.set(ability.id, ability);

  const strengthCape99 = (sim as { strengthCape99?: boolean }).strengthCape99 === true;
  const catalogue = strengthCape99
    ? withStrengthCape99Dismember([...abilityMap.values()], STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
    : [...abilityMap.values()];
  const resolvedBar = strengthCape99
    ? withStrengthCape99Dismember(resolved, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
    : resolved;

  const summary = simulateRevolution({
    ...simFields,
    abilities: catalogue,
    bar: resolvedBar,
    style,
    durationTicks,
  });

  if (!summary.ok) {
    reasons.push({
      code: "sim-failed",
      message: summary.error ?? "revolution simulation failed",
    });
    return failEval(request, reasons, { resolved, summary });
  }

  // Short horizon: exploratory single-window totalExpected DPM (no robust windows).
  if (durationTicks < MIN_RANKABLE_HORIZON_TICKS) {
    const dpm = exploratoryDpm(summary.totalExpected, durationTicks);
    return {
      ok: true,
      mode: "search",
      exploratory: true,
      validForFinalRanking: false,
      horizonTicks: durationTicks,
      objectiveType: profileId,
      score: dpm,
      reasons: [],
      bar,
      resolved,
      summary,
      metrics: {
        dpm,
        totalExpected: summary.totalExpected,
      },
      profileId,
    };
  }

  const scored = scoreSummary(summary, profileId, customWeights);
  if (!scored.ok) {
    // Sim succeeded but robust scoring failed — keep failure visible.
    // Do not copy scalar DPM into synthetic opening/developed/steady windows.
    reasons.push({
      code: "score-failed",
      message: scored.reason,
    });
    return failEval(request, reasons, {
      mode: "full",
      exploratory: false,
      validForFinalRanking: false,
      resolved,
      summary,
      objective: scored,
      failureReason: scored.reason,
    });
  }

  return {
    ok: true,
    mode: "full",
    exploratory: false,
    validForFinalRanking: true,
    horizonTicks: durationTicks,
    objectiveType: profileId,
    score: scored.robustScore,
    reasons: [],
    bar,
    resolved,
    summary,
    objective: scored,
    metrics: {
      dpm: exploratoryDpm(summary.totalExpected, durationTicks),
      totalExpected: summary.totalExpected,
      openingDpm: scored.openingDpm,
      developedDpm: scored.developedDpm,
      steadyDpm: scored.steadyDpm,
    },
    profileId,
  };
}
