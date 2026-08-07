import blessingsData from "#shard/league/blessings.json";
import type { SourceReference } from "@/combat/types";
import {
  assertBlessingsDocument,
  collectBlessingIds,
  type BlessingChoiceRecord,
  type BlessingTierRecord,
  type BlessingTierPassive as BlessingTierPassiveRecord,
} from "./blessingSchema";

/**
 * Blessing domain over data/league/blessings.json (paths, god tiers, reset count).
 * God tiers 4/8: segment of 3 path picks (4 <- 1-3, 8 <- 5-7); 2+ same path wins
 * that god, one of each -> Balance. Alignment only; cards from the same records.
 */

assertBlessingsDocument(blessingsData);

export const BLESSING_PATHS = ["Order", "Balance", "Chaos"] as const;
export type BlessingPath = (typeof BLESSING_PATHS)[number];

export type GodTierAlignment = BlessingPath;

/** Compile-time closed set - runtime catalogue is asserted against the shard. */
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
  "higher-power",
  "true-equilibrium",
  "havoc-born",
  "lord-of-light",
  "tearing-thorns",
  "unholy-critual",
  "tempered-heart",
  "envenomed",
  "perfidious",
  "genesis-essence",
  "power-archive",
  "chaotic-insight",
] as const;
export type BlessingId = (typeof KNOWN_BLESSING_IDS)[number];

export const BLESSING_IDS = collectBlessingIds(blessingsData) as readonly BlessingId[];

/**
 * `scenario-dependent`: mechanic is implemented but needs a user scenario input
 * (not a calculated zero). Distinct from `not-modeled`.
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
  /** Minimum effective tier for equipped weapon profiles. */
  weaponTierOverride?: number;
  setPieceContributionMultiplier?: number;
  baseAbilityDamageArmourPercent?: number;
  defenderArmourMultiplier?: number;
  shieldArmourMultiplier?: number;
  damageMultiplier?: number;
  maximumLifeMultiplier?: number;
  armourMultiplier?: number;
  maxLifeDamagePercent?: number;
  maximumAdrenaline?: number;
  adrenalineGenerationMultiplier?: number;
  basicDamageMultiplier?: number;
  light?: {
    cooldownTicks: number;
    abilityDamageBand: readonly [number, number];
    armourPercent: number;
    strikes?: number;
    maxTargetsPerStrike?: number;
    prayerDamagePerBonus?: number;
    healFraction?: number;
  };
  passiveAdrenaline?: { intervalTicks: number; amount: number };
  perHitAbilityDamagePercent?: number;
  inferno?: { chance: number; abilityDamageBand: readonly [number, number] };
  barkscales?: {
    armourReductionPercent: number;
    reductionsPerTrigger: number;
    graspAbilityDamageBand: readonly [number, number];
    graspMaxTargets: number;
  };
  procChance?: number;
  freeCastDurationTicks?: number;
  cooldownMultiplier?: number;
  areaDamageBonus?: number;
  aoePerSizeBonus?: number;
  useTargetWeakness?: boolean;
  poisonDamageBaseBonus?: number;
  poisonDamagePerHerbloreLevel?: number;
  poisonImmunityDisableTicks?: number;
  prayerBonusPerUniquePath?: number;
  strikingLightCooldownTicks?: number;
}

export type BlessingTierPassive = BlessingTierPassiveRecord;

/** The source root retains this slot list for compatibility; public God numbers live on records. */
export const GOD_TIER_SLOTS: readonly number[] = blessingsData.godTiers;
export const GOD_TIERS: readonly number[] = blessingsData.records
  .filter((record) => record.godTier !== null)
  .map((record) => record.godTier as number);
export const BLESSING_RESET_COUNT: number = blessingsData.resetCount;
export const PROGRESSION_SLOTS: readonly number[] = blessingsData.records.map(
  (record) => record.progressionSlot,
);
const PATH_RECORDS = blessingsData.records.filter((record) => record.godTier === null);
export const PATH_PROGRESSION_SLOTS: readonly number[] = PATH_RECORDS.map(
  (record) => record.progressionSlot,
);
export const BLESSING_TIERS: readonly number[] = PATH_RECORDS.map(
  (record) => record.tier as number,
);

/** Tiers where a path is picked - god tiers grant, they are not picked. */
export const PATH_TIERS: readonly number[] = BLESSING_TIERS;

export interface BlessingChoice {
  id: BlessingId;
  name: string;
  path: BlessingPath;
  progressionSlot: number;
  tier: number;
  effects: readonly string[];
  verified: boolean;
  support: BlessingSupport;
  combat: BlessingCombatRules;
  source: SourceReference;
}

/** Stable pick row for persistence / share links (path history + resolved id). */
export interface StableBlessingSelection {
  progressionSlot: number;
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
  record: Pick<BlessingTierRecord, "progressionSlot" | "tier">,
  choice: BlessingChoiceRecord,
  source: SourceReference,
): BlessingChoice | undefined {
  if (!isBlessingId(choice.id) || !isBlessingPath(choice.path)) return undefined;
  return {
    id: choice.id,
    name: choice.name,
    path: choice.path,
    progressionSlot: record.progressionSlot,
    tier: record.tier as number,
    effects: choice.effects,
    verified: choice.verified === true,
    support: choice.support as BlessingSupport,
    combat: choice.combat as BlessingCombatRules,
    source,
  };
}

/** All revealed/unrevealed choices keyed by stable id (last write wins on collision). */
export const CHOICES_BY_ID: ReadonlyMap<BlessingId, BlessingChoice> = (() => {
  const map = new Map<BlessingId, BlessingChoice>();
  for (const record of blessingsData.records) {
    const source = record.source as SourceReference;
    for (const choice of record.choices) {
      if (record.tier === null) continue;
      const resolved = toChoice(record, choice as BlessingChoiceRecord, source);
      if (resolved) map.set(resolved.id, resolved);
    }
  }
  return map;
})();

export function blessingById(id: string): BlessingChoice | undefined {
  return CHOICES_BY_ID.get(id as BlessingId);
}

export function blessingChoice(tier: number, path: BlessingPath): BlessingChoice | undefined {
  const record = PATH_RECORDS.find((entry) => entry.tier === tier);
  if (!record || record.tier === null) return undefined;
  const choice = record.choices.find((entry) => entry.path === path);
  if (!choice) return undefined;
  return toChoice(record, choice as BlessingChoiceRecord, record.source as SourceReference);
}

export function godTierChoice(godTier: number, path: BlessingPath): BlessingChoice | undefined {
  const record = blessingsData.records.find((entry) => entry.godTier === godTier);
  if (!record || record.tier !== null) return undefined;
  const choice = record.choices.find((entry) => entry.path === path);
  if (!choice) return undefined;
  const resolved = toChoice(
    record,
    choice as BlessingChoiceRecord,
    record.source as SourceReference,
  );
  return resolved ? { ...resolved, tier: godTier } : undefined;
}

export function indexActiveBlessings(
  blessings: readonly BlessingChoice[],
): ReadonlyMap<BlessingId, BlessingChoice> {
  return new Map(blessings.map((choice) => [choice.id, choice]));
}

export function blessingTierRevealed(tier: number): boolean {
  return PATH_RECORDS.find((entry) => entry.tier === tier)?.revealed === true;
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
    const choice = alignment ? godTierChoice(godTier, alignment) : undefined;
    if (choice) active.push(choice);
  }
  return active;
}

export type ActiveBlessingTierPassive = BlessingTierPassive & {
  progressionSlot: number;
  tier: number | null;
  godTier: number | null;
};

export function activeTierPassives(picks: readonly BlessingPath[]): ActiveBlessingTierPassive[] {
  const active: ActiveBlessingTierPassive[] = [];
  for (const record of blessingsData.records) {
    const pathCountBefore = blessingsData.records.filter(
      (candidate) =>
        candidate.godTier === null && candidate.progressionSlot < record.progressionSlot,
    ).length;
    const unlocked =
      record.godTier === null
        ? picks.length >= pathCountBefore + 1
        : picks.length >= pathCountBefore;
    if (!unlocked) continue;
    for (const passive of record.passives as readonly BlessingTierPassive[]) {
      active.push({
        ...passive,
        progressionSlot: record.progressionSlot,
        tier: record.tier,
        godTier: record.godTier,
      });
    }
  }
  return active;
}
