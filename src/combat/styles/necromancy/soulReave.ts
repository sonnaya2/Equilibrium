import type { SourceReference } from "../../types";

/**
 * Devourer's Guard Soul Reave: each Necromancy basic +1 stack; at 4 stacks ready;
 * next basic grants 1 Residual Soul on successful land, then stacks reset.
 * Every 5th basic. No direct damage from the passive.
 * https://runescape.wiki/w/Devourer%27s_Guard (verified 2026-08-04).
 */
export const SOUL_REAVE_STACKS_TO_EMPOWER = 4;
export const SOUL_REAVE_PASSIVE_ID = "soul-reave" as const;

export interface SoulReaveCastResult {
  readonly stacks: number;
  /** True when this basic should grant +1 Residual Soul if the hit lands. */
  readonly grantSoulOnLand: boolean;
}

/**
 * Cast-time Soul Reave transition for one Necromancy basic attack.
 * stacks are the pre-cast value (0..4). Ready at 4; next basic grants on land.
 */
export function applySoulReaveOnBasic(stacks: number): SoulReaveCastResult {
  const s = Math.max(0, Math.min(SOUL_REAVE_STACKS_TO_EMPOWER, stacks));
  if (s >= SOUL_REAVE_STACKS_TO_EMPOWER) {
    return { stacks: 0, grantSoulOnLand: true };
  }
  return { stacks: s + 1, grantSoulOnLand: false };
}

export function clearSoulReaveStacks(): number {
  return 0;
}

export const SOUL_REAVE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Devourer%27s_Guard",
  title: "Devourer's Guard",
  verifiedAt: "2026-08-04",
};
