import blessingsData from "#shard/league/blessings.json";

/**
 * Blessing domain. Canonical structure (paths, god tiers, reset count) lives in
 * data/league/blessings.json; this module types it and derives from it.
 * Jagex's countdown post says tiers 4 and 8 grant a God
 * Tier Blessing set by the three path picks in their segment (tier 4 <- tiers
 * 1-3, tier 8 <- tiers 5-7) — 2+ of one path wins that path's god, one of each
 * grants the Balance god. God blessing names/effects are unrevealed, so the
 * derivation returns only the alignment.
 */

export const BLESSING_PATHS = ["Order", "Balance", "Chaos"] as const;
export type BlessingPath = (typeof BLESSING_PATHS)[number];

export type GodTierAlignment = BlessingPath;

export const GOD_TIERS: readonly number[] = blessingsData.godTiers;
export const BLESSING_RESET_COUNT: number = blessingsData.resetCount;
export const BLESSING_TIERS: readonly number[] = blessingsData.records.map((r) => r.tier);

/** Tiers where a path is picked — god tiers grant, they are not picked. */
export const PATH_TIERS: readonly number[] = BLESSING_TIERS.filter((t) => !GOD_TIERS.includes(t));

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
