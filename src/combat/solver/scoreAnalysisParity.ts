/**
 * Score-only vs full-analysis ranking-metric parity.
 * Production gate rejects bars where the two detail levels disagree past tol.
 */
import type { RevolutionBarEvaluation } from "./contracts";

export const SCORE_ANALYSIS_PARITY_TOLERANCE = 1e-9;

export interface ScoreAnalysisParitySnapshot {
  ok: boolean;
  validForFinalRanking: boolean;
  mode: string;
  score: number;
  totalExpected: number;
  openingDpm: number | null;
  developedDpm: number | null;
  steadyDpm: number | null;
  residualWeight: number;
  /** rng.concreteMass ?? probabilityMass; 0 when absent. */
  concreteMass: number;
  /** Tick ledger; missing keys treated as 0 in compare. */
  damageByTick: Record<number, number>;
  exactness: string | null;
}

export interface ScoreAnalysisParityMismatch {
  field: string;
  scoreOnly: string | number | boolean | null;
  fullAnalysis: string | number | boolean | null;
  delta?: number;
}

export interface ScoreAnalysisParityCompareResult {
  pass: boolean;
  mismatches: ScoreAnalysisParityMismatch[];
}

function finiteOrNeg(n: number | null | undefined): number {
  return n != null && Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function exactnessString(
  v: string | { toString(): string } | null | undefined,
): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

/**
 * Ranking surface for parity. Null when evaluation has no usable score spine.
 */
export function snapshotFromEvaluation(
  evaluation: RevolutionBarEvaluation | null | undefined,
): ScoreAnalysisParitySnapshot | null {
  if (!evaluation) return null;
  const summary = evaluation.summary;
  if (!summary && !evaluation.ok) return null;

  const objectiveOk =
    evaluation.objective && evaluation.objective.ok === true
      ? evaluation.objective
      : null;
  const metrics = evaluation.metrics;

  const rng = summary?.rng;
  const concreteRaw = rng?.concreteMass ?? rng?.probabilityMass;
  const damageByTick: Record<number, number> = {};
  const rawTicks = summary?.damageByTick;
  if (rawTicks) {
    for (const [k, v] of Object.entries(rawTicks)) {
      const tick = Number(k);
      if (Number.isFinite(tick) && typeof v === "number" && Number.isFinite(v)) {
        damageByTick[tick] = v;
      }
    }
  }

  return {
    ok: evaluation.ok === true,
    validForFinalRanking: evaluation.validForFinalRanking === true,
    mode: evaluation.mode,
    score: finiteOrNeg(evaluation.score),
    totalExpected: finiteOrNeg(summary?.totalExpected ?? metrics?.totalExpected),
    openingDpm: finiteOrNull(metrics?.openingDpm ?? objectiveOk?.openingDpm),
    developedDpm: finiteOrNull(metrics?.developedDpm ?? objectiveOk?.developedDpm),
    steadyDpm: finiteOrNull(metrics?.steadyDpm ?? objectiveOk?.steadyDpm),
    residualWeight: rng?.residualWeight ?? 0,
    concreteMass: typeof concreteRaw === "number" && Number.isFinite(concreteRaw) ? concreteRaw : 0,
    damageByTick,
    exactness: exactnessString(rng?.exactness),
  };
}

function finiteOrNull(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) ? n : null;
}

function pushNumericMismatch(
  mismatches: ScoreAnalysisParityMismatch[],
  field: string,
  a: number,
  b: number,
  tol: number,
): void {
  const delta = a - b;
  if (!Number.isFinite(a) && !Number.isFinite(b)) return;
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(delta) > tol) {
    mismatches.push({ field, scoreOnly: a, fullAnalysis: b, delta });
  }
}

function pushNullableNumericMismatch(
  mismatches: ScoreAnalysisParityMismatch[],
  field: string,
  a: number | null,
  b: number | null,
  tol: number,
): void {
  if (a == null && b == null) return;
  if (a == null || b == null) {
    mismatches.push({ field, scoreOnly: a, fullAnalysis: b });
    return;
  }
  pushNumericMismatch(mismatches, field, a, b, tol);
}

/**
 * Compare ranking metrics of score-only vs full-analysis snapshots.
 */
export function compareScoreAnalysisParity(
  scoreOnly: ScoreAnalysisParitySnapshot | null | undefined,
  fullAnalysis: ScoreAnalysisParitySnapshot | null | undefined,
  tol: number = SCORE_ANALYSIS_PARITY_TOLERANCE,
): ScoreAnalysisParityCompareResult {
  const mismatches: ScoreAnalysisParityMismatch[] = [];
  if (!scoreOnly || !fullAnalysis) {
    mismatches.push({
      field: "snapshot",
      scoreOnly: scoreOnly ? "present" : null,
      fullAnalysis: fullAnalysis ? "present" : null,
    });
    return { pass: false, mismatches };
  }

  if (scoreOnly.ok !== fullAnalysis.ok) {
    mismatches.push({
      field: "ok",
      scoreOnly: scoreOnly.ok,
      fullAnalysis: fullAnalysis.ok,
    });
  }
  if (scoreOnly.validForFinalRanking !== fullAnalysis.validForFinalRanking) {
    mismatches.push({
      field: "validForFinalRanking",
      scoreOnly: scoreOnly.validForFinalRanking,
      fullAnalysis: fullAnalysis.validForFinalRanking,
    });
  }
  if (scoreOnly.mode !== fullAnalysis.mode) {
    mismatches.push({
      field: "mode",
      scoreOnly: scoreOnly.mode,
      fullAnalysis: fullAnalysis.mode,
    });
  }
  if (scoreOnly.exactness !== fullAnalysis.exactness) {
    mismatches.push({
      field: "exactness",
      scoreOnly: scoreOnly.exactness,
      fullAnalysis: fullAnalysis.exactness,
    });
  }

  pushNumericMismatch(mismatches, "score", scoreOnly.score, fullAnalysis.score, tol);
  pushNumericMismatch(
    mismatches,
    "totalExpected",
    scoreOnly.totalExpected,
    fullAnalysis.totalExpected,
    tol,
  );
  pushNumericMismatch(
    mismatches,
    "residualWeight",
    scoreOnly.residualWeight,
    fullAnalysis.residualWeight,
    tol,
  );
  pushNumericMismatch(
    mismatches,
    "concreteMass",
    scoreOnly.concreteMass,
    fullAnalysis.concreteMass,
    tol,
  );

  const tickKeys = new Set([
    ...Object.keys(scoreOnly.damageByTick),
    ...Object.keys(fullAnalysis.damageByTick),
  ]);
  for (const key of tickKeys) {
    const tick = Number(key);
    const a = scoreOnly.damageByTick[tick] ?? 0;
    const b = fullAnalysis.damageByTick[tick] ?? 0;
    pushNumericMismatch(mismatches, `damageByTick[${tick}]`, a, b, tol);
  }

  pushNullableNumericMismatch(
    mismatches,
    "openingDpm",
    scoreOnly.openingDpm,
    fullAnalysis.openingDpm,
    tol,
  );
  pushNullableNumericMismatch(
    mismatches,
    "developedDpm",
    scoreOnly.developedDpm,
    fullAnalysis.developedDpm,
    tol,
  );
  pushNullableNumericMismatch(
    mismatches,
    "steadyDpm",
    scoreOnly.steadyDpm,
    fullAnalysis.steadyDpm,
    tol,
  );

  return { pass: mismatches.length === 0, mismatches };
}

export function parityFailureMessage(
  mismatches: readonly ScoreAnalysisParityMismatch[],
): string {
  if (mismatches.length === 0) return "score-analysis parity failed";
  const parts = mismatches.map((m) => {
    if (m.delta !== undefined && Number.isFinite(m.delta)) {
      return `${m.field} delta=${m.delta}`;
    }
    return `${m.field} scoreOnly=${String(m.scoreOnly)} full=${String(m.fullAnalysis)}`;
  });
  return `score-analysis parity failed: ${parts.join("; ")}`;
}
