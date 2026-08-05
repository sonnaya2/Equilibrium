import { TICK_SECONDS } from "../core/ticks";
import { simulateRevolution, type RevolutionInput } from "../engine/simulation/revolution";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type {
  CandidatePoolOptions,
  ExclusionReason,
  RevolutionBarEvaluation,
  RevolutionEvalRequest,
  ScoreEvalMode,
  ScoreableSummary,
} from "./contracts";
import {
  compileEvaluationContextFromEvalRequest,
  type CompiledEvaluationContext,
} from "./compiledContext";
import { validateBarEligibility, type EligibilityMemo } from "./eligibility";
import {
  MIN_RANKABLE_HORIZON_TICKS,
  scoreSummary,
  summaryObjectiveIneligibilityReason,
} from "./objective";
import {
  resolveBranchFidelityLadder,
  simulateWithAdaptiveBranchFidelity,
  type BranchFidelityAttemptMeta,
} from "./branchFidelity";

export type {
  ObjectiveProfileId,
  ObjectiveWeights,
  RevolutionBarEvaluation,
  RevolutionEvalRequest,
} from "./contracts";

/** Session-only fields; not part of the stable contracts surface. */
export type RevolutionEvalRequestWithSession = RevolutionEvalRequest & {
  eligibilityMemo?: EligibilityMemo;
  /** Prebuilt catalogue / byId from createEvaluateFn; skips per-eval rebuild. */
  compiled?: CompiledEvaluationContext;
};

/**
 * Compact presentation fields for SolverResultDTO after a full-analysis winner
 * re-sim. Ranking never reads this; search/finalize stay score-only.
 */
export interface WinnerPresentationSummary {
  totalExpected: number;
  dps: number;
  ticks: number;
  ok: boolean;
  error?: string;
  rng?: {
    residualWeight?: number;
    exactness?: string;
    failedWeight?: number;
    probabilityMass?: number;
    concreteMass?: number;
    totalsBasis?: string;
  };
  failure?: {
    failedWeight?: number;
    successfulWeight?: number;
    totalsScope?: string;
    primaryReason?: string;
  };
}

export interface WinnerPresentation {
  summary: WinnerPresentationSummary;
  /** Score from the full-analysis re-sim (host sanity vs ranking score). */
  recheckScore: number;
  rng?: {
    residualWeight?: number;
    exactness?: string;
  };
}

type PresentationSummarySource = {
  ok: boolean;
  error?: string;
  totalExpected?: number;
  dps?: number;
  ticks?: number;
  rng?: {
    residualWeight?: number;
    exactness?: string | { toString(): string };
    failedWeight?: number;
    probabilityMass?: number;
    concreteMass?: number;
    totalsBasis?: string;
    failure?: {
      failedWeight?: number;
      successfulWeight?: number;
      totalsScope?: string;
      primaryReason?: string;
    };
  };
  failure?: {
    failedWeight?: number;
    successfulWeight?: number;
    totalsScope?: string;
    primaryReason?: string;
  };
};

/**
 * Project a full-analysis (or any) evaluation into DTO presentation fields.
 * Returns null when the sim did not produce a usable summary.
 */
export function winnerPresentationFromEvaluation(
  evaluation: RevolutionBarEvaluation,
): WinnerPresentation | null {
  const raw = evaluation.summary as PresentationSummarySource | undefined;
  if (!raw) return null;

  const failureSrc = raw.failure ?? raw.rng?.failure;
  const summary: WinnerPresentationSummary = {
    totalExpected: raw.totalExpected ?? 0,
    dps: raw.dps ?? 0,
    ticks: raw.ticks ?? 0,
    ok: raw.ok,
    ...(raw.error !== undefined ? { error: raw.error } : {}),
  };

  if (raw.rng) {
    summary.rng = {
      residualWeight: raw.rng.residualWeight,
      exactness:
        raw.rng.exactness === undefined
          ? undefined
          : typeof raw.rng.exactness === "string"
            ? raw.rng.exactness
            : String(raw.rng.exactness),
      failedWeight: raw.rng.failedWeight,
      probabilityMass: raw.rng.probabilityMass,
      concreteMass: raw.rng.concreteMass,
      totalsBasis: raw.rng.totalsBasis,
    };
  }

  if (failureSrc) {
    summary.failure = {
      failedWeight: failureSrc.failedWeight,
      successfulWeight: failureSrc.successfulWeight,
      totalsScope: failureSrc.totalsScope,
      primaryReason: failureSrc.primaryReason,
    };
  }

  const rng = summary.rng
    ? {
        residualWeight: summary.rng.residualWeight,
        exactness: summary.rng.exactness,
      }
    : undefined;

  return {
    summary,
    recheckScore: evaluation.score,
    ...(rng ? { rng } : {}),
  };
}

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

/** Optional diagnostic fields from engine summary (never used for ranking). */
function diagnosticMetrics(summary: ScoreableSummary & { totalExpected?: number }): {
  knownMassExpectedDamage?: number;
  conditionalConcreteMean?: number;
} {
  const known =
    summary.knownMassExpectedDamage ?? summary.damage?.knownMassExpectedDamage;
  const conditional =
    summary.conditionalConcreteMean ?? summary.damage?.conditionalConcreteMean;
  return {
    ...(known !== undefined ? { knownMassExpectedDamage: known } : {}),
    ...(conditional !== undefined ? { conditionalConcreteMean: conditional } : {}),
  };
}

/**
 * Exact Revolution evaluation: eligibility → resolve → simulateRevolution → score.
 * Does not search; scores one bar against the real driver.

 * When durationTicks >= MIN_RANKABLE_HORIZON_TICKS, scores via objective.scoreSummary
 * (proportional open/mid/steady windows). Shorter runs use a single totalExpected
 * DPM fallback marked exploratory:true and validForFinalRanking:false - only when
 * the summary is unit-mass eligible. Residual / known-mass / concrete-terminal
 * conditional means never emit a finite rankable exploratory score.

 * Robust objective failure is never laundered into a successful robust score.
 */
export function evaluateRevolutionBar(
  request: RevolutionEvalRequestWithSession,
): RevolutionBarEvaluation {
  const {
    bar,
    style,
    durationTicks,
    pool,
    sim,
    profileId,
    customWeights,
    includePartial,
    size,
    eligibilityMemo,
  } = request;

  const reasons: ExclusionReason[] = [];
  const simFields = sim as Omit<RevolutionInput, "bar" | "style" | "durationTicks">;
  const weaponConfiguration = simFields.weaponConfiguration as
    | CandidatePoolOptions["weaponConfiguration"]
    | undefined;
  const equipmentIds = simFields.equipmentIds;
  const passiveIds = (simFields as { equipmentEffects?: { passiveIds?: readonly string[] } })
    .equipmentEffects?.passiveIds;

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
      passiveIds,
      memo: eligibilityMemo,
    }),
  );

  if (reasons.length > 0) {
    return failEval(request, reasons);
  }

  const compiled: CompiledEvaluationContext =
    request.compiled ?? compileEvaluationContextFromEvalRequest(request);

  const resolved: AbilitySpec[] = [];
  for (const id of bar) {
    const ability =
      (compiled.byId.get(id) as AbilitySpec | undefined) ??
      (pool.byId.get(id) as AbilitySpec | undefined);
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

  // Catalogue + Strength Cape already applied in compiled context
  // (allocation notes live in compileEvaluationContext).
  // Default detailLevel stays full-analysis when unset (standalone/tests/UI).
  // Solver session opts into score-only for search + ranking evals.
  const revInput: RevolutionInput = {
    ...simFields,
    abilities: compiled.catalogue as AbilitySpec[],
    abilityRegistry: {
      byId: compiled.byId,
      basicByStyle: compiled.basicByStyle,
    },
    bar: resolved,
    style,
    durationTicks,
  };
  const simOpts =
    request.detailLevel !== undefined ? { detailLevel: request.detailLevel } : undefined;

  let branchFidelity: BranchFidelityAttemptMeta | undefined;
  let summary;
  if (request.branchFidelityMode != null) {
    const ladder = resolveBranchFidelityLadder(
      request.branchFidelityMode,
      request.branchFidelityOverrides,
    );
    const adaptive = simulateWithAdaptiveBranchFidelity(revInput, simOpts, ladder);
    summary = adaptive.summary;
    branchFidelity = adaptive.meta;
  } else {
    summary = simulateRevolution(revInput, simOpts);
  }

  if (!summary.ok) {
    reasons.push({
      code: "sim-failed",
      message: summary.error ?? "revolution simulation failed",
    });
    return failEval(request, reasons, { resolved, summary, branchFidelity });
  }

  // Adaptive ladder exhausted without completeness: still unrankable (do not fabricate score).
  if (branchFidelity != null && !branchFidelity.complete) {
    const msg = `branch fidelity incomplete residualWeight=${branchFidelity.residualWeight} after ${branchFidelity.attempts} attempt(s) maxLive=${branchFidelity.finalBudget.maxLiveBranches}`;
    reasons.push({ code: "score-failed", message: msg });
    const diagnostics = diagnosticMetrics(summary);
    return failEval(request, reasons, {
      mode: durationTicks < MIN_RANKABLE_HORIZON_TICKS ? "search" : "full",
      exploratory: durationTicks < MIN_RANKABLE_HORIZON_TICKS,
      validForFinalRanking: false,
      resolved,
      summary,
      failureReason: msg,
      branchFidelity,
      metrics:
        Object.keys(diagnostics).length > 0
          ? {
              dpm: Number.NEGATIVE_INFINITY,
              totalExpected: summary.totalExpected,
              ...diagnostics,
            }
          : undefined,
    });
  }

  // Short horizon: exploratory single-window DPM only when unit-mass eligible.
  // Conditional concrete mean (totalExpected with residual) must not rank.
  if (durationTicks < MIN_RANKABLE_HORIZON_TICKS) {
    const ineligible = summaryObjectiveIneligibilityReason(summary);
    if (ineligible !== null) {
      reasons.push({
        code: "score-failed",
        message: ineligible,
      });
      const diagnostics = diagnosticMetrics(summary);
      return failEval(request, reasons, {
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
        resolved,
        summary,
        failureReason: ineligible,
        branchFidelity,
        // Diagnostics only: known-mass / conditional mean never become score.
        metrics:
          Object.keys(diagnostics).length > 0
            ? {
                dpm: Number.NEGATIVE_INFINITY,
                totalExpected: summary.totalExpected,
                ...diagnostics,
              }
            : undefined,
      });
    }
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
        ...diagnosticMetrics(summary),
      },
      profileId,
      branchFidelity,
    };
  }

  const scored = scoreSummary(summary, profileId, customWeights);
  if (!scored.ok) {
    // Sim succeeded but robust scoring failed - keep failure visible.
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
      branchFidelity,
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
      ...diagnosticMetrics(summary),
    },
    profileId,
    branchFidelity,
  };
}
