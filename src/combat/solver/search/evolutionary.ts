import type { ScoredBar } from "../contracts";
import { exclusiveKey, remainingCandidates } from "../eligibility";
import { ensureRequiredAbilityIds } from "../stylePolicy";
import { compareScored, insertAt, removeAt, replaceAt, swapAt, type SearchState } from "./types";
import { maybeYield, type YieldCtx } from "./yield";

/**
 * Generational EA: order crossover, swap/insert/remove/replace/reverse mutations,
 * elitism. Seeded rng only.
 */
export function runEvolutionary(state: SearchState): void {
  void runEvolutionaryAsync(state, undefined);
}

export async function runEvolutionaryAsync(state: SearchState, yieldCtx?: YieldCtx): Promise<void> {
  const { evoPopulation, evoGenerations, evoElite } = state.config;
  let pop = seedPopulation(state, evoPopulation);
  if (pop.length === 0) return;

  for (let gen = 0; gen < evoGenerations && state.canEval(); gen++) {
    pop.sort(compareScored);
    const next: ScoredBar[] = pop.slice(0, Math.min(evoElite, pop.length)).map((s) => ({
      ...s,
      bar: [...s.bar],
    }));

    while (next.length < evoPopulation && state.canEval()) {
      const p1 = tournament(state, pop);
      const p2 = tournament(state, pop);
      let child = orderCrossover(p1.bar, p2.bar, state);
      child = mutate(state, child);
      if (child.length < state.sizeBounds.min || child.length > state.sizeBounds.max) continue;
      const scored = state.tryEval(child, "search", "evo");
      if (yieldCtx) await maybeYield(state, yieldCtx);
      if (scored && Number.isFinite(scored.robustScore)) next.push(scored);
    }

    if (next.length === 0) break;
    pop = next;
  }
}

function seedPopulation(state: SearchState, size: number): ScoredBar[] {
  const pop: ScoredBar[] = [];
  const seen = new Set<string>();

  if (state.best && Number.isFinite(state.best.robustScore)) {
    pop.push({ ...state.best, bar: [...state.best.bar] });
    seen.add(state.best.fingerprint);
  }
  for (const seed of state.seeds) {
    if (pop.length >= size || !state.canEval()) break;
    const scored = state.tryEval(seed, "search", "evo-seed");
    if (scored && Number.isFinite(scored.robustScore) && !seen.has(scored.fingerprint)) {
      seen.add(scored.fingerprint);
      pop.push(scored);
    }
  }
  let guard = size * 8;
  while (pop.length < size && state.canEval() && guard-- > 0) {
    const bar = randomLegalBar(state);
    if (!bar) break;
    const scored = state.tryEval(bar, "search", "evo-init");
    if (scored && Number.isFinite(scored.robustScore) && !seen.has(scored.fingerprint)) {
      seen.add(scored.fingerprint);
      pop.push(scored);
    }
  }
  return pop;
}

function randomLegalBar(state: SearchState): string[] | null {
  const { min, max } = state.sizeBounds;
  const len = Math.max(state.requiredAbilityIds.length, min + state.rng.int(max - min + 1));
  const bar: string[] = [...state.requiredAbilityIds];
  const pool = state.rng.shuffle([...state.pool]);
  for (const a of pool) {
    if (bar.length >= len) break;
    if (remainingCandidates(bar, [a], state.byId).length) bar.push(a.id);
  }
  return bar.length >= min ? bar : null;
}

function tournament(state: SearchState, pop: ScoredBar[]): ScoredBar {
  const a = state.rng.pick(pop);
  const b = state.rng.pick(pop);
  return a.robustScore >= b.robustScore ? a : b;
}

/** Order crossover (OX) on ability sequences; drops exclusivity conflicts from p2. */
export function orderCrossover(
  p1: readonly string[],
  p2: readonly string[],
  state: SearchState,
): string[] {
  if (p1.length === 0) {
    return ensureRequiredAbilityIds(p2, state.requiredAbilityIds, state.sizeBounds.max);
  }
  if (p2.length === 0) {
    return ensureRequiredAbilityIds(p1, state.requiredAbilityIds, state.sizeBounds.max);
  }
  const n = Math.max(p1.length, p2.length);
  const i = state.rng.int(Math.min(p1.length, n) || 1);
  const j = state.rng.int(Math.min(p1.length, n) || 1);
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);

  const segment = p1.slice(lo, hi + 1);
  const used = new Set(segment);
  const segmentGroups = new Set<string>();
  for (const id of segment) {
    const a = state.byId.get(id);
    const g = a ? exclusiveKey(a) : undefined;
    if (g) segmentGroups.add(g);
  }

  const p2filtered: string[] = [];
  for (const id of p2) {
    if (used.has(id)) continue;
    const a = state.byId.get(id);
    if (!a) continue;
    const g = exclusiveKey(a);
    if (g && segmentGroups.has(g)) continue;
    p2filtered.push(id);
  }

  const child: string[] = [];
  let p2i = 0;
  for (let pos = 0; pos < n; pos++) {
    if (pos >= lo && pos <= hi && pos - lo < segment.length) {
      child.push(segment[pos - lo]!);
    } else if (p2i < p2filtered.length) {
      child.push(p2filtered[p2i++]!);
    }
  }
  while (p2i < p2filtered.length && child.length < state.sizeBounds.max) {
    child.push(p2filtered[p2i++]!);
  }
  while (child.length > state.sizeBounds.max) child.pop();
  return ensureRequiredAbilityIds(child, state.requiredAbilityIds, state.sizeBounds.max);
}

function mutate(state: SearchState, bar: string[]): string[] {
  if (bar.length === 0) return bar;
  const op = state.rng.int(5);
  switch (op) {
    case 0: {
      if (bar.length < 2) return bar;
      return swapAt(bar, state.rng.int(bar.length), state.rng.int(bar.length));
    }
    case 1: {
      if (bar.length < 2) return bar;
      const i = state.rng.int(bar.length);
      const j = state.rng.int(bar.length);
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      const next = bar.slice();
      for (let a = lo, b = hi; a < b; a++, b--) {
        const t = next[a]!;
        next[a] = next[b]!;
        next[b] = t;
      }
      return next;
    }
    case 2: {
      if (bar.length <= state.sizeBounds.min) return bar;
      const removable = bar
        .map((id, index) => ({ id, index }))
        .filter(({ id }) => !state.requiredAbilityIds.includes(id));
      if (removable.length === 0) return bar;
      return removeAt(bar, removable[state.rng.int(removable.length)]!.index);
    }
    case 3: {
      if (bar.length >= state.sizeBounds.max) return bar;
      const remain = remainingCandidates(bar, state.pool, state.byId);
      if (!remain.length) return bar;
      return insertAt(bar, state.rng.int(bar.length + 1), state.rng.pick(remain).id);
    }
    default: {
      const replaceable = bar
        .map((id, index) => ({ id, index }))
        .filter(({ id }) => !state.requiredAbilityIds.includes(id));
      if (replaceable.length === 0) return bar;
      const idx = replaceable[state.rng.int(replaceable.length)]!.index;
      const without = removeAt(bar, idx);
      const remain = remainingCandidates(without, state.pool, state.byId);
      if (!remain.length) return bar;
      return replaceAt(bar, idx, state.rng.pick(remain).id);
    }
  }
}
