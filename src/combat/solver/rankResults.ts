/**
 * Pure ranking for SolverResultDTO merges — score first, never length-over-score.
 */

import type { ProofLabel } from "./contracts";
import type { SolverResultDTO } from "./worker/serializable";

/** Prefer honest final-ish proofs over degraded exploratory fallbacks. */
function proofRank(label: ProofLabel | undefined): number {
  switch (label) {
    case "full-objective-global-optimum":
      return 5;
    case "search-objective-exhaustive":
      return 4;
    case "full-shortlist-best":
      return 3;
    case "heuristic-best-found":
      return 2;
    case "degraded-exploratory-fallback":
      return 1;
    case "failed":
      return 0;
    default:
      return 2;
  }
}

/** True when the DTO can win a multi-agent merge. */
export function isRankableSolverResult(r: SolverResultDTO): boolean {
  if (!r.bar || r.bar.length === 0) return false;
  if (!Number.isFinite(r.score)) return false;
  if (r.proofLabel === "failed") return false;
  return true;
}

/**
 * Floating-point "effectively equal" — not a wide percent band.
 * Meaningful score gaps always rank higher score first.
 */
export function isEffectivelyEqualScore(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === b) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-12;
}

/**
 * Compare two solver DTOs for ranking.
 * Returns &lt;0 when `a` should rank above `b` (Array.sort ascending → reverse with sort((a,b)=>compare)).
 *
 * Priority:
 * 1. rankable / valid status
 * 2. higher proof quality
 * 3. higher final score (strict for non-equal scores)
 * 4. deterministic tie-break only when scores are effectively equal
 *
 * Never prefers a meaningfully lower score because the bar is longer.
 */
export function compareSolverResultDTO(a: SolverResultDTO, b: SolverResultDTO): number {
  const aOk = isRankableSolverResult(a);
  const bOk = isRankableSolverResult(b);
  if (aOk !== bOk) return aOk ? -1 : 1;

  const pr = proofRank(b.proofLabel) - proofRank(a.proofLabel);
  // Only use proof as a soft signal when scores are equal; score still dominates.
  const scoresEqual = isEffectivelyEqualScore(a.score, b.score);

  if (!scoresEqual) {
    // Higher score always wins — bar length must not override.
    return b.score > a.score ? 1 : -1;
  }

  if (pr !== 0) return pr > 0 ? 1 : -1;

  // Deterministic tie-breakers for effectively equal scores only.
  if (a.bar.length !== b.bar.length) {
    // Prefer longer bar only as a pure tie-break, never over score.
    return b.bar.length - a.bar.length;
  }
  const aFp = a.bar.join("\0");
  const bFp = b.bar.join("\0");
  if (aFp !== bFp) return aFp < bFp ? -1 : 1;
  if (a.seed !== b.seed) return a.seed - b.seed;
  return 0;
}

/** Pick the single best DTO from a non-empty list. */
export function pickBestSolverResult(results: readonly SolverResultDTO[]): SolverResultDTO {
  if (results.length === 0) {
    throw new Error("pickBestSolverResult: empty results");
  }
  let best = results[0]!;
  for (let i = 1; i < results.length; i++) {
    const r = results[i]!;
    if (compareSolverResultDTO(r, best) < 0) best = r;
  }
  return best;
}

/** Sort a top-list entry by score desc, then deterministic fingerprint. */
export function compareTopEntry(
  a: { score: number; bar: readonly string[]; fingerprint?: string },
  b: { score: number; bar: readonly string[]; fingerprint?: string },
): number {
  if (!isEffectivelyEqualScore(a.score, b.score)) {
    return b.score > a.score ? 1 : -1;
  }
  const af = a.fingerprint ?? a.bar.join("\0");
  const bf = b.fingerprint ?? b.bar.join("\0");
  if (af !== bf) return af < bf ? -1 : 1;
  if (a.bar.length !== b.bar.length) return b.bar.length - a.bar.length;
  return 0;
}
