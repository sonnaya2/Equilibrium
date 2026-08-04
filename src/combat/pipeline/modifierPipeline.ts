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

export function runPipeline(
  initial: DamageState,
  modifiers: readonly CombatModifier[],
  context: CombatContext,
): DamageState {
  return orderModifiers(modifiers)
    .filter((m) => m.applies(context))
    .reduce((state, m) => m.apply(state, context), initial);
}
