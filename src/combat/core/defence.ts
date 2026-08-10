import type { SourceReference } from "../types";
import { overloadBoostedLevel, overloadLevelBoost, type OverloadTier } from "../shared/potions";
import { accuracyCurve } from "../target/genericTarget";

/**
 * Player-as-defender (vs GenericTarget for NPCs).
 * totalArmour = shared Total Armor Value from equipment (Loadout/Hero; no Defence level).
 * blockArmourRating d = floor(equipmentArmour + f(blockLevel)); hit-chance denom only.
 * f(x)=x^3/1250+4x+40; blockLevel = visible+prayer or Fortitude x1.15 (incompatible with curse Def).
 * Aegis / Striking Light / Barkscales / Bash armour-% read totalArmour only.
 * blockArmourRating is the hit-chance denominator, not an Aegis input.
 * Wiki sources below.
 */
export const DEFENCE_LEVEL_ARMOUR_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Defence",
  title: "Defence",
  verifiedAt: "2026-08-02",
};

/** Player-facing total Armour: per-item tier/slot (wiki Armour). */
export const ARMOUR_STAT_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Armour",
  title: "Armour",
  verifiedAt: "2026-08-02",
};

/** d = floor(armour + f(Defence level)) - the hit-chance denominator. */
export const BLOCK_ARMOUR_RATING_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Hit_chance",
  title: "Hit chance",
  verifiedAt: "2026-08-02",
};

export const FORTITUDE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Fortitude_(status)",
  title: "Fortitude (status)",
  verifiedAt: "2026-08-02",
};

export const MAX_DEFENCE_LEVEL = 99;
export const FORTITUDE_BLOCK_MULTIPLIER = 1.15;

export interface DefenceInput {
  /** Untrimmed Defence level (1-99). */
  baseLevel: number;
  /** Active overload-family tier; overloads boost Defence like every combat stat. */
  overloadTier?: OverloadTier | null;
  /** Prayer/curse block levels (+10 Turmoil line, +12 Praesul). */
  prayerBlockLevels?: number;
  /** Fortitude's 15% block-calculation Defence boost. */
  fortitude?: boolean;
  /** Summed raw equipment Armour from the canonical equipment aggregation. */
  equipmentArmour?: number;
  /** Final Total Armor Value multiplier; raw equipment data stays unchanged. */
  armourMultiplier?: number;
  /** Flat Armour added before the final Total Armour multiplier. */
  armourBonus?: number;
}

export interface DefenceStats {
  baseLevel: number;
  /** Levels granted by the potion boost alone. */
  potionBoost: number;
  /** Base level plus potion boost - what the stats tab shows. */
  visibleLevel: number;
  prayerBlockLevels: number;
  fortitude: boolean;
  /** Visible level plus prayer block levels (or Fortitude's ×1.15) - feeds f(x). */
  blockLevel: number;
  equipmentArmour: number;
  armourBonus: number;
  /** Shared Total Armor Value from equipment; Aegis and other armour-% blessings read this. */
  totalArmour: number;
  /** f(blockLevel), unfloored; the floor belongs to the rating. */
  blockLevelArmour: number;
  /** floor(equipmentArmour + blockLevelArmour) - the hit-chance denominator only. */
  blockArmourRating: number;
}

export function defenceStats(input: DefenceInput): DefenceStats {
  const {
    baseLevel,
    overloadTier = null,
    prayerBlockLevels = 0,
    fortitude = false,
    equipmentArmour = 0,
    armourMultiplier = 1,
    armourBonus = 0,
  } = input;
  if (!Number.isFinite(baseLevel) || baseLevel < 1 || baseLevel > MAX_DEFENCE_LEVEL) {
    throw new RangeError(`defenceStats: bad base level ${baseLevel}`);
  }
  if (!Number.isFinite(prayerBlockLevels) || prayerBlockLevels < 0) {
    throw new RangeError(`defenceStats: bad prayer block levels ${prayerBlockLevels}`);
  }
  if (!Number.isFinite(equipmentArmour) || equipmentArmour < 0) {
    throw new RangeError(`defenceStats: bad equipment armour ${equipmentArmour}`);
  }
  if (!Number.isFinite(armourMultiplier) || armourMultiplier <= 0) {
    throw new RangeError(`defenceStats: bad armour multiplier ${armourMultiplier}`);
  }
  if (!Number.isFinite(armourBonus) || armourBonus < 0) {
    throw new RangeError(`defenceStats: bad armour bonus ${armourBonus}`);
  }
  if (fortitude && prayerBlockLevels > 0) {
    throw new RangeError("defenceStats: Fortitude and stat-boosting curses are incompatible");
  }
  const potionBoost = overloadTier ? overloadLevelBoost(baseLevel, overloadTier) : 0;
  const visibleLevel = overloadTier ? overloadBoostedLevel(baseLevel, overloadTier) : baseLevel;
  const blockLevel = fortitude
    ? visibleLevel * FORTITUDE_BLOCK_MULTIPLIER
    : visibleLevel + prayerBlockLevels;
  const blockLevelArmour = accuracyCurve(blockLevel);
  const preMultiplierArmour = equipmentArmour + armourBonus;
  const resolvedTotalArmour =
    preMultiplierArmour + Math.floor(preMultiplierArmour * (armourMultiplier - 1));
  return {
    baseLevel,
    potionBoost,
    visibleLevel,
    prayerBlockLevels,
    fortitude,
    blockLevel,
    equipmentArmour,
    armourBonus,
    totalArmour: resolvedTotalArmour,
    blockLevelArmour,
    blockArmourRating: Math.floor(resolvedTotalArmour + blockLevelArmour),
  };
}
