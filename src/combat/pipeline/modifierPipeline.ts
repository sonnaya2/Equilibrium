import { recordModifierSort } from "../profiling/hitPipeline";
import type { CombatContext, CombatModifier, DamageState, ModifierStage } from "../types";

/** Explicit stage order - the pipeline is deterministic, never one combined formula. */
export const STAGE_ORDER: readonly ModifierStage[] = [
  "base",
  "ability",
  "onCast",
  "roll",
  "critical",
  "onHit",
  "target",
  "postHit",
];

export function orderModifiers(modifiers: readonly CombatModifier[]): CombatModifier[] {
  recordModifierSort();
  return [...modifiers].sort(
    (a, b) =>
      STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.priority - b.priority,
  );
}

/**
 * Apply an already-ordered modifier list (no sort).
 * When `preFiltered` is true, skips `applies` checks; only valid when the list was
 * filtered against the same stable context used for every roll in a hit band.
 */
export function runOrderedPipeline(
  initial: DamageState,
  orderedModifiers: readonly CombatModifier[],
  context: CombatContext,
  preFiltered = false,
): DamageState {
  const active = preFiltered
    ? orderedModifiers
    : orderedModifiers.filter((m) => m.applies(context));
  let state = initial;
  for (const m of active) {
    state = m.apply(state, context);
  }
  return state;
}

/** Sort once, then filter for a stable context. Safe to reuse across all rolls in a band. */
export function compileActiveModifiers(
  modifiers: readonly CombatModifier[],
  context: CombatContext,
): CombatModifier[] {
  return orderModifiers(modifiers).filter((m) => m.applies(context));
}

export function runPipeline(
  initial: DamageState,
  modifiers: readonly CombatModifier[],
  context: CombatContext,
): DamageState {
  return runOrderedPipeline(initial, orderModifiers(modifiers), context, false);
}
