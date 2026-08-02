import type { ScoredBar } from "../contracts";
import { remainingCandidates } from "../eligibility";
import { diverseSelect } from "../diversity";
import { compareScored, insertAt, type SearchState } from "./types";

/**
 * Constructive beam: grow bars left-to-right.
 * Default: append each remaining ability (priority order).
 * Wider: also try insert at every position when config.beamInsertAllPositions.
 */
function partialBar(state: SearchState, bar: readonly string[]): ScoredBar {
  return {
    bar: [...bar],
    fingerprint: bar.join("\0"),
    robustScore: Number.NEGATIVE_INFINITY,
    minDpm: 0,
    weightedMean: 0,
    profileId: state.config.profileId ?? "balanced",
    openingDpm: 0,
    developedDpm: 0,
    steadyDpm: 0,
  };
}

export function runConstructiveBeam(state: SearchState): void {
  const { beamWidth, beamInsertAllPositions } = state.config;
  let beam: ScoredBar[] = [];

  // Bootstrap: length-1 partials when minSlots > 1 (tryEval rejects undersized bars).
  for (const a of state.pool) {
    if (!state.canEval() && state.sizeBounds.min > 1) break;
    if (state.sizeBounds.min <= 1) {
      if (!state.canEval()) break;
      const scored = state.tryEval([a.id], "search", "beam");
      if (scored && Number.isFinite(scored.robustScore)) beam.push(scored);
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
            children.push({
              bar: next,
              fingerprint: next.join("\0"),
              robustScore: Number.NEGATIVE_INFINITY,
              minDpm: 0,
              weightedMean: 0,
              profileId: state.config.profileId ?? "balanced",
              openingDpm: 0,
              developedDpm: 0,
              steadyDpm: 0,
            });
            grew = true;
            continue;
          }
          const scored = state.tryEval(next, "search", "beam");
          if (scored && Number.isFinite(scored.robustScore)) {
            children.push(scored);
            grew = true;
          }
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
  finite.sort(compareScored);
  const diverse = diverseSelect(finite, width);
  const seen = new Set(diverse.map((d) => d.fingerprint));
  for (const p of partials) {
    if (diverse.length >= width) break;
    if (seen.has(p.fingerprint)) continue;
    seen.add(p.fingerprint);
    diverse.push(p);
  }
  for (const f of finite) {
    if (diverse.length >= width) break;
    if (seen.has(f.fingerprint)) continue;
    seen.add(f.fingerprint);
    diverse.push(f);
  }
  return diverse.slice(0, width);
}

function sameFingerprints(a: ScoredBar[], b: ScoredBar[]): boolean {
  if (a.length !== b.length) return false;
  const sa = a
    .map((x) => x.fingerprint)
    .sort()
    .join("|");
  const sb = b
    .map((x) => x.fingerprint)
    .sort()
    .join("|");
  return sa === sb;
}
