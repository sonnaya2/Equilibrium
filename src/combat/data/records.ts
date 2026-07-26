import type { RegionId } from "../../league";
import type { CombatStyle, SourceReference } from "../types";

/**
 * Record types for the canonical combat datasets in `data/combat/`.
 * Those JSON files are written by the sync scripts only — never hand-edited —
 * and this file is the single type contract for them. Ingestion supplies
 * candidate facts; the engine keeps the verified mechanical rules, so records
 * carry sourced facts (numbers, unlocks, provenance), never executable math.
 */

export type UnlockType = "level" | "quest" | "codex" | "activity" | "shop" | "drop";

/** Where and how a record is obtained. `regions` names the League regions whose
 *  unlock makes it available; an empty list means base-game availability. */
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
  /** Our own normalized words — never copied source prose. */
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
  | "ammo"
  | "aura";

export interface EquipmentBonuses {
  damage?: number;
  accuracy?: number;
  armour?: number;
  prayer?: number;
  critChance?: number;
}

export interface EquipmentRecord extends CombatRecordBase {
  /** Absent when the corpus does not source it — never inferred from vibes. */
  slot?: EquipmentSlot;
  tier?: number;
  style?: CombatStyle | "hybrid";
  bonuses: EquipmentBonuses;
  /** Set membership, passive and special attack reference EffectRecord ids. */
  setId?: string;
  passiveId?: string;
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

/** A recommended Revolution++ bar (RuneScape Wiki, post-modernisation). */
export interface RevolutionBarRecord extends CombatRecordBase {
  style: CombatStyle;
  setup: string;
  /** How many slots Revolution manages on this bar (the wiki's own number). */
  revolutionSize: number;
  /** Slot names as the wiki lists them; abilityId is null when no sourced record
   *  or engine spec exists — that slot is unmodelled, never invented. */
  slots: Array<{ name: string; abilityId: string | null }>;
  /** The wiki's swap notes for locked greater variants. */
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
