/** Hit caps are per-effect metadata, not one hardcoded global. The standard cap is
 *  30,000; individual effects may raise, bypass, or re-split it via their own rule. */
export const STANDARD_HIT_CAP = 30_000;

export interface HitCapRule {
  cap: number;
  /** True for effects documented to ignore the cap entirely. */
  bypass?: boolean;
}

export const standardHitCap: HitCapRule = { cap: STANDARD_HIT_CAP };

export function applyHitCap(damage: number, rule: HitCapRule = standardHitCap): number {
  if (rule.bypass) return damage;
  return Math.min(damage, rule.cap);
}
