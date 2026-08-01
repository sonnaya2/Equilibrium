import type { CastRecord, RotationSummary } from "../../engine/simulation/simulate";

/** Throws with a named reason instead of letting a missing value become `undefined`
 *  and turn a real regression into a confusing assertion failure downstream. */
export function required<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(label);
  return value;
}

export function abilityById<T extends { id: string }>(abilities: readonly T[], id: string): T {
  return required(
    abilities.find((ability) => ability.id === id),
    `Missing engine ability: ${id}`,
  );
}

export function lastCast(summary: RotationSummary): CastRecord {
  return required(summary.casts.at(-1), "Expected at least one cast");
}

export function findCast(
  summary: RotationSummary,
  predicate: (cast: CastRecord) => boolean,
  label: string,
): CastRecord {
  return required(summary.casts.find(predicate), label);
}
