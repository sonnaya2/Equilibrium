import blessingsData from "#shard/league/blessings.json";
import type { SourceReference } from "@/combat/types";

/**
 * Blessing domain. Canonical structure (paths, god tiers, reset count) lives in
 * data/league/blessings.json; this module types it and derives from it.
 * Jagex's countdown post says tiers 4 and 8 grant a God
 * Tier Blessing set by the three path picks in their segment (tier 4 <- tiers
 * 1-3, tier 8 <- tiers 5-7) — 2+ of one path wins that path's god, one of each
 * grants the Balance god. The derivation returns the alignment; revealed God
 * Tier cards are resolved from the same database-generated record as path picks.
 */

export const BLESSING_PATHS = ["Order", "Balance", "Chaos"] as const;
export type BlessingPath = (typeof BLESSING_PATHS)[number];

export type GodTierAlignment = BlessingPath;

export const BLESSING_IDS = [
  "teragards-aegis",
  "big-boned",
  "adrenaline-junkie",
  "striking-light",
  "barkscales",
  "abyssal-cinders",
  "steadfast-will",
  "eternal-sustenance",
  "avernic-rampage",
  "sacred-fervor",
  "splash-zone",
  "demons-mark",
] as const;
export type BlessingId = (typeof BLESSING_IDS)[number];
export type BlessingSupportStatus = "modeled" | "partially-modeled" | "not-modeled";

export interface BlessingSupport {
  status: BlessingSupportStatus;
  mechanicsUnverified: boolean;
  excluded: readonly string[];
  assumptions: readonly string[];
}

/** Sourced/provisional parameters stored in SQLite and emitted into the build shard. */
export interface BlessingCombatRules {
  baseAbilityDamageArmourPercent?: number;
  defenderArmourMultiplier?: number;
  shieldArmourMultiplier?: number;
  maximumLifeMultiplier?: number;
  maxLifeDamagePercent?: number;
  maximumAdrenaline?: number;
  adrenalineGenerationMultiplier?: number;
  basicDamageMultiplier?: number;
  light?: {
    cooldownTicks: number;
    abilityDamageBand: readonly [number, number];
    armourPercent: number;
  };
  perHitAbilityDamagePercent?: number;
  inferno?: { chance: number; abilityDamageBand: readonly [number, number] };
  procChance?: number;
  freeCastDurationTicks?: number;
  refresh?: "refresh";
  cooldownMultiplier?: number;
  areaDamageBonus?: number;
  aoePerTileBonus?: number;
  useTargetWeakness?: boolean;
}

export const GOD_TIERS: readonly number[] = blessingsData.godTiers;
export const BLESSING_RESET_COUNT: number = blessingsData.resetCount;
export const BLESSING_TIERS: readonly number[] = blessingsData.records.map((r) => r.tier);

/** Tiers where a path is picked — god tiers grant, they are not picked. */
export const PATH_TIERS: readonly number[] = BLESSING_TIERS.filter((t) => !GOD_TIERS.includes(t));

export interface BlessingChoice {
  id: BlessingId;
  name: string;
  path: BlessingPath;
  effects: readonly string[];
  verified: boolean;
  support: BlessingSupport;
  combat: BlessingCombatRules;
  source: SourceReference;
}

export function blessingChoice(tier: number, path: BlessingPath): BlessingChoice | undefined {
  const record = blessingsData.records.find((entry) => entry.tier === tier);
  const choice = record?.choices.find((entry) => entry.path === path);
  return choice ? ({ ...choice, source: record!.source } as BlessingChoice) : undefined;
}

export function blessingTierRevealed(tier: number): boolean {
  return blessingsData.records.find((entry) => entry.tier === tier)?.revealed === true;
}

/** God for one segment of picks. Null while the picks made so far leave it undecided. */
export function deriveGodTier(picks: readonly BlessingPath[]): GodTierAlignment | null {
  const counts: Record<BlessingPath, number> = { Order: 0, Balance: 0, Chaos: 0 };
  for (const p of picks.slice(0, 3)) {
    if ((BLESSING_PATHS as readonly string[]).includes(p)) counts[p] += 1;
  }
  for (const path of BLESSING_PATHS) if (counts[path] >= 2) return path;
  return BLESSING_PATHS.every((path) => counts[path] >= 1) ? "Balance" : null;
}

/** Picks feeding a god tier: the three path tiers since the previous god tier. */
export function godTierSegment(
  picks: readonly BlessingPath[],
  godTier: number,
): readonly BlessingPath[] {
  const segmentIndex = GOD_TIERS.filter((t) => t < godTier).length;
  return picks.slice(segmentIndex * 3, segmentIndex * 3 + 3);
}

export function godTierAlignments(
  picks: readonly BlessingPath[],
): Record<number, GodTierAlignment | null> {
  return Object.fromEntries(GOD_TIERS.map((t) => [t, deriveGodTier(godTierSegment(picks, t))]));
}

/** Named cards currently granted by the ordered Build picks, including God Tiers. */
export function activeBlessings(picks: readonly BlessingPath[]): BlessingChoice[] {
  const active = picks.flatMap((path, index) => {
    const tier = PATH_TIERS[index];
    const choice = tier === undefined ? undefined : blessingChoice(tier, path);
    return choice ? [choice] : [];
  });
  for (const godTier of GOD_TIERS) {
    const segment = godTierSegment(picks, godTier);
    if (segment.length < 3) continue;
    const alignment = deriveGodTier(segment);
    const choice = alignment ? blessingChoice(godTier, alignment) : undefined;
    if (choice) active.push(choice);
  }
  return active;
}
