import type { SourceReference } from "../types";
import { overloadBoostedLevel, overloadLevelBoost, type OverloadTier } from "../shared/potions";
import { accuracyCurve } from "../target/genericTarget";

/**
 * Player Defence model (the player as the defender — distinct from GenericTarget,
 * which models the NPC being attacked).
 *
 *   visible Defence level  = base + potion boost
 *   block-calculation level = visible + prayer block levels (effective levels that
 *                             exist only inside the block calculation)
 *   level-derived Armour    = f(block level),  f(x) = x³/1250 + 4x + 40
 *   total Armour rating     = floor(equipment Armour + level-derived Armour)
 *
 * Equipment Armour and total Armour rating stay separate fields; equipment Prayer
 * bonus is never an input here — it does not affect Armour (wiki Armour /
 * Combat Stats). Fortitude's +15% Defence is deliberately unimplemented: no
 * current source documents its rounding or boost-order, so it would be invented.
 */
export const DEFENCE_LEVEL_ARMOUR_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Defence",
  title: "Defence",
  verifiedAt: "2026-08-02",
};

export const TOTAL_ARMOUR_RATING_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Hit_chance",
  title: "Hit chance",
  verifiedAt: "2026-08-02",
};

export interface DefenceInput {
  /** Untrimmed Defence level (1–120). */
  baseLevel: number;
  /** Active overload-family tier; overloads boost Defence like every combat stat. */
  overloadTier?: OverloadTier | null;
  /**
   * Effective block-calculation levels from an active prayer/curse
   * (e.g. StyleCurseBoost.defenceLevels: +10 Turmoil line, +12 Praesul).
   */
  prayerBlockLevels?: number;
  /** Summed equipment Armour from the canonical equipment aggregation. */
  equipmentArmour?: number;
}

export interface DefenceStats {
  baseLevel: number;
  /** Levels granted by the potion boost alone. */
  potionBoost: number;
  /** Base level plus potion boost — what the stats tab shows. */
  visibleLevel: number;
  prayerBlockLevels: number;
  /** Visible level plus prayer block levels — feeds f(x). */
  blockLevel: number;
  equipmentArmour: number;
  /** f(blockLevel), unfloored; the floor belongs to the total. */
  levelArmour: number;
  /** floor(equipmentArmour + levelArmour). */
  totalArmour: number;
}

export function defenceStats(input: DefenceInput): DefenceStats {
  const { baseLevel, overloadTier = null, prayerBlockLevels = 0, equipmentArmour = 0 } = input;
  if (!Number.isFinite(baseLevel) || baseLevel < 1) {
    throw new RangeError(`defenceStats: bad base level ${baseLevel}`);
  }
  if (!Number.isFinite(prayerBlockLevels) || prayerBlockLevels < 0) {
    throw new RangeError(`defenceStats: bad prayer block levels ${prayerBlockLevels}`);
  }
  if (!Number.isFinite(equipmentArmour) || equipmentArmour < 0) {
    throw new RangeError(`defenceStats: bad equipment armour ${equipmentArmour}`);
  }
  const potionBoost = overloadTier ? overloadLevelBoost(baseLevel, overloadTier) : 0;
  const visibleLevel = overloadTier
    ? overloadBoostedLevel(baseLevel, overloadTier)
    : baseLevel;
  const blockLevel = visibleLevel + prayerBlockLevels;
  const levelArmour = accuracyCurve(blockLevel);
  return {
    baseLevel,
    potionBoost,
    visibleLevel,
    prayerBlockLevels,
    blockLevel,
    equipmentArmour,
    levelArmour,
    totalArmour: Math.floor(equipmentArmour + levelArmour),
  };
}
