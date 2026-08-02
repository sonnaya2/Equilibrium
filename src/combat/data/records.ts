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

/** Where and how a record is obtained. `regions` names the League regions whose
 *  unlock makes it available. Empty `regions` means unverified/unknown availability
 *  for equipment loadout display until stamped — not affirmed base-game. */
export interface UnlockInfo {
  type: UnlockType;
  requirement?: string;
  regions: RegionId[];
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
  | "channeller-ring";

export type WeaponClass = "bow" | "crossbow" | "thrown" | "other";

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
