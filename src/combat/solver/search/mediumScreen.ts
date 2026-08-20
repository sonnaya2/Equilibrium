/**
 * Medium-fidelity screen: rescore short-stage incumbents with proportional
 * robust windows. Never marks validForFinalRanking; finalize still full-horizon.
 */
import { barKey } from "../fingerprint";
import { canAdd } from "../eligibility";
import { shouldRunMediumStage } from "../fidelity";
import type { SearchState } from "./types";
import { maybeYield, type YieldCtx } from "./yield";

function isMediumOk(s: { mode: string; robustScore: number } | null | undefined): boolean {
  return Boolean(s && s.mode === "medium" && Number.isFinite(s.robustScore));
}

/** Short-stage winners + seeds + archive tops as medium-stage incumbents. */
export function collectMediumIncumbents(state: SearchState): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  const add = (bar: readonly string[] | null | undefined) => {
    if (!bar || bar.length === 0) return;
    if (bar.length < state.sizeBounds.min || bar.length > state.sizeBounds.max) return;
    const fp = barKey(bar);
    if (seen.has(fp)) return;
    seen.add(fp);
    out.push([...bar]);
  };

  // First-class current bar first, then short-stage winners + seeds.
  add(state.incumbentBar);
  add(state.bestExploratory?.bar);
  add(state.best?.bar);
  for (const seed of state.seeds) add(seed);

  const searchArchive = state.archive
    .filter((a) => a.mode === "search" && Number.isFinite(a.robustScore))
    .sort((a, b) => b.robustScore - a.robustScore);
  for (const a of searchArchive) add(a.bar);

  const cap = Math.max(
    (state.config.fullShortlistSize ?? state.config.topK) * 4,
    state.config.topK * 4,
    16,
  );
  return out.slice(0, cap);
}

/**
 * Spend remaining (medium) budget rescoring short-stage incumbents at medium mode.
 * Does not rewrite local/beam search; pure staged re-evaluation.
 */
export function runMediumScreen(state: SearchState): void {
  void runMediumScreenAsync(state, null);
}

export async function runMediumScreenAsync(
  state: SearchState,
  yieldCtx: YieldCtx | null,
): Promise<void> {
  if (
    !shouldRunMediumStage({
      mediumHorizonTicks: state.config.mediumHorizonTicks,
      mediumBudget: state.budget.remaining,
    })
  ) {
    return;
  }

  const pivot = state.bestExploratory?.bar ?? state.best?.bar;
  if (pivot) {
    for (const bar of statefulCandidateBars(state, pivot)) {
      if (!state.canEval()) break;
      state.tryEval(bar, "medium", "medium-stateful");
      if (yieldCtx) await maybeYield(state, yieldCtx);
    }
  }

  const incumbents = collectMediumIncumbents(state);
  for (let i = 0; i < incumbents.length; i++) {
    if (!state.canEval()) break;
    const bar = incumbents[i]!;
    state.tryEval(bar, "medium", "medium-screen");
    if (yieldCtx) await maybeYield(state, yieldCtx);
  }

  // Light polish: medium-score a few neighbors of best medium while budget remains.
  const mediumPivot = state.bestMedium?.bar ?? state.bestExploratory?.bar;
  if (!mediumPivot || !state.canEval()) return;

  const n = mediumPivot.length;
  const swaps: string[][] = [];
  for (let i = 0; i < n && swaps.length < 8; i++) {
    for (let j = i + 1; j < n && swaps.length < 8; j++) {
      const next = mediumPivot.slice();
      const t = next[i]!;
      next[i] = next[j]!;
      next[j] = t;
      swaps.push(next);
    }
  }
  for (const nb of swaps) {
    if (!state.canEval()) break;
    const scored = state.tryEval(nb, "medium", "medium-local");
    if (yieldCtx) await maybeYield(state, yieldCtx);
    if (
      isMediumOk(scored) &&
      state.bestMedium &&
      scored!.robustScore > state.bestMedium.robustScore
    ) {
      // bestMedium already updated via touchMediumBest
    }
  }
}

export function statefulCandidateBars(
  state: SearchState,
  pivot: readonly string[],
  onlyAbilityId?: string,
  repositionExisting = false,
): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  const push = (bar: string[]) => {
    const key = barKey(bar);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(bar);
  };

  for (const ability of state.pool) {
    if (!ability.stateful || (onlyAbilityId != null && ability.id !== onlyAbilityId)) {
      continue;
    }
    if (pivot.includes(ability.id)) {
      if (!repositionExisting) continue;
      const without = pivot.filter((id) => id !== ability.id);
      if (!canAdd(without, ability.id, state.byId)) continue;
      for (const position of statefulCandidatePositions(without.length)) {
        const repositioned = [...without];
        repositioned.splice(position, 0, ability.id);
        push(repositioned);
      }
      continue;
    }
    if (pivot.length < state.sizeBounds.max && canAdd(pivot, ability.id, state.byId)) {
      for (const position of statefulCandidatePositions(pivot.length)) {
        const inserted = [...pivot];
        inserted.splice(position, 0, ability.id);
        push(inserted);
      }
    }
    for (let replace = 0; replace < pivot.length; replace++) {
      if (state.requiredAbilityIds.includes(pivot[replace]!)) continue;
      const without = pivot.filter((_, index) => index !== replace);
      if (!canAdd(without, ability.id, state.byId)) continue;
      for (const position of statefulCandidatePositions(without.length)) {
        const replaced = [...without];
        replaced.splice(position, 0, ability.id);
        push(replaced);
      }
    }
  }
  return out;
}

function statefulCandidatePositions(length: number): number[] {
  return [...new Set([0, Math.floor(length / 2), length])];
}
