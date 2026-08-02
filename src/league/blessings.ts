import blessingsData from "#shard/league/blessings.json";
import type { SourceReference } from "@/combat/types";
import { assertBlessingsDocument, collectBlessingIds } from "./blessingSchema";

/**
 * Blessing domain. Canonical structure (paths, god tiers, reset count) lives in
 * data/league/blessings.json; this module types it and derives from it.
 * Jagex's countdown post says tiers 4 and 8 grant a God
 * Tier Blessing set by the three path picks in their segment (tier 4 <- tiers
 * 1-3, tier 8 <- tiers 5-7) — 2+ of one path wins that path's god, one of each
 * grants the Balance god. The derivation returns the alignment; revealed God
 * Tier cards are resolved from the same database-generated record as path picks.
 */

assertBlessingsDocument(blessingsData);

export const BLESSING_PATHS = ["Order", "Balance", "Chaos"] as const;
export type BlessingPath = (typeof BLESSING_PATHS)[number];

export type GodTierAlignment = BlessingPath;

/** Compile-time closed set — runtime catalogue is asserted against the shard. */
export const KNOWN_BLESSING_IDS = [
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
export type BlessingId = (typeof KNOWN_BLESSING_IDS)[number];

export const BLESSING_IDS = collectBlessingIds(blessingsData) as readonly BlessingId[];

/**
 * `scenario-dependent` is distinct from `not-modeled`: the mechanic is
 * implemented, but it needs an input the outgoing rotation cannot supply, so it
 * has no calculated damage until the user states that scenario. It must never
 * be presented as a calculated zero.
 */
export type BlessingSupportStatus =
  "modeled" | "partially-modeled" | "scenario-dependent" | "not-modeled";

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
  barkscales?: {
    armourReductionPercent: number;
    reductionsPerTrigger: number;
    graspAbilityDamageBand: readonly [number, number];
    graspAreaTiles: number;
  };
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
  tier: number;
  effects: readonly string[];
  verified: boolean;
  support: BlessingSupport;
  combat: BlessingCombatRules;
  source: SourceReference;
}

/** Stable pick row for persistence / share links (path history + resolved id). */
export interface StableBlessingSelection {
  tier: number;
  blessingId: BlessingId;
  path?: BlessingPath;
}

function isBlessingId(value: string): value is BlessingId {
  return (KNOWN_BLESSING_IDS as readonly string[]).includes(value);
}

function isBlessingPath(value: string): value is BlessingPath {
  return (BLESSING_PATHS as readonly string[]).includes(value);
}

function toChoice(
  tier: number,
  choice: (typeof blessingsData.records)[number]["choices"][number],
  source: SourceReference,
): BlessingChoice | undefined {
  if (!isBlessingId(choice.id) || !isBlessingPath(choice.path)) return undefined;
  return {
    ...(choice as Omit<BlessingChoice, "tier" | "source">),
    id: choice.id,
    path: choice.path,
    tier,
    source,
  };
}

/** All revealed/unrevealed choices keyed by stable id (last write wins on collision). */
export const CHOICES_BY_ID: ReadonlyMap<BlessingId, BlessingChoice> = (() => {
  const map = new Map<BlessingId, BlessingChoice>();
  for (const record of blessingsData.records) {
    const source = record.source as SourceReference;
    for (const choice of record.choices) {
      const resolved = toChoice(record.tier, choice, source);
      if (resolved) map.set(resolved.id, resolved);
    }
  }
  return map;
})();

export function blessingById(id: string): BlessingChoice | undefined {
  return CHOICES_BY_ID.get(id as BlessingId);
}

export function blessingChoice(tier: number, path: BlessingPath): BlessingChoice | undefined {
  const record = blessingsData.records.find((entry) => entry.tier === tier);
  if (!record) return undefined;
  const choice = record.choices.find((entry) => entry.path === path);
  if (!choice) return undefined;
  return toChoice(tier, choice, record.source as SourceReference);
}

export function indexActiveBlessings(
  blessings: readonly BlessingChoice[],
): ReadonlyMap<BlessingId, BlessingChoice> {
  return new Map(blessings.map((choice) => [choice.id, choice]));
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
