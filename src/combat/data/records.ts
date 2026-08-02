import type { RegionId } from "../../league";
import type { CombatStyle, SourceReference } from "../types";

/**
 * Record types for the canonical combat datasets in `data/combat/`.
 * Those JSON files are written by the sync scripts only — never hand-edited —
 * and this file is the single type contract for them. Ingestion supplies
 * candidate facts; the engine keeps the verified mechanical rules, so records
 * carry sourced facts (numbers, unlocks, provenance), never executable math.
 */

export type UnlockType =
  | "level"
  | "quest"
  | "codex"
  | "activity"
  | "shop"
  | "drop"
  /** Retired from live game (e.g. 2026 Aura Overhaul combat auras). */
  | "removed";

export type AbilityAvailabilityKind = "global" | "regional" | "unknown" | "removed";
export type RegionRequirementMode = "any" | "all";

/** Where and how a record is obtained. `regions` names the League regions whose
 *  unlock makes it available. Empty `regions` means unknown unless `type` is
 *  `"level"` (base skill unlocks are global) — see `resolveAvailability`. */
export interface UnlockInfo {
  type: UnlockType;
  requirement?: string;
  regions: RegionId[];
  /** Explicit stamp; when set, overrides region/type inference. */
  availability?: AbilityAvailabilityKind;
  /** Multi-region requirement: any (default) or all listed regions. */
  regionMode?: RegionRequirementMode;
}

interface CombatRecordBase {
  /** Stable id, `style:kebab-name` for abilities, shared with the icon manifest. */
  id: string;
  name: string;
  /** Every record carries provenance; `verifiedAt` is mandatory on each entry. */
  sources: SourceReference[];
  unlock?: UnlockInfo;
  /** Normalized summary, not copied source prose. */
  displayDescription?: string;
  /** Set alongside displayDescription when tooltip text and mechanic diverge. */
  mechanicalImplementation?: string;
}

export type AbilityCategory = "basic" | "enhanced" | "ultimate" | "utility";

export interface AbilityRecord extends CombatRecordBase {
  /** "shared" for all-style abilities (Sacrifice is a Constitution ability). */
  style: CombatStyle | "shared";
  category: AbilityCategory;
  level: number;
  /** Per-ability adrenaline is data, never a global constant. */
  adrenaline: { kind: "gain" | "cost"; percent: number };
  /** Absent when no sourced cooldown exists — never infer one. */
  cooldownTicks?: number;
  channelTicks?: number;
  hits?: number;
  /** Ability-damage range, parsed from sourced text by the sync script. */
  damagePercent?: [min: number, max: number];
  averageDamagePercent?: number;
  /** EffectRecord ids for attached mechanics (flows, burns, state interactions). */
  effects?: string[];
}

export type EquipmentSlot =
  | "mainhand"
  | "offhand"
  | "twohand"
  | "helmet"
  | "body"
  | "legs"
  | "gloves"
  | "boots"
  | "cape"
  | "amulet"
  | "ring"
  | "pocket"
  | "ammo";

export type ItemPassiveId =
  | "jaws-of-the-abyss"
  | "abyssal-parasite"
  | "am-zi"
  | "am-hej"
  | "enduring-ruin"
  | "reaver-ring"
  | "champion-ring"
  | "stalker-ring"
  | "channeller-ring"
  | "defender-accuracy"
  /** Masterwork Spear of Annihilation: +50% eligible melee bleed duration (floor). */
  | "masterwork-spear-bleed-extension"
  // Recorded but not modelled: both are stochastic with their own internal
  // cooldown, and neither has a settled place in the modifier pipeline.
  | "asylum-surgeon"
  | "deathtouch-reflect";

export type WeaponClass = "bow" | "crossbow" | "thrown" | "other";

/** Armour classification driving the stat-tier offsets (tank t, power t−5, hybrid t−15, PvP t). */
export type ArmourClass = "tank" | "power" | "hybrid" | "pvp";

export interface EquipmentBonuses {
  damage?: number;
  accuracy?: number;
  armour?: number;
  prayer?: number;
  /** Tank LP bonus when the wiki Infobox Bonuses sources it. */
  life?: number;
  critChance?: number;
}

export interface EquipmentRecord extends CombatRecordBase {
  slot?: EquipmentSlot;
  tier?: number;
  style?: CombatStyle | "hybrid";
  bonuses: EquipmentBonuses;
  /** Set membership, passive and special attack reference EffectRecord ids. */
  setId?: string;
  passiveId?: ItemPassiveId;
  weaponClass?: WeaponClass;
  /** Wear/wield requirement when it diverges from the stat tier (Vestments: 95). */
  requirementTier?: number;
  /** Armour stat tier when it diverges (chainbodies/med helms/sq shields at −2, Vestments 70). */
  armourTier?: number;
  /** Damage stat tier when it diverges (Vestments 110; jewellery tiers). */
  damageTier?: number;
  /** Life stat tier for exceptional power armour (Nex 75, masterwork magic/ranged 95). */
  lifeTier?: number;
  armourClass?: ArmourClass;
  /** Shields are stored in the offhand slot; this marks them. */
  shield?: boolean;
  /** Defender/repriser/rebounder: defensive hybrid, half-tier off-hand damage, full-tier accuracy. */
  defender?: boolean;
  /** Melee ammo-harness items carry the 0.26875 damage multiplier. */
  meleeAmmoHarness?: boolean;
  specialAttackId?: string;
}

export type EffectKind =
  | "passive"
  | "set-bonus"
  | "special-attack"
  | "buff"
  | "debuff"
  | "prayer-effect"
  | "perk-effect";

export interface EffectRecord extends CombatRecordBase {
  kind: EffectKind;
  /** Normalized sourced fact lines, e.g. "+20% crit damage", "2 hits". */
  facts: string[];
}

export interface PrayerRecord extends CombatRecordBase {
  /** Seren prayers are a seven-prayer Ancient Curses extension (catalogue model note). */
  book: "standard" | "ancient" | "seren";
  /** Absent when the corpus does not source one. */
  level?: number;
  drainRatePerMinute?: number;
  facts: string[];
}

/** Target focus for a recommended bar (app ships single-target only). */
export type RevolutionTarget = "single" | "multi";
/** revo++ = all ability types auto; basics = PvME starter bar; hybrid = revo prefix + keybinds. */
export type RevolutionMode = "revo++" | "basics" | "hybrid";

/** A recommended Revolution bar (PvME single-target primary). */
export interface RevolutionBarRecord extends CombatRecordBase {
  style: CombatStyle;
  setup: string;
  /** single-target vs multi-target; app catalogue is single only. */
  target: RevolutionTarget;
  /** Full Revo++ vs PvME basics-only vs hybrid revo-size-N. */
  mode: RevolutionMode;
  /** Short UI subtitle (e.g. "PvME ST · Ful arrow"). */
  label?: string;
  /** Setup notes from the source guide (config, auto-cast, conjure priority). */
  notes?: string[];
  /** How many slots Revolution manages on this bar. */
  revolutionSize: number;
  /** Slot names as sourced; abilityId is null when the slot is unmodelled. */
  slots: Array<{ name: string; abilityId: string | null }>;
  /** Swap notes for locked greater variants. */
  replacements: Array<{ from: string; to: string }>;
  supported: boolean;
  unsupportedReason?: string;
}

export interface PerkRecord extends CombatRecordBase {
  maxRank: number;
  facts: string[];
}

/** Shared envelope for every data/combat/*.json dataset. */
export interface CombatDataset<T> {
  lastSynced: string | null;
  trackedSince: "2024-03-04";
  records: T[];
}

export type TrackedEntityKind = "ability" | "equipment" | "effect" | "perk" | "prayer" | "backlog";

/** One row of the update-index.json tracked-entity ledger. */
export interface UpdateIndexEntry {
  entityId: string;
  kind: TrackedEntityKind;
  wikiPage?: string;
  lastRevid: number | null;
  lastVerifiedAt: string | null;
  /** Set by sync-combat-data when the Wiki page was revised after lastVerifiedAt. */
  stale?: boolean;
}

export type UpdateIndex = CombatDataset<UpdateIndexEntry>;
