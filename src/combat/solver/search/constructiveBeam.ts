import type { ScoredBar } from "../contracts";
import { remainingCandidates } from "../eligibility";
import { barDistance, diverseSelect } from "../diversity";
import { compareScored, insertAt, type SearchState } from "./types";
import { maybeYield, type YieldCtx } from "./yield";

/**
 * Constructive beam: grow bars left-to-right.
 * Default: append each remaining ability (priority order).
 * Wider: also try insert at every position when config.beamInsertAllPositions.
 */
function partialBar(state: SearchState, bar: readonly string[]): ScoredBar {
  const profileId = state.config.profileId ?? "balanced";
  return {
    bar: [...bar],
    fingerprint: bar.join("\0"),
    robustScore: Number.NEGATIVE_INFINITY,
    minDpm: 0,
    weightedMean: 0,
    profileId,
    mode: "search",
    objectiveType: profileId,
    horizonTicks: state.config.searchHorizonTicks ?? 50,
    exploratory: true,
    validForFinalRanking: false,
    openingDpm: 0,
    developedDpm: 0,
    steadyDpm: 0,
  };
}

export function runConstructiveBeam(state: SearchState): void {
  // Sync path: no yieldCtx → no await → body completes before returning.
  void runBeamBody(state, null);
}

export async function runConstructiveBeamAsync(
  state: SearchState,
  yieldCtx?: YieldCtx,
): Promise<void> {
  await runBeamBody(state, yieldCtx ?? null);
}

async function runBeamBody(state: SearchState, yieldCtx: YieldCtx | null): Promise<void> {
  const { beamWidth, beamInsertAllPositions } = state.config;
  let beam: ScoredBar[] = [];

  for (const a of state.pool) {
    if (!state.canEval() && state.sizeBounds.min > 1) break;
    if (state.sizeBounds.min <= 1) {
      if (!state.canEval()) break;
      const scored = state.tryEval([a.id], "search", "beam");
      if (scored && Number.isFinite(scored.robustScore)) beam.push(scored);
      if (yieldCtx) await maybeYield(state, yieldCtx);
    } else {
      beam.push(partialBar(state, [a.id]));
    }
  }

  beam = keepBeam(beam, beamWidth);

  while (state.canEval()) {
    const children: ScoredBar[] = [];
    let grew = false;

    for (const parent of beam) {
      if (!state.canEval()) break;
      if (parent.bar.length >= state.sizeBounds.max) {
        children.push(parent);
        continue;
      }
      const remain = remainingCandidates(parent.bar, state.pool, state.byId);
      for (const a of remain) {
        if (!state.canEval()) break;
        const positions = beamInsertAllPositions
          ? range(0, parent.bar.length + 1)
          : [parent.bar.length];
        for (const pos of positions) {
          if (!state.canEval()) break;
          const next = insertAt(parent.bar, pos, a.id);
          if (next.length < state.sizeBounds.min) {
            children.push(partialBar(state, next));
            grew = true;
            continue;
          }
          const scored = state.tryEval(next, "search", "beam");
          if (scored && Number.isFinite(scored.robustScore)) {
            children.push(scored);
            grew = true;
          }
          if (yieldCtx) await maybeYield(state, yieldCtx);
        }
      }
      if (parent.bar.length >= state.sizeBounds.min) children.push(parent);
    }

    if (!grew && children.length === 0) break;
    const nextBeam = keepBeam(children, beamWidth);
    if (sameFingerprints(beam, nextBeam)) break;
    beam = nextBeam;
    if (beam.every((b) => b.bar.length >= state.sizeBounds.max)) break;
  }
}

function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = lo; i < hi; i++) out.push(i);
  return out;
}

function keepBeam(items: ScoredBar[], width: number): ScoredBar[] {
  const finite = items.filter((s) => Number.isFinite(s.robustScore));
  const partials = items.filter((s) => !Number.isFinite(s.robustScore));
  // Scored finite first: compareScored + diverseSelect — never reorder that tier.
  finite.sort(compareScored);
  const diverse = diverseSelect(finite, width);
  const seen = new Set(diverse.map((d) => d.fingerprint));
  // Unscored partials: longer depth + barDistance so high ladder ceilings stay diverse.
  for (const p of pickDiversePartials(partials, width - diverse.length, seen)) {
    diverse.push(p);
    seen.add(p.fingerprint);
  }
  for (const f of finite) {
    if (diverse.length >= width) break;
    if (seen.has(f.fingerprint)) continue;
    seen.add(f.fingerprint);
    diverse.push(f);
  }
  return diverse.slice(0, width);
}

/** Greedy partial beam: max length, then max min barDistance to selected. */
function pickDiversePartials(
  partials: readonly ScoredBar[],
  k: number,
  seen: ReadonlySet<string>,
): ScoredBar[] {
  if (k <= 0 || partials.length === 0) return [];
  const unique: ScoredBar[] = [];
  const fps = new Set<string>();
  for (const p of partials) {
    if (seen.has(p.fingerprint) || fps.has(p.fingerprint)) continue;
    fps.add(p.fingerprint);
    unique.push(p);
  }
  if (unique.length === 0) return [];
  unique.sort((a, b) => {
    if (b.bar.length !== a.bar.length) return b.bar.length - a.bar.length;
    return a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0;
  });
  if (unique.length <= k) return unique;

  const selected: ScoredBar[] = [unique[0]!];
  const remaining = unique.slice(1);
  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestMetric = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]!;
      let minDist = Infinity;
      for (const s of selected) {
        minDist = Math.min(minDist, barDistance(c.bar, s.bar));
      }
      // Length dominates (~[0,1] distance); stable fingerprint tie-break.
      const metric = c.bar.length * 2 + minDist;
      if (metric > bestMetric) {
        bestMetric = metric;
        bestIdx = i;
      } else if (metric === bestMetric) {
        const best = remaining[bestIdx]!;
        if (c.fingerprint < best.fingerprint) bestIdx = i;
      }
    }
    const [pick] = remaining.splice(bestIdx, 1);
    selected.push(pick!);
  }
  return selected;
}

function fingerprintSetKey(bars: readonly ScoredBar[]): string {
  return bars
    .map((x) => x.fingerprint)
    .sort()
    .join("|");
}

function sameFingerprints(a: ScoredBar[], b: ScoredBar[]): boolean {
  return a.length === b.length && fingerprintSetKey(a) === fingerprintSetKey(b);
}
