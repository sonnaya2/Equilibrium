/**
 * Production hard gate: re-sim top + incumbent score-only vs full-analysis;
 * re-select winner only among parity-validated bars.
 */
import type { RevolutionBarEvaluation, ScoredBar, SolveResult } from "./contracts";
import {
  barsEqual,
  candidateBeatsIncumbent,
  finiteFullScore,
  scoreImprovementAbsolute,
  scoreImprovementPercent,
} from "./incumbentCompare";
import { barKey } from "./fingerprint";
import {
  evaluateRevolutionBar,
  winnerPresentationFromEvaluation,
  type RevolutionEvalRequestWithSession,
  type WinnerPresentation,
} from "./evaluate";
import {
  compareScoreAnalysisParity,
  parityFailureMessage,
  snapshotFromEvaluation,
  type ScoreAnalysisParityMismatch,
} from "./scoreAnalysisParity";

export interface ParityGateCandidate {
  bar: readonly string[];
  fingerprint: string;
  /** Score-only ranking score from the gate re-sim (preferred for DTO). */
  rankingScore: number;
  openingDpm: number;
  developedDpm: number;
  steadyDpm: number;
  presentation: WinnerPresentation;
  /** Prior shortlist score when known (diagnostics only). */
  priorRobustScore?: number;
}

export interface ParityGateReject {
  bar: readonly string[];
  fingerprint: string;
  reason: string;
  mismatches?: ScoreAnalysisParityMismatch[];
}

export interface ParityGateInput {
  result: SolveResult;
  evalBase: Omit<RevolutionEvalRequestWithSession, "bar" | "detailLevel" | "durationTicks">;
  fullTicks: number;
  scoreOnlyEvaluations?: ReadonlyMap<string, RevolutionBarEvaluation>;
  isCancelled?: () => boolean;
  yieldSlice?: () => Promise<void>;
  onProgress?: (info: {
    done: number;
    total: number;
    label: string;
    bar?: readonly string[];
  }) => void;
}

export interface ParityGateOutput {
  result: SolveResult;
  presentation: WinnerPresentation | null;
  validated: ParityGateCandidate[];
  rejected: ParityGateReject[];
  parityRejectCount: number;
}

function throwCancelled(): never {
  const err = new Error("solver cancelled");
  err.name = "AbortError";
  throw err;
}

function isFullRankable(s: ScoredBar | null | undefined): s is ScoredBar {
  return Boolean(
    s &&
    s.mode === "full" &&
    s.validForFinalRanking &&
    Number.isFinite(s.robustScore) &&
    s.bar.length > 0,
  );
}

/**
 * Unique bars in robustScore desc: result.top (full rankable) then incumbent if missing.
 */
export function collectParityGateBars(result: SolveResult): ScoredBar[] {
  const byFp = new Map<string, ScoredBar>();
  const ordered: ScoredBar[] = [];

  const add = (s: ScoredBar | null | undefined) => {
    if (!s || s.bar.length === 0) return;
    const fp = s.fingerprint || barKey(s.bar);
    if (byFp.has(fp)) return;
    byFp.set(fp, s);
    ordered.push(s);
  };

  const topRankable = result.top.filter(isFullRankable).slice();
  topRankable.sort((a, b) => b.robustScore - a.robustScore);
  for (const t of topRankable) add(t);

  if (result.incumbentBar?.length) {
    const incFp = barKey(result.incumbentBar);
    if (!byFp.has(incFp)) {
      const fromTop = result.top.find((t) => barKey(t.bar) === incFp);
      if (fromTop) {
        add(fromTop);
      } else if (result.best && barKey(result.best.bar) === incFp) {
        add(result.best);
      } else {
        // Stub so gate still re-sims incumbent even when not in top.
        add({
          bar: [...result.incumbentBar],
          fingerprint: incFp,
          robustScore: finiteFullScore(result.incumbentScore),
          profileId: result.best?.profileId ?? "balanced",
          mode: "full",
          objectiveType: result.best?.objectiveType ?? "balanced",
          horizonTicks: result.best?.horizonTicks ?? 0,
          exploratory: false,
          validForFinalRanking: Number.isFinite(result.incumbentScore),
          minDpm: finiteFullScore(result.incumbentScore),
          weightedMean: finiteFullScore(result.incumbentScore),
          openingDpm: finiteFullScore(result.incumbentScore),
          developedDpm: finiteFullScore(result.incumbentScore),
          steadyDpm: finiteFullScore(result.incumbentScore),
        });
      }
    }
  }

  if (result.best && isFullRankable(result.best)) {
    add(result.best);
  }

  ordered.sort((a, b) => b.robustScore - a.robustScore);
  return ordered;
}

function scoredFromValidated(
  v: ParityGateCandidate,
  profileId: ScoredBar["profileId"],
  horizonTicks: number,
): ScoredBar {
  return {
    bar: [...v.bar],
    fingerprint: v.fingerprint,
    robustScore: v.rankingScore,
    profileId,
    mode: "full",
    objectiveType: profileId,
    horizonTicks,
    exploratory: false,
    validForFinalRanking: true,
    minDpm: Math.min(v.openingDpm, v.developedDpm, v.steadyDpm),
    weightedMean: v.rankingScore,
    openingDpm: v.openingDpm,
    developedDpm: v.developedDpm,
    steadyDpm: v.steadyDpm,
  };
}

/**
 * Re-select best / upgrade flags among parity-validated candidates (Phase 5 rules).
 */
export function selectAfterParity(args: {
  validated: readonly ParityGateCandidate[];
  incumbentBar: readonly string[] | null;
  prior: SolveResult;
}): {
  best: ScoredBar | null;
  isUpgrade: boolean;
  validForApply: boolean;
  status: SolveResult["status"];
  top: ScoredBar[];
  incumbentScore: number;
  scoreImprovement: number;
  percentImprovement: number | null;
  validFullCandidateCount: number;
  bestFullScore: number;
  proof: SolveResult["proof"];
} {
  const { validated, incumbentBar, prior } = args;
  const profileId = prior.best?.profileId ?? "balanced";
  const horizonTicks = prior.best?.horizonTicks ?? 0;

  const scored = validated
    .map((v) => scoredFromValidated(v, profileId, horizonTicks))
    .sort((a, b) => b.robustScore - a.robustScore);

  const incumbentValidated =
    incumbentBar?.length && scored.length > 0
      ? (scored.find((s) => barsEqual(s.bar, incumbentBar)) ?? null)
      : null;
  const incumbentScore = incumbentValidated
    ? incumbentValidated.robustScore
    : Number.NEGATIVE_INFINITY;

  // Proposed: best validated that is not the incumbent bar when both exist.
  // Rank by score; when top is incumbent, next-best is proposed for beat check.
  let proposed: ScoredBar | null = scored[0] ?? null;
  if (
    proposed &&
    incumbentValidated &&
    barsEqual(proposed.bar, incumbentBar) &&
    scored.length > 1
  ) {
    // Keep proposed as overall best for beat check: candidateBeatsIncumbent
    // requires different bar, so if top is incumbent, proposed for upgrade is next.
    const next = scored.find((s) => !barsEqual(s.bar, incumbentBar));
    if (next) proposed = next;
    else proposed = null;
  } else if (proposed && incumbentValidated && barsEqual(proposed.bar, incumbentBar)) {
    proposed = null;
  }

  let best: ScoredBar | null = null;
  let status: SolveResult["status"] = "failed";
  let isUpgrade = false;
  let validForApply = false;

  const proposedBeats =
    proposed != null &&
    candidateBeatsIncumbent(proposed.robustScore, incumbentScore) &&
    !barsEqual(proposed.bar, incumbentBar);

  if (proposedBeats && proposed) {
    best = proposed;
    status = "ok";
    isUpgrade = true;
    validForApply = true;
  } else if (incumbentValidated) {
    best = incumbentValidated;
    status = "ok";
    isUpgrade = false;
    validForApply = false;
  } else if (proposed != null) {
    best = proposed;
    status = "ok";
    isUpgrade = true;
    validForApply = true;
  } else if (scored[0]) {
    // Only incumbent-equivalent single bar already handled; leftover sole bar.
    best = scored[0];
    status = "ok";
    isUpgrade = !incumbentBar?.length || !barsEqual(best.bar, incumbentBar);
    validForApply = isUpgrade;
  }

  const winnerScore = best ? best.robustScore : Number.NEGATIVE_INFINITY;
  const scoreImprovement = scoreImprovementAbsolute(winnerScore, incumbentScore, isUpgrade);
  const percentImprovement = scoreImprovementPercent(winnerScore, incumbentScore, isUpgrade);

  const top = scored.map((s) => ({ ...s, bar: [...s.bar] }));
  const bestFullScore = scored[0]?.robustScore ?? Number.NEGATIVE_INFINITY;

  const proof: SolveResult["proof"] =
    status === "failed"
      ? "failed"
      : prior.proof === "failed"
        ? "heuristic-best-found"
        : prior.proof;

  return {
    best: best ? { ...best, bar: [...best.bar] } : null,
    isUpgrade,
    validForApply,
    status,
    top,
    incumbentScore: finiteFullScore(incumbentScore),
    scoreImprovement,
    percentImprovement,
    validFullCandidateCount: scored.length,
    bestFullScore: Number.isFinite(bestFullScore) ? bestFullScore : Number.NEGATIVE_INFINITY,
    proof,
  };
}

/**
 * Hard parity gate after score-only search finalize.
 */
export async function runScoreAnalysisParityGate(
  input: ParityGateInput,
): Promise<ParityGateOutput> {
  const { result, evalBase, fullTicks } = input;
  const candidates = collectParityGateBars(result);
  const validated: ParityGateCandidate[] = [];
  const rejected: ParityGateReject[] = [];
  const total = candidates.length;

  for (let i = 0; i < candidates.length; i++) {
    if (input.isCancelled?.()) throwCancelled();
    const cand = candidates[i]!;
    const bar = [...cand.bar];
    const fp = cand.fingerprint || barKey(bar);
    const incumbentBaseline = result.incumbentBar != null && barsEqual(bar, result.incumbentBar);
    const label = `parity ${i + 1}/${total}`;
    input.onProgress?.({ done: i, total, label, bar });

    const candidateEvalBase = incumbentBaseline
      ? {
          ...evalBase,
          includePartial: true,
          size: { min: bar.length, max: Math.max(1, bar.length) },
          incumbentBaseline: true,
        }
      : evalBase;

    // Same fixed lanes as finalize ranking; only detailLevel differs.
    const scoreOnlyEval =
      input.scoreOnlyEvaluations?.get(fp) ??
      evaluateRevolutionBar({
        ...candidateEvalBase,
        bar,
        durationTicks: fullTicks,
        detailLevel: "score-only",
      });

    if (!scoreOnlyEval.ok || !scoreOnlyEval.validForFinalRanking) {
      rejected.push({
        bar,
        fingerprint: fp,
        reason:
          scoreOnlyEval.failureReason ??
          scoreOnlyEval.reasons[0]?.message ??
          "score-only eval not rankable",
      });
      if (input.yieldSlice) await input.yieldSlice();
      continue;
    }

    if (input.isCancelled?.()) throwCancelled();

    const fullEval = evaluateRevolutionBar({
      ...candidateEvalBase,
      bar,
      durationTicks: fullTicks,
      detailLevel: "full-analysis",
    });

    const scoreSnap = snapshotFromEvaluation(scoreOnlyEval);
    const fullSnap = snapshotFromEvaluation(fullEval);
    const cmp = compareScoreAnalysisParity(scoreSnap, fullSnap);

    if (!cmp.pass) {
      rejected.push({
        bar,
        fingerprint: fp,
        reason: parityFailureMessage(cmp.mismatches),
        mismatches: cmp.mismatches,
      });
      if (input.yieldSlice) await input.yieldSlice();
      continue;
    }

    const presentation = winnerPresentationFromEvaluation(fullEval);
    if (!presentation || !fullEval.ok || !fullEval.validForFinalRanking) {
      rejected.push({
        bar,
        fingerprint: fp,
        reason: "full-analysis eval not usable for presentation",
      });
      if (input.yieldSlice) await input.yieldSlice();
      continue;
    }

    const opening =
      scoreOnlyEval.metrics?.openingDpm ??
      (scoreOnlyEval.objective?.ok ? scoreOnlyEval.objective.openingDpm : scoreOnlyEval.score);
    const developed =
      scoreOnlyEval.metrics?.developedDpm ??
      (scoreOnlyEval.objective?.ok ? scoreOnlyEval.objective.developedDpm : scoreOnlyEval.score);
    const steady =
      scoreOnlyEval.metrics?.steadyDpm ??
      (scoreOnlyEval.objective?.ok ? scoreOnlyEval.objective.steadyDpm : scoreOnlyEval.score);

    validated.push({
      bar,
      fingerprint: fp,
      rankingScore: scoreOnlyEval.score,
      openingDpm: opening,
      developedDpm: developed,
      steadyDpm: steady,
      presentation,
      priorRobustScore: cand.robustScore,
    });

    input.onProgress?.({ done: i + 1, total, label, bar });
    if (input.yieldSlice) await input.yieldSlice();
  }

  const selected = selectAfterParity({
    validated,
    incumbentBar: result.incumbentBar,
    prior: result,
  });

  const next: SolveResult = {
    ...result,
    status: selected.status,
    best: selected.best,
    top: selected.top,
    proof: selected.proof,
    validFullCandidateCount: selected.validFullCandidateCount,
    bestFullScore: selected.bestFullScore,
    incumbentScore: selected.incumbentScore,
    isUpgrade: selected.isUpgrade,
    scoreImprovement: selected.scoreImprovement,
    percentImprovement: selected.percentImprovement,
    validForApply: selected.validForApply,
  };

  let presentation: WinnerPresentation | null = null;
  if (selected.best) {
    const win = validated.find((v) => v.fingerprint === selected.best!.fingerprint);
    presentation = win?.presentation ?? null;
  }

  return {
    result: next,
    presentation,
    validated,
    rejected,
    parityRejectCount: rejected.length,
  };
}
