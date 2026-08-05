/** Final SolverResultDTO construction from a completed SolveResult. */
import type { SolveResult } from "./contracts";
import { solveIdentityFromRequest } from "./identity";
import {
  CURRENT_BAR_REMAINS_BEST_NOTE,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./worker/serializable";
import type { SolveRuntimeOptions } from "./worker/solveTypes";
import { BIG_BONED_OUTGOING_ASSUMPTIONS } from "../league/ruleset";
import type { WinnerPresentation } from "./evaluate";
import { SCORE_ANALYSIS_PARITY_TOLERANCE } from "./scoreAnalysisParity";

export function buildSolverResultDto(args: {
  request: SerializableSolverRequest;
  result: SolveResult;
  poolSize: number;
  uniqueBars: number;
  fullTicks: number;
  evaluationBudget: number;
  blessingIds: readonly string[];
  options?: SolveRuntimeOptions;
  /**
   * Full-analysis re-sim of the winner after score-analysis parity gate.
   * Ranking score stays on result.best; presentation fills summary / recheck.
   */
  presentation?: WinnerPresentation | null;
  /** Bars rejected by score-only vs full-analysis parity (proof note). */
  parityRejectCount?: number;
}): SolverResultDTO {
  const {
    request,
    result,
    poolSize,
    uniqueBars,
    fullTicks,
    evaluationBudget,
    blessingIds,
    options,
    presentation,
    parityRejectCount = 0,
  } = args;

  const hasBigBoned = blessingIds.includes("big-boned");
  const bigBonedAssumptions = hasBigBoned ? [...BIG_BONED_OUTGOING_ASSUMPTIONS] : undefined;
  const bigBonedNotes = hasBigBoned ? ([...BIG_BONED_OUTGOING_ASSUMPTIONS] as const) : [];

  // Full-horizon validated bar required (Phase 4). Phase 5 may keep incumbent best.
  const winner = result.best;
  const validated =
    result.status === "ok" &&
    winner != null &&
    winner.validForFinalRanking === true &&
    winner.mode === "full" &&
    winner.bar.length > 0 &&
    result.validFullCandidateCount > 0 &&
    Number.isFinite(winner.robustScore);

  if (!validated || winner == null) {
    throw new Error(
      [
        "solver failed: no validated full-horizon upgrade",
        `status=${result.status}`,
        `proof=${result.proof}`,
        `searchEvaluations=${result.searchEvaluations}`,
        `fullEvaluations=${result.fullEvaluations}`,
        `validFullCandidates=${result.validFullCandidateCount}`,
        `bestExploratory=${result.bestExploratoryScore}`,
        `bestFull=${result.bestFullScore}`,
      ].join("; "),
    );
  }

  // Rely on finalize flags: never claim upgrade when proposed score is not above incumbent.
  const isUpgrade = result.isUpgrade === true;
  const validForApply = result.validForApply === true && isUpgrade;
  const scoreImprovement = isUpgrade ? (result.scoreImprovement ?? 0) : 0;
  const percentImprovement = isUpgrade ? (result.percentImprovement ?? null) : null;

  const winnerBar = [...winner.bar];
  const fullWinner = true;
  const score = winner.robustScore;

  const proofNotes = [
    `status=${result.status}`,
    `proof=${result.proof}`,
    result.exhaustiveCompleted
      ? "search-objective exhaustive completed (does not prove full-objective global optimum alone)"
      : "heuristic search",
    `pool size ${poolSize}`,
    `searchEvaluations ${result.searchEvaluations}/${result.searchBudget}`,
    `fullEvaluations ${result.fullEvaluations}`,
    `totalEvaluations ${result.totalEvaluations}`,
    `bestExploratory ${result.bestExploratoryScore}`,
    `bestFull ${result.bestFullScore}`,
    `validFullCandidates ${result.validFullCandidateCount}`,
    `seed best exploratory ${result.seedBestScore}`,
    ...bigBonedNotes,
  ];

  if (!isUpgrade) {
    proofNotes.push(CURRENT_BAR_REMAINS_BEST_NOTE);
  }

  if (presentation) {
    if (!Number.isFinite(presentation.recheckScore)) {
      throw new Error(
        "solver failed: score-analysis parity; presentation recheckScore not finite",
      );
    }
    const delta = presentation.recheckScore - score;
    if (Math.abs(delta) > SCORE_ANALYSIS_PARITY_TOLERANCE) {
      throw new Error(
        [
          "solver failed: score-analysis parity",
          `rankingScore=${score}`,
          `recheckScore=${presentation.recheckScore}`,
          `delta=${delta}`,
          `tolerance=${SCORE_ANALYSIS_PARITY_TOLERANCE}`,
        ].join("; "),
      );
    }
    proofNotes.push("score-analysis parity ok");
    proofNotes.push("winner full-analysis presentation re-sim");
  }

  if (parityRejectCount > 0) {
    proofNotes.push(`score-analysis parity rejected ${parityRejectCount}`);
  }

  // Honest windows only - never copy robust score into windowDpms.
  // Full winners from production evaluate carry measured window DPMs (may be 0).
  const hasRealWindows =
    fullWinner &&
    !winner.exploratory &&
    Number.isFinite(winner.openingDpm) &&
    Number.isFinite(winner.developedDpm) &&
    Number.isFinite(winner.steadyDpm);

  const exploratoryOut = Number.isFinite(result.bestExploratoryScore)
    ? result.bestExploratoryScore
    : undefined;
  const fullOut = Number.isFinite(result.bestFullScore) ? result.bestFullScore : undefined;

  const baselineBar =
    result.incumbentBar != null && result.incumbentBar.length > 0
      ? [...result.incumbentBar]
      : result.incumbentBar ?? null;

  const dto: SolverResultDTO = {
    bar: winnerBar,
    // Ranking score from score-only finalize path (not rewritten by presentation).
    score,
    // Required DTO field: 0 when no honest window aggregate (do not stuff score).
    windowDpms: 0,
    evaluations: result.totalEvaluations,
    uniqueCandidates: uniqueBars || result.stats.uniqueBars || result.totalEvaluations,
    seed: request.seed,
    profileId: request.profileId,
    tier: request.tier,
    durationTicks: fullTicks,
    solveIdentity: solveIdentityFromRequest(request),
    proofLabel: result.proof,
    ...(exploratoryOut != null ? { bestExploratoryScore: exploratoryOut } : {}),
    ...(fullOut != null ? { bestFullScore: fullOut } : {}),
    openingDpm: hasRealWindows ? winner.openingDpm : undefined,
    developedDpm: hasRealWindows ? winner.developedDpm : undefined,
    steadyDpm: hasRealWindows ? winner.steadyDpm : undefined,
    assumptions: bigBonedAssumptions,
    baselineBar,
    baselineScore: result.incumbentScore,
    winnerScore: score,
    scoreImprovement,
    percentImprovement,
    isUpgrade,
    validForApply,
    ...(presentation?.summary ? { summary: presentation.summary } : {}),
    ...(presentation?.rng ? { rng: presentation.rng } : {}),
    proof: {
      label: result.proof,
      // Independent full-analysis re-sim score when presentation ran.
      ...(presentation && Number.isFinite(presentation.recheckScore)
        ? { recheckScore: presentation.recheckScore }
        : {}),
      notes: proofNotes,
    },
    top: result.top.map((t) => ({
      bar: [...t.bar],
      score: t.robustScore,
      fingerprint: t.fingerprint,
    })),
  };

  options?.onProgress?.({
    phase: "finalize",
    evaluations: result.totalEvaluations,
    uniqueCandidates: dto.uniqueCandidates,
    // Keep bestScore on exploratory scale for the whole run.
    bestScore: exploratoryOut ?? 0,
    ...(exploratoryOut != null ? { bestExploratoryScore: exploratoryOut } : {}),
    ...(fullOut != null ? { bestFullScore: fullOut } : {}),
    searchEvaluations: result.searchEvaluations,
    fullEvaluations: result.fullEvaluations,
    evaluationMode: "finalize",
    windowDpms: 0,
    topBarPreview: winnerBar,
    noImprovementCount: 0,
    evaluationBudget,
    progressRatio: 1,
    proof: {
      ...dto.proof,
      notes: [
        ...(dto.proof?.notes ?? []),
        `bestExploratory=${result.bestExploratoryScore}`,
        `bestFull=${result.bestFullScore}`,
      ],
    },
  });

  return dto;
}
