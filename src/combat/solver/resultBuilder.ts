/** Final SolverResultDTO construction from a completed SolveResult. */
import type { SolveResult } from "./contracts";
import type { SerializableSolverRequest, SolverResultDTO } from "./worker/serializable";
import type { SolveRuntimeOptions } from "./worker/solveTypes";
import { BIG_BONED_OUTGOING_ASSUMPTIONS } from "../league/ruleset";

export function buildSolverResultDto(args: {
  request: SerializableSolverRequest;
  result: SolveResult;
  poolSize: number;
  uniqueBars: number;
  fullTicks: number;
  evaluationBudget: number;
  blessingIds: readonly string[];
  options?: SolveRuntimeOptions;
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
  } = args;

  const hasBigBoned = blessingIds.includes("big-boned");
  const bigBonedAssumptions = hasBigBoned ? [...BIG_BONED_OUTGOING_ASSUMPTIONS] : undefined;
  const bigBonedNotes = hasBigBoned ? ([...BIG_BONED_OUTGOING_ASSUMPTIONS] as const) : [];

  // No fabricated empty-bar / zero-score "success" DTO.
  if (result.status === "failed" || result.best == null) {
    throw new Error(
      [
        "solver failed: no valid candidate",
        `proof=${result.proof}`,
        `searchEvaluations=${result.searchEvaluations}`,
        `fullEvaluations=${result.fullEvaluations}`,
        `bestExploratory=${result.bestExploratoryScore}`,
        `bestFull=${result.bestFullScore}`,
      ].join("; "),
    );
  }

  const winner = result.best;
  const winnerBar = [...winner.bar];
  const fullWinner = winner.validForFinalRanking === true && winner.mode === "full";
  const score = Number.isFinite(winner.robustScore) ? winner.robustScore : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(score)) {
    throw new Error(`solver failed: non-finite winner score (proof=${result.proof})`);
  }

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

  const dto: SolverResultDTO = {
    bar: winnerBar,
    score,
    // Required DTO field: 0 when no honest window aggregate (do not stuff score).
    windowDpms: 0,
    evaluations: result.totalEvaluations,
    uniqueCandidates: uniqueBars || result.stats.uniqueBars || result.totalEvaluations,
    seed: request.seed,
    profileId: request.profileId,
    tier: request.tier,
    durationTicks: fullTicks,
    proofLabel: result.proof,
    ...(exploratoryOut != null ? { bestExploratoryScore: exploratoryOut } : {}),
    ...(fullOut != null ? { bestFullScore: fullOut } : {}),
    openingDpm: hasRealWindows ? winner.openingDpm : undefined,
    developedDpm: hasRealWindows ? winner.developedDpm : undefined,
    steadyDpm: hasRealWindows ? winner.steadyDpm : undefined,
    assumptions: bigBonedAssumptions,
    // summary left unset unless an independent sim is run - never fabricate.
    proof: {
      label: result.proof,
      // recheckScore omitted - a copy of the chosen score is not a recheck.
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
