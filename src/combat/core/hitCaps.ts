/** Hit caps are per-effect metadata, not one hardcoded global. The standard cap is
 *  30,000; individual effects may raise, bypass, or re-split it via their own rule. */
export const STANDARD_HIT_CAP = 30_000;

export interface HitCapRule {
  cap: number;
  /** True for effects documented to ignore the cap entirely. */
  bypass?: boolean;
}

export const standardHitCap: HitCapRule = { cap: STANDARD_HIT_CAP };

/**
 * Validation seam for hit-cap rules. Bypass is preserved as-is. Non-bypass caps
 * must be finite and non-negative; non-integers are floored to integer damage units.
 * NaN / infinity / negative caps throw rather than leaking into Math.min.
 */
export function normalizeHitCapRule(rule: HitCapRule = standardHitCap): HitCapRule {
  if (rule.bypass) return { cap: rule.cap, bypass: true };
  if (!Number.isFinite(rule.cap) || rule.cap < 0) {
    throw new RangeError(`applyHitCap: invalid cap ${rule.cap}`);
  }
  const cap = Number.isInteger(rule.cap) ? rule.cap : Math.floor(rule.cap);
  return cap === rule.cap ? rule : { ...rule, cap };
}

export function applyHitCap(damage: number, rule: HitCapRule = standardHitCap): number {
  const normalized = normalizeHitCapRule(rule);
  if (normalized.bypass) return damage;
  if (!Number.isFinite(damage)) {
    throw new RangeError(`applyHitCap: invalid damage ${damage}`);
  }
  return Math.min(Math.max(0, damage), normalized.cap);
}
