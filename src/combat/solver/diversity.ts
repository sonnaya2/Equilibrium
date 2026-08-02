import type { ScoredBar } from "./contracts";

/**
 * Bar distance: hybrid of Jaccard (set) and Kendall-tau-ish (pairwise order).
 * Range roughly [0, 1]; 0 = identical, 1 = maximally different.
 */
export function barDistance(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter += 1;
  const union = setA.size + setB.size - inter;
  const jaccard = union === 0 ? 0 : 1 - inter / union;

  const shared = a.filter((x) => setB.has(x));
  if (shared.length < 2) return jaccard;

  const posA = new Map(a.map((id, i) => [id, i]));
  const posB = new Map(b.map((id, i) => [id, i]));
  let pairs = 0;
  let discord = 0;
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      const u = shared[i]!;
      const v = shared[j]!;
      const da = Math.sign((posA.get(u) ?? 0) - (posA.get(v) ?? 0));
      const db = Math.sign((posB.get(u) ?? 0) - (posB.get(v) ?? 0));
      pairs += 1;
      if (da !== db) discord += 1;
    }
  }
  const kendall = pairs === 0 ? 0 : discord / pairs;
  return 0.65 * jaccard + 0.35 * kendall;
}

/**
 * Greedy diversity selection: take best, then repeatedly pick the candidate
 * that maximizes min-distance to the selected set among remaining high scorers.
 */
export function diverseSelect(candidates: readonly ScoredBar[], k: number): ScoredBar[] {
  if (k <= 0 || candidates.length === 0) return [];
  const sorted = [...candidates]
    .filter((c) => Number.isFinite(c.robustScore))
    .sort((a, b) => b.robustScore - a.robustScore);
  if (sorted.length === 0) return [];
  if (k === 1) return [{ ...sorted[0]!, bar: [...sorted[0]!.bar] }];

  const selected: ScoredBar[] = [{ ...sorted[0]!, bar: [...sorted[0]!.bar] }];
  const remaining = sorted.slice(1);

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestMetric = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]!;
      let minDist = Infinity;
      for (const s of selected) {
        minDist = Math.min(minDist, barDistance(c.bar, s.bar));
      }
      const scoreNorm = c.robustScore - sorted[sorted.length - 1]!.robustScore;
      const metric = minDist * 2 + scoreNorm * 1e-9;
      if (metric > bestMetric) {
        bestMetric = metric;
        bestIdx = i;
      }
    }
    const [pick] = remaining.splice(bestIdx, 1);
    selected.push({ ...pick!, bar: [...pick!.bar] });
  }
  return selected;
}
