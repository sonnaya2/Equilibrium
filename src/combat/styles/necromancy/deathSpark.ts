import type { SourceReference } from "../../types";

/**
 * Omni Guard Death Spark: each Necromancy basic +1 stack; at 5 stacks ready.
 * Next basic doubles damage and consumes stacks. First empower on 6th basic
 * (every 6th). MH switch clears stacks (sim does not mid-fight switch).
 * https://runescape.wiki/w/Omni_guard (verified 2026-08-04).
 */
export const DEATH_SPARK_STACKS_TO_EMPOWER = 5;
export const DEATH_SPARK_DAMAGE_MULT = 2;
export const DEATH_SPARK_PASSIVE_ID = "death-spark" as const;

export interface DeathSparkCastResult {
  readonly stacks: number;
  /** True when this basic is the empowered double-damage hit. */
  readonly empower: boolean;
}

/**
 * Cast-time Death Spark transition for one Necromancy basic attack.
 * stacks are the pre-cast value (0..5). Ready at 5; next basic empowers.
 */
export function applyDeathSparkOnBasic(stacks: number): DeathSparkCastResult {
  const s = Math.max(0, Math.min(DEATH_SPARK_STACKS_TO_EMPOWER, stacks));
  if (s >= DEATH_SPARK_STACKS_TO_EMPOWER) {
    return { stacks: 0, empower: true };
  }
  return { stacks: s + 1, empower: false };
}

export function clearDeathSparkStacks(): number {
  return 0;
}

export const DEATH_SPARK_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Omni_guard",
  title: "Omni guard",
  verifiedAt: "2026-08-04",
};
