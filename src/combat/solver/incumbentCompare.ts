/**
 * Phase 5: first-class current-bar (incumbent) comparison for finalize / DTO.
 * Candidate must clear incumbent full score by a fixed float tolerance.
 */
import { INCUMBENT_SCORE_TOLERANCE } from "./contracts";

export function finiteFullScore(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return Number.NEGATIVE_INFINITY;
  return score;
}

/** True when candidate full score strictly beats incumbent full score past tolerance. */
export function candidateBeatsIncumbent(
  candidateScore: number,
  incumbentScore: number,
  tolerance: number = INCUMBENT_SCORE_TOLERANCE,
): boolean {
  const c = finiteFullScore(candidateScore);
  if (c === Number.NEGATIVE_INFINITY) return false;
  const i = finiteFullScore(incumbentScore);
  // Unrankable / absent incumbent: any validated full candidate is an upgrade.
  if (i === Number.NEGATIVE_INFINITY) return true;
  return c > i + tolerance;
}

export function scoreImprovementAbsolute(
  winnerScore: number,
  incumbentScore: number,
  isUpgrade: boolean,
): number {
  if (!isUpgrade) return 0;
  const w = finiteFullScore(winnerScore);
  const i = finiteFullScore(incumbentScore);
  if (w === Number.NEGATIVE_INFINITY) return 0;
  if (i === Number.NEGATIVE_INFINITY) return w;
  return w - i;
}

export function scoreImprovementPercent(
  winnerScore: number,
  incumbentScore: number,
  isUpgrade: boolean,
): number | null {
  if (!isUpgrade) return null;
  const i = finiteFullScore(incumbentScore);
  if (i === Number.NEGATIVE_INFINITY || Math.abs(i) < INCUMBENT_SCORE_TOLERANCE) return null;
  const abs = scoreImprovementAbsolute(winnerScore, incumbentScore, true);
  return (100 * abs) / Math.abs(i);
}

export function barsEqual(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  if (!a?.length || !b?.length) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
