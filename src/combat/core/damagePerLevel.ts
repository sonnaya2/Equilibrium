/**
 * Damage Per Level, 2026 logarithmic curve. Replaced the pre-2026 linear `2.5 * level`.
 * Source: Combat Style Modernisation (2 Mar 2026) — verify against the RuneScape Wiki before
 * shipping any number derived from it.
 *
 *   DPL(level) = 145 * 2.5 * ln(1 + 0.6 * level / 145) / ln(1.6)
 *
 * The 145/0.6 pairing pins the curve to the old linear value at level 145 (362.5), so it pays out
 * ahead of linear below that and converges there. Keep the literals; do not "simplify" the ratio.
 */
export const DPL_ANCHOR_LEVEL = 145;
export const DPL_PER_LEVEL = 2.5;
export const DPL_CURVE = 0.6;

const LN_SCALE = Math.log(1 + DPL_CURVE);

export function damagePerLevel(level: number): number {
  if (!Number.isFinite(level)) throw new RangeError(`damagePerLevel: bad level ${level}`);
  if (level < 0) throw new RangeError(`damagePerLevel: negative level ${level}`);
  return (
    (DPL_ANCHOR_LEVEL * DPL_PER_LEVEL * Math.log(1 + (DPL_CURVE * level) / DPL_ANCHOR_LEVEL)) /
    LN_SCALE
  );
}

/** Pre-2026 linear curve, kept for comparison/debug only. Never use in current-game math. */
export function legacyDamagePerLevel(level: number): number {
  return DPL_PER_LEVEL * level;
}
