/**
 * Shared numeric domain guards for combat/league inputs. Keep these free of
 * React and free of game-data imports so rotation math and scenario helpers can
 * share the same closed-set checks.
 */

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Strictly greater than zero and finite. */
export function isPositiveFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/** Greater than or equal to zero and finite. */
export function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

/** Truncatable non-negative finite number (accepts 3.2 → callers still floor). */
export function isNonNegativeCount(value: unknown): value is number {
  return isNonNegativeFinite(value);
}

export type ValidationOk<T> = { ok: true; value: T };
export type ValidationErr = { ok: false; reason: string };
export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

function finite(value: unknown, label: string): ValidationResult<number> {
  if (!isFiniteNumber(value)) return { ok: false, reason: `${label} must be a finite number` };
  return { ok: true, value };
}

export function validateArmour(value: unknown): ValidationResult<number> {
  const n = finite(value, "armour");
  if (!n.ok) return n;
  if (n.value < 0 || n.value > 1_000_000) return { ok: false, reason: "armour must be in [0, 1000000]" };
  return n;
}

export function validateIncomingHitInterval(value: unknown): ValidationResult<number | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  const n = finite(value, "incoming hit interval");
  if (!n.ok) return n;
  if (n.value <= 0 || n.value > 3600) return { ok: false, reason: "incoming hit interval must be in (0, 3600] seconds" };
  return n;
}

export function validateScenarioDuration(value: unknown): ValidationResult<number> {
  const n = finite(value, "scenario duration");
  if (!n.ok) return n;
  if (n.value <= 0 || n.value > 3600) return { ok: false, reason: "scenario duration must be in (0, 3600] seconds" };
  return n;
}

export function validateProbability(value: unknown): ValidationResult<number> {
  const n = finite(value, "probability");
  if (!n.ok) return n;
  if (n.value < 0 || n.value > 1) return { ok: false, reason: "probability must be in [0, 1]" };
  return n;
}
