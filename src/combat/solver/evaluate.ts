import { TICK_SECONDS } from "../core/ticks";
import { simulateRevolution, type RevolutionInput } from "../engine/simulation/revolution";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type {
  CandidatePoolOptions,
  ExclusionReason,
  RevolutionBarEvaluation,
  RevolutionEvalRequest,
} from "./contracts";
import { validateBarEligibility } from "./eligibility";
import { OBJECTIVE_HORIZON_TICKS, scoreSummary } from "./objective";

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

/**
 * Exact Revolution evaluation: eligibility → resolve → simulateRevolution → score.
 * Does not search; scores one bar against the real driver.
 *
 * When durationTicks >= OBJECTIVE_HORIZON_TICKS, scores via objective.scoreSummary
 * (opening/developed/steady damageByTick windows). Shorter runs use a single
 * totalExpected DPM fallback marked exploratory:true.
 */
export function evaluateRevolutionBar(request: RevolutionEvalRequest): RevolutionBarEvaluation {
  const { bar, style, durationTicks, pool, sim, profileId, customWeights, includePartial, size } =
    request;

  const reasons: ExclusionReason[] = [];
  const simFields = sim as Omit<RevolutionInput, "bar" | "style" | "durationTicks">;
  const weaponConfiguration = simFields.weaponConfiguration as
    CandidatePoolOptions["weaponConfiguration"] | undefined;
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
    return {
      ok: false,
      exploratory: false,
      score: Number.NEGATIVE_INFINITY,
      reasons,
      bar,
      profileId,
    };
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
      return {
        ok: false,
        exploratory: false,
        score: Number.NEGATIVE_INFINITY,
        reasons,
        bar,
        profileId,
      };
    }
    resolved.push(ability);
  }

  const abilityMap = new Map<string, AbilitySpec>();
  for (const ability of simFields.abilities) abilityMap.set(ability.id, ability);
  for (const ability of pool.byId.values()) {
    abilityMap.set(ability.id, ability as AbilitySpec);
  }
  for (const ability of resolved) abilityMap.set(ability.id, ability);

  const summary = simulateRevolution({
    ...simFields,
    abilities: [...abilityMap.values()],
    bar: resolved,
    style,
    durationTicks,
  });

  if (!summary.ok) {
    reasons.push({
      code: "sim-failed",
      message: summary.error ?? "revolution simulation failed",
    });
    return {
      ok: false,
      exploratory: false,
      score: Number.NEGATIVE_INFINITY,
      reasons,
      bar,
      resolved,
      summary,
      profileId,
    };
  }

  // Short horizon: exploratory single-window totalExpected DPM (no robust windows).
  if (durationTicks < OBJECTIVE_HORIZON_TICKS) {
    const dpm = exploratoryDpm(summary.totalExpected, durationTicks);
    return {
      ok: true,
      exploratory: true,
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
    // failedWeight / branch failures are common with Impatient/Relentless.
    // Do not hard-kill ranking: fall back to fixed-window DPM from the ledger
    // so finalize always returns a usable bar.
    const soft = exploratoryDpm(summary.totalExpected, durationTicks);
    if (Number.isFinite(soft) && summary.totalExpected > 0) {
      return {
        ok: true,
        exploratory: true,
        score: soft,
        reasons: [
          {
            code: "score-failed",
            message: scored.reason,
          },
        ],
        bar,
        resolved,
        summary,
        metrics: {
          dpm: soft,
          totalExpected: summary.totalExpected,
        },
        profileId,
      };
    }
    reasons.push({
      code: "score-failed",
      message: scored.reason,
    });
    return {
      ok: false,
      exploratory: false,
      score: Number.NEGATIVE_INFINITY,
      reasons,
      bar,
      resolved,
      summary,
      objective: scored,
      profileId,
    };
  }

  return {
    ok: true,
    exploratory: false,
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
