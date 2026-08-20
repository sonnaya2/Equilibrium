import {
  MAX_CONSTITUTION_LEVEL,
  MAX_DEFENCE_LEVEL,
  MAX_FIREMAKING_LEVEL,
  POWERBURST_COOLDOWN_MS,
  POWERBURST_DURATION_MS,
  type OverhealKind,
} from "@/combat";
import { equipmentById } from "@/combat/data";
import type { EquipmentSlot } from "@/combat/data/records";
import { hasEssenceOfFinalityEquipped } from "@/combat/shared/requirements";
import { normalizeSavedEquipmentId, normalizeSelectedAmmunitionId } from "./ammunitionSelection";
import {
  isRelicGrantedItemAvailable,
  relicGrantedItemForRelic,
  stripUnavailableRelicItems,
} from "@/combat/league/relicGrantedItems";
import {
  isRelicActive,
  MONOLITH_ENERGY_ANTIQUARIAN,
  MONOLITH_ENERGY_DEFAULT,
  MONOLITH_ENERGY_EXTENDED,
  hasAntiquarianLeagueRelic,
  relicById,
  sanitizeSelectedRelics,
  tryToggleArchaeologyRelic,
  type ArchaeologyToggleResult,
  type MonolithEnergyCap,
} from "@/combat/shared/archaeologyRelics";
import { HEIGHTENED_SENSES_ADRENALINE_BONUS } from "@/combat/shared/heightenedSenses";
import {
  activeEquipmentEffects,
  EQUIPMENT_ENCHANTMENTS,
  resolvedEquipmentSlots,
  wieldedOffhandKind,
  type EquipmentEnchantmentId,
  type LoadoutEquipmentView,
} from "@/combat/shared/equipment";
import { normalizeSlayerHelmetStand, type SlayerHelmetTierId } from "@/combat/shared/slayerHelmet";
import {
  normalizeKwuarmPotency,
  normalizeWeaponPoisonChoice,
  type KwuarmPotency,
  type WeaponPoisonChoice,
} from "@/combat/poison/mechanics";
import { STYLE_CURSES as STYLE_CURSE_BOOSTS, styleCurseById } from "@/combat/shared/prayers";
import { targetPresetById } from "@/combat/data";
import {
  emptyPowerArchiveState,
  normalizePowerArchiveState,
  type PowerArchiveState,
} from "@/combat/league/powerArchive";
import {
  isAffinityKind,
  resolveAffinityPercent,
  sanitizeAffinity,
} from "@/combat/target/genericTarget";
import { materializeTargetPreset, targetDiffersFromPreset } from "@/combat/target/presetAdapter";
import type { CombatStyle } from "@/combat/types";
import type { RegionId } from "@/league";

/** Setup-written combat loadout (Rotation/Analysis read). localStorage key below; old shapes normalize. */

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  "mainhand",
  "offhand",
  "twohand",
  "helmet",
  "body",
  "legs",
  "gloves",
  "boots",
  "cape",
  "amulet",
  "ring",
  "pocket",
  "ammo",
] as const;

const SLOT_SET = new Set<string>(EQUIPMENT_SLOTS);

export interface LoadoutTarget {
  defenceLevel: number;
  armour?: number;
  /** Exact affinity percent (1-100). Legacy kind strings migrate on load. */
  affinity: number;
  /**
   * Catalogue preset id when this target was applied from a boss preset.
   * Materialized fields remain authoritative if the preset is renamed or removed.
   */
  targetPresetId?: string;
  /** Exact weakness affinity from a preset; used by Demon's Mark when applicable. */
  weaknessAffinity?: number;
  additiveHitChance?: number;
  damagePotentialOverride?: number;
  /** Optional target life-points % (0-100) for HP-dependent mechanics; absent = unavailable. */
  hpPercent?: number;
  /** Optional maximum LP for Death Mark execution assessment. */
  maximumLifePoints?: number;
  hasApplicableWeakness?: boolean;
  elementalWeakness?: "water" | "fire" | "other" | "unknown";
  dragonfireImmune?: boolean;
  /** NPC size config used by mechanics such as Splash Zone. */
  size?: number;
  /** Spatial footprint reserved for mechanics that inspect occupied coverage. */
  occupiedTiles?: number;
  /** Targets expected in one area hit, including the selected target. */
  areaTargets?: number;
  /** Race flags for Undead / Demon / Dragon Slayer invention perks. */
  undead?: boolean;
  demon?: boolean;
  dragon?: boolean;
  /**
   * Current Slayer assignment (scenario). Independent of undead race.
   * Gates Full Slayer Helmet damage/accuracy.
   */
  onSlayerTask?: boolean;
  /** Poison-immune targets take no Grasp of Guthix damage; absent = poisonable. */
  poisonImmune?: boolean;
  /** Seconds between qualifying incoming hits; omit when no incoming scenario. */
  incomingHitIntervalSeconds?: number;
  /** Optional assumed hit size for Icyenic 100% protect mitigation totals. */
  incomingHitDamage?: number;
}

export interface BaseDamageSettings {
  mode: "automatic";
}

/** Stored weapon shape. Shield / defender are set from equipped gear (not the manual select). */
export type LoadoutWeaponConfiguration =
  "twohand" | "dualwield" | "mainhand" | "shield" | "defender";

export interface LoadoutPerks {
  equilibrium: number;
  eruptive: number;
  biting: number;
  /** Item level 20 gear: Biting uses +2.2%/rank instead of +2%. */
  bitingLevel20: boolean;
  /** Invigorating: basic adren gain × (1 + 0.05×rank). Rank 0 = off. */
  invigorating: number;
  /** Impatient: EV extra adren on basics (chance×3). Rank 0 = off. */
  impatient: number;
  /** Item level 20 gear: Impatient uses 9.9%/rank instead of 9%. */
  impatientLevel20: boolean;
  ultimatums: number;
  lunging: number;
  /** Caroming: Ricochet +4% ability damage per rank per hit. Rank 0 = off, max 4. */
  caroming: number;
  energising: number;
  /** Crackling: PvM zap 50% AD × rank, 60s CD. Rank 0 = off, max 4. */
  crackling: number;
  /** Aftershock: AoE after 50k damage, avg 31.8% AD × rank, 6s min. Rank 0 = off, max 4. */
  aftershock: number;
  /** Relentless cost refund with its 30s lockout. Rank 0 = off, max 5. */
  relentless: number;
  relentlessLevel20: boolean;
  /** Precise: raises min hit by 1.5% of max per rank. Rank 0 = off, max 6. */
  precise: number;
  /** Flanking: listed stuns; +40%/rank when target is not facing the player. */
  flanking: number;
  /** Shield Bashing: Debilitate damage +15%/rank. */
  shieldBashing: number;
  /** Spendthrift: rank% chance of rank% extra damage. */
  spendthrift: number;
  /** Ruthless: kill-stack damage; stacks come from buffs.ruthlessStacks. */
  ruthless: number;
  /** Planted Feet: base Sunshine / Death's Swiftness ×1.25 duration. Rank 0/1. */
  plantedFeet: number;
  /** Race slayer perks: +7% damage when the target matches. Rank 0/1. */
  demonSlayer: number;
  dragonSlayer: number;
  undeadSlayer: number;
}

/**
 * Gizmo-placeable perk ranks. Display-only placement: engine reads `perks`, not `gizmos`.
 * Kind compatibility is PERK_GIZMO_KIND.
 */
export type PerkRankKey = {
  [K in keyof LoadoutPerks]: LoadoutPerks[K] extends number ? K : never;
}[keyof LoadoutPerks];

/** Wiki gizmo compatibility for the modeled perks. Ancient variants share their base kind. */
export const PERK_GIZMO_KIND: Record<PerkRankKey, "weapon" | "armour" | "both"> = {
  equilibrium: "both",
  eruptive: "weapon",
  biting: "both",
  invigorating: "both",
  impatient: "both",
  ultimatums: "both",
  lunging: "weapon",
  caroming: "weapon",
  energising: "both",
  crackling: "both",
  aftershock: "weapon",
  relentless: "both",
  precise: "weapon",
  flanking: "weapon",
  shieldBashing: "both",
  spendthrift: "weapon",
  ruthless: "weapon",
  plantedFeet: "weapon",
  demonSlayer: "both",
  dragonSlayer: "both",
  undeadSlayer: "both",
};

export const GIZMO_SLOTS = ["weapon1", "weapon2", "armour1", "armour2"] as const;
export type GizmoSlotId = (typeof GIZMO_SLOTS)[number];

/** Default / weapon shell capacity (two perks). Prefer `gizmoCapacity(slot)`. */
export const GIZMO_CAPACITY = 2;
/** Armour shells (body + legs) show four perk rows each. */
export const ARMOUR_GIZMO_CAPACITY = 4;

/** Perk slots on a gizmo shell: weapons 2, armour 4. */
export function gizmoCapacity(slot: GizmoSlotId): number {
  return slot.startsWith("armour") ? ARMOUR_GIZMO_CAPACITY : GIZMO_CAPACITY;
}

export type GizmoLayout = Partial<Record<GizmoSlotId, PerkRankKey[]>>;

export function gizmoAccepts(slot: GizmoSlotId, perk: PerkRankKey): boolean {
  const kind = PERK_GIZMO_KIND[perk];
  return kind === "both" || slot.startsWith(kind);
}

export type OverloadChoice = "none" | "overload" | "supreme" | "elder";
export type OverhealChoice = "none" | OverhealKind;
export const BONFIRE_LOGS = [
  { value: "normal", label: "Normal logs", minutes: 6 },
  { value: "achey", label: "Achey tree logs", minutes: 6 },
  { value: "oak", label: "Oak logs", minutes: 12 },
  { value: "willow", label: "Willow logs", minutes: 18 },
  { value: "teak", label: "Teak logs", minutes: 24 },
  { value: "arctic-pine", label: "Arctic pine logs", minutes: 30 },
  { value: "corrupted-magic", label: "Corrupted magic logs", minutes: 30 },
  { value: "maple", label: "Maple logs", minutes: 36 },
  { value: "acadia", label: "Acadia logs", minutes: 38 },
  { value: "mahogany", label: "Mahogany logs", minutes: 42 },
  { value: "eucalyptus", label: "Eucalyptus logs", minutes: 48 },
  { value: "yew", label: "Yew logs", minutes: 54 },
  { value: "magic", label: "Magic logs", minutes: 60 },
  { value: "blisterwood", label: "Blisterwood logs", minutes: 60 },
  { value: "cursed-magic", label: "Cursed magic logs", minutes: 60 },
  { value: "elder", label: "Elder logs", minutes: 66 },
  { value: "protean", label: "Protean logs", minutes: 66 },
  { value: "driftwood", label: "Driftwood", minutes: 66 },
  { value: "eternal-magic", label: "Eternal magic logs", minutes: 72 },
] as const;
export type BonfireLogType = (typeof BONFIRE_LOGS)[number]["value"];
/** Damage prayer id (standard book + Ancient Curses). Storage key remains styleCurse. */
export type StyleCurseChoice =
  | "none"
  | "piety"
  | "rigour"
  | "augury"
  | "sanctity"
  | "turmoil"
  | "anguish"
  | "torment"
  | "sorrow"
  | "malevolence"
  | "desolation"
  | "affliction"
  | "ruination";

export interface LoadoutBuffs {
  /** Revo++ fires a supported special from the resolved native weapon. */
  useEquippedWeaponSpecial: boolean;
  /**
   * When set, auto weapon / EoF special only fires after this bar ability
   * has been cast on the current revo pass (id match).
   */
  weaponSpecialAfterAbilityId: string | null;
  vulnerability: boolean;
  weaponPoison: WeaponPoisonChoice;
  kwuarmPotency: KwuarmPotency;
  herbloreLevel: number;
  styleCurse: StyleCurseChoice;
  overload: OverloadChoice;
  fortitude: boolean;
  reaperCrew: boolean;
  fontOfLife: boolean;
  boonOfHet: boolean;
  /** Log type determines the bonfire boost duration; null means no bonfire. */
  bonfireLogType: BonfireLogType | null;
  /** Active bonfire amount source; null means no bonfire boost. */
  bonfireFiremakingLevel: number | null;
  totemOfVitality: boolean;
  thermalBath: boolean;
  overheal: OverhealChoice;
  /** Epoch expiry keeps the six-second Powerburst window temporary across reloads. */
  powerburstOfVitalityUntil: number | null;
  /** Epoch expiry for the sourced two-minute global powerburst cooldown. */
  powerburstOfVitalityCooldownUntil: number | null;
  /** Strength cape (99): Dismember +3 bleed hits. Player toggle, not auto from cape slot. */
  strengthCape99: boolean;
  /** Attack master cape (120): +2% melee hit chance while style is melee. */
  attackCape120: boolean;
  eliteSeersVillage: boolean;
  /**
   * Protection prayer or deflection curse active (scenario for Icyenic Faith
   * 100% block + Soul Split-on-protect).
   */
  protectionPrayer: boolean;
  /** Archaeology: Berserker's Fury monolith relic (damage scales with missing LP). */
  berserkersFury: boolean;
  /** Archaeology: Fury of the Small (+1% adren on adrenaline-generating basics). */
  furyOfTheSmall: boolean;
  /** Archaeology: Heightened Senses (+10 max adrenaline). */
  heightenedSenses: boolean;
  /** Archaeology: Conservation of Energy (+10 adren after ultimate). */
  conservationOfEnergy: boolean;
  /** Permanent RoV unlock (Anachronia). OR with equipped ring; does not stack. */
  ringOfVigourPassive: boolean;
  /**
   * Anachronia Slayer Lodge tier-3 helmet stand selection.
   * null = none. Same Slayer Spirit channel as a worn Full+ helm (never stacks).
   */
  slayerHelmetStand: SlayerHelmetTierId | null;
  /**
   * Permanent ensouled spectral lens upgrade on the Full Slayer Helmet line.
   * Required for Necromancy Slayer Spirit.
   */
  ensouledSpectralLens: boolean;
  /**
   * Rotation assumption: activate Sliver of Edicts at combat start (Naragi window).
   * UI only when pocket has the Sliver; cleared when unequipped.
   */
  sliverOfEdictsActive: boolean;
  /**
   * Ruthless kill stacks at fight open (0-5). Default 0 - never pre-stack silently.
   * Used only when Ruthless rank is active (equipment or Power Archive).
   */
  ruthlessStacks: number;
  /**
   * Flanking facing assumption: target is not facing the player.
   * Default false - Flanking damage only applies when explicitly enabled.
   */
  targetNotFacing: boolean;
}

/**
 * Monolith relic selection. selectedIds is the sole runtime activation source.
 * Boolean buff fields (berserkersFury, etc.) are display mirrors derived from
 * selectedIds after load; they never reactivate a relic at resolve time.
 * energyCap / over-budget: re-sanitized with build regions in ArchPanel persist
 * and in resolveCombatRules when loadoutStats receives unlockedRegions.
 */
export interface LoadoutArchaeology {
  selectedIds: string[];
  energyCap: MonolithEnergyCap;
}

/** Legacy buff keys that once toggled full-modeled relics before selectedIds. */
const FULL_ARCH_BUFF_TO_RELIC = {
  berserkersFury: "berserkers_fury",
  furyOfTheSmall: "fury_of_the_small",
  heightenedSenses: "heightened_senses",
  conservationOfEnergy: "conservation_of_energy",
} as const;

type FullArchBuffKey = keyof typeof FULL_ARCH_BUFF_TO_RELIC;

/** Compatibility/display mirrors only - always derived from selectedIds. */
export function buffsFromArchSelected(
  selectedIds: readonly string[],
): Pick<LoadoutBuffs, FullArchBuffKey> {
  return {
    berserkersFury: isRelicActive(selectedIds, "berserkers_fury"),
    furyOfTheSmall: isRelicActive(selectedIds, "fury_of_the_small"),
    heightenedSenses: isRelicActive(selectedIds, "heightened_senses"),
    conservationOfEnergy: isRelicActive(selectedIds, "conservation_of_energy"),
  };
}

function normalizeArchaeologyEnergyCap(value: unknown): MonolithEnergyCap {
  if (value === MONOLITH_ENERGY_ANTIQUARIAN) return MONOLITH_ENERGY_ANTIQUARIAN;
  if (value === MONOLITH_ENERGY_EXTENDED) return MONOLITH_ENERGY_EXTENDED;
  return MONOLITH_ENERGY_DEFAULT;
}

function normalizeArchaeologySelectedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string" || !relicById(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Parse stored archaeology.
 * Legacy true buff flags are migration input only (merged into selectedIds once).
 * After sanitize, callers must derive buff mirrors from selectedIds.
 */
export function normalizeArchaeology(
  rawArch: unknown,
  rawBuffs: Partial<LoadoutBuffs>,
): LoadoutArchaeology {
  const raw =
    typeof rawArch === "object" && rawArch !== null ? (rawArch as Partial<LoadoutArchaeology>) : {};
  const energyCap = normalizeArchaeologyEnergyCap(raw.energyCap);
  let selectedIds = normalizeArchaeologySelectedIds(raw.selectedIds);
  // One-shot migration: old saves stored full relics as buff booleans only.
  for (const [buffKey, relicId] of Object.entries(FULL_ARCH_BUFF_TO_RELIC) as [
    FullArchBuffKey,
    string,
  ][]) {
    if (rawBuffs[buffKey] === true && !selectedIds.includes(relicId)) {
      selectedIds = [...selectedIds, relicId];
    }
  }
  return {
    energyCap,
    // Omit unlockedRegions: normalize has no league context; region gate is
    // applied later via sanitizeArchaeologyState / loadoutStats options.
    selectedIds: sanitizeSelectedRelics({
      selectedIds,
      energyCap,
    }),
  };
}

/** Bump when normalizeLoadout needs a one-shot field migration. */
export const LOADOUT_SCHEMA_VERSION = 4;

/** null stored start = open at max adrenaline for this loadout. */
export function resolvedStartingAdrenaline(
  stored: number | null | undefined,
  maxAdrenaline: number,
): number {
  const cap = Number.isFinite(maxAdrenaline) ? Math.max(0, Math.round(maxAdrenaline)) : 100;
  if (stored == null || !Number.isFinite(stored)) return cap;
  return Math.min(cap, Math.max(0, Math.round(stored)));
}

/** Persist UI input; at or above max stays open-at-max (null). */
export function persistStartingAdrenaline(value: number, maxAdrenaline: number): number | null {
  const cap = Number.isFinite(maxAdrenaline) ? Math.max(0, Math.round(maxAdrenaline)) : 100;
  if (!Number.isFinite(value)) return null;
  const n = Math.min(cap, Math.max(0, Math.round(value)));
  return n >= cap ? null : n;
}

export interface Loadout {
  style: CombatStyle;
  /**
   * Non-melee style level. For melee, alias of strengthLevel (damage/crit).
   * Prefer attackLevel / strengthLevel for melee.
   */
  level: number;
  /** Melee Attack - accuracy only, retained while another style is selected. */
  attackLevel: number;
  /** Melee Strength - ability damage + crit damage-from-level. */
  strengthLevel: number;
  /** Unboosted player Defence; potion/prayer boosts resolve separately. */
  defenceLevel: number;
  /** Unboosted Constitution; current normal range is 10-99. */
  constitutionLevel: number;
  /**
   * Unboosted Agility for attuned crystal weaponry proc chance (1-99; boosts cap at 12%).
   * Default 99.
   */
  agilityLevel: number;
  /**
   * Absolute life points before Powerburst doubling.
   * null = derive from currentHealthPercent of temporary max.
   */
  currentLife: number | null;
  /** Shared current health as 0-100% of maximum LP. Default 50. */
  currentHealthPercent: number;
  weaponTier: number;
  offhandTier: number;
  spellTier: number;
  ammunitionTier: number;
  styleDamageBonus: number;
  weaponConfiguration: LoadoutWeaponConfiguration;
  baseDamage: BaseDamageSettings;
  /**
   * Opening adrenaline percent. null = open at max for this loadout
   * (Vestments 120, T4/HS 125, stacked caps). Explicit 0 is allowed (schema >=2).
   */
  startingAdrenaline: number | null;
  /**
   * Persist schema (in-JSON). Storage key stays `eq:loadout:v1`.
   * Pre-v2: startingAdrenaline defaulted to 0 (broke ultimates) and full-object
   * saves always wrote 0, so intentional zero cannot be distinguished from the
   * old default - migrate schema<2 && raw===0 to null (open at max). Post-v2:
   * user 0 is kept. Missing field uses product default null.
   */
  loadoutSchemaVersion: number;
  hitCapEnabled: boolean;
  /** Slayer skill level for Tuska's Wrath empower (with onSlayerTask). */
  slayerLevel?: number;
  accuracy: number;
  critChance: number;
  target: LoadoutTarget | null;
  perks: LoadoutPerks;
  /** Which perks the player keeps on which gizmo. Display grouping, not engine input. */
  gizmos: GizmoLayout;
  /**
   * Power Archive Automaton Control Bot gizmos (max 20).
   * Applied only when the power-archive blessing is active.
   */
  powerArchive: PowerArchiveState;
  buffs: LoadoutBuffs;
  /** Archaeology monolith powers (selection + energy budget). */
  archaeology: LoadoutArchaeology;
  equipmentSlots: Partial<Record<EquipmentSlot, string | null>>;
  selectedAmmunitionId: string | null;
  /**
   * EoF stored special ability id (engine ability id). Required with Essence of
   * Finality for requiresSpecialAccess weapon specials. Cleared when amulet is not EoF.
   */
  eofStoredSpecialId: string | null;
  enchantments: EquipmentEnchantmentId[];
  /** Derived: slotted ids + unlock pins. */
  equipmentIds: string[];
}

export const DEFAULT_LOADOUT: Loadout = {
  style: "melee",
  // Style combat levels default to 120 (melee Attack/Strength, ranged, magic, necro).
  level: 120,
  attackLevel: 120,
  strengthLevel: 120,
  defenceLevel: 99,
  constitutionLevel: 99,
  agilityLevel: 99,
  currentLife: null,
  currentHealthPercent: 50,
  weaponTier: 90,
  offhandTier: 90,
  spellTier: 90,
  ammunitionTier: 90,
  styleDamageBonus: 0,
  weaponConfiguration: "twohand",
  baseDamage: { mode: "automatic" },
  // null = open at max adren (T4 125 / Vestments 120 / HS stack). Explicit 0 is ok.
  startingAdrenaline: null,
  loadoutSchemaVersion: LOADOUT_SCHEMA_VERSION,
  hitCapEnabled: false,
  accuracy: 100,
  // Manual crit removed from loadout UI; resolveCrit ignores this (gear/perks only).
  critChance: 0,
  target: null,
  perks: {
    equilibrium: 0,
    eruptive: 0,
    biting: 0,
    bitingLevel20: false,
    invigorating: 0,
    impatient: 0,
    impatientLevel20: false,
    ultimatums: 0,
    lunging: 0,
    caroming: 0,
    energising: 0,
    crackling: 0,
    aftershock: 0,
    relentless: 0,
    relentlessLevel20: false,
    precise: 0,
    flanking: 0,
    shieldBashing: 0,
    spendthrift: 0,
    ruthless: 0,
    plantedFeet: 0,
    demonSlayer: 0,
    dragonSlayer: 0,
    undeadSlayer: 0,
  },
  gizmos: {},
  powerArchive: emptyPowerArchiveState(),
  buffs: {
    useEquippedWeaponSpecial: false,
    weaponSpecialAfterAbilityId: null,
    vulnerability: false,
    weaponPoison: "none",
    kwuarmPotency: 0,
    herbloreLevel: 99,
    styleCurse: "none",
    overload: "none",
    fortitude: false,
    reaperCrew: false,
    fontOfLife: false,
    boonOfHet: false,
    bonfireLogType: null,
    bonfireFiremakingLevel: null,
    totemOfVitality: false,
    thermalBath: false,
    overheal: "none",
    powerburstOfVitalityUntil: null,
    powerburstOfVitalityCooldownUntil: null,
    strengthCape99: false,
    attackCape120: false,
    eliteSeersVillage: false,
    protectionPrayer: false,
    berserkersFury: false,
    furyOfTheSmall: false,
    heightenedSenses: false,
    conservationOfEnergy: false,
    ringOfVigourPassive: false,
    slayerHelmetStand: null,
    ensouledSpectralLens: false,
    sliverOfEdictsActive: false,
    ruthlessStacks: 0,
    targetNotFacing: false,
  },
  archaeology: {
    selectedIds: [],
    energyCap: MONOLITH_ENERGY_DEFAULT,
  },
  equipmentSlots: {},
  selectedAmmunitionId: null,
  eofStoredSpecialId: null,
  enchantments: [...EQUIPMENT_ENCHANTMENTS],
  equipmentIds: [],
};

export const LOADOUT_STORAGE_KEY = "eq:loadout:v1";
const STYLES = ["melee", "ranged", "magic", "necromancy"];
const STYLE_CURSES: StyleCurseChoice[] = [
  "none",
  "piety",
  "rigour",
  "augury",
  "sanctity",
  "turmoil",
  "anguish",
  "torment",
  "sorrow",
  "malevolence",
  "desolation",
  "affliction",
  "ruination",
];
const OVERLOADS: OverloadChoice[] = ["none", "overload", "supreme", "elder"];
const OVERHEALS: OverhealChoice[] = [
  "none",
  "rocktail-line",
  "soup-line",
  "saradomin-brew",
  "super-saradomin-brew",
];
const BONFIRE_LOG_TYPE_SET = new Set<string>(BONFIRE_LOGS.map(({ value }) => value));
const GIZMO_SLOT_SET = new Set<string>(GIZMO_SLOTS);
/** Rank-valued perk keys, from the default loadout so the two never drift. */
export const PERK_RANK_KEYS = Object.entries(DEFAULT_LOADOUT.perks)
  .filter(([, value]) => typeof value === "number")
  .map(([key]) => key as PerkRankKey);
const PERK_RANK_KEY_SET = new Set<string>(PERK_RANK_KEYS);

/** Slot holding a perk, or null. A perk lives on at most one gizmo. */
export function gizmoSlotOf(gizmos: GizmoLayout, perk: PerkRankKey): GizmoSlotId | null {
  for (const slot of GIZMO_SLOTS) {
    if (gizmos[slot]?.includes(perk)) return slot;
  }
  return null;
}

/** Place a perk on a gizmo, removing it from any other slot. Full slots reject. */
export function placePerkOnGizmo(loadout: Loadout, slot: GizmoSlotId, perk: PerkRankKey): Loadout {
  if (!gizmoAccepts(slot, perk)) return loadout;
  const gizmos: GizmoLayout = {};
  for (const id of GIZMO_SLOTS) {
    const held = (loadout.gizmos?.[id] ?? []).filter((p) => p !== perk);
    if (held.length) gizmos[id] = held;
  }
  const target = gizmos[slot] ?? [];
  if (target.length >= gizmoCapacity(slot)) return loadout;
  gizmos[slot] = [...target, perk];
  return { ...loadout, gizmos };
}

export function removePerkFromGizmos(loadout: Loadout, perk: PerkRankKey): Loadout {
  const gizmos: GizmoLayout = {};
  for (const id of GIZMO_SLOTS) {
    const held = (loadout.gizmos?.[id] ?? []).filter((p) => p !== perk);
    if (held.length) gizmos[id] = held;
  }
  return { ...loadout, gizmos };
}

function normalizeGizmos(raw: unknown): GizmoLayout {
  if (typeof raw !== "object" || raw === null) return {};
  const out: GizmoLayout = {};
  // A perk on two gizmos would double its rank in the readout - first slot wins.
  const claimed = new Set<string>();
  for (const slot of GIZMO_SLOTS) {
    const value = (raw as Record<string, unknown>)[slot];
    if (!GIZMO_SLOT_SET.has(slot) || !Array.isArray(value)) continue;
    const held: PerkRankKey[] = [];
    for (const entry of value) {
      if (typeof entry !== "string") continue;
      if (!PERK_RANK_KEY_SET.has(entry) || claimed.has(entry)) continue;
      if (!gizmoAccepts(slot, entry as PerkRankKey)) continue;
      claimed.add(entry);
      held.push(entry as PerkRankKey);
      if (held.length >= gizmoCapacity(slot)) break;
    }
    if (held.length) out[slot] = held;
  }
  return out;
}

const clampRank = (value: unknown, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(0, Math.floor(Number(value))), max) : 0;
/** Rank-1 toggles; accept old boolean saves. */
const legacyToggleRank = (value: unknown) =>
  value === true ? 1 : value === false || value == null ? 0 : clampRank(value, 1);
const num = (value: unknown, fallback: number) =>
  Number.isFinite(value) ? Number(value) : fallback;
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, num(value, fallback)));

/** Parse affinity: exact percent or legacy kind string. Null if unusable. */
function parseLoadoutAffinity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return sanitizeAffinity(value);
  if (isAffinityKind(value)) return resolveAffinityPercent(value);
  return null;
}

/** Non-empty string ids currently in slots (order follows EQUIPMENT_SLOTS). */
export function equipmentIdList(
  slots: Partial<Record<EquipmentSlot, string | null>> | undefined,
): string[] {
  if (!slots) return [];
  return EQUIPMENT_SLOTS.map((slot) => slots[slot]).filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
}

/** Unlock pins: equipmentIds entries not occupying a doll slot. */
export function unlockOnlyIds(loadout: Loadout): string[] {
  const slotted = new Set(equipmentIdList(loadout.equipmentSlots));
  return (loadout.equipmentIds ?? []).filter((id) => !slotted.has(id));
}

function mergeEquipmentIds(
  slots: Partial<Record<EquipmentSlot, string | null>>,
  unlocks: string[],
): string[] {
  const out = equipmentIdList(slots);
  const seen = new Set(out);
  for (const id of unlocks) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}

/** Keep store id only when EoF is equipped and the string is non-empty. */
export function normalizeEofStoredSpecialId(
  equipmentIds: readonly string[] | undefined,
  raw: unknown,
): string | null {
  if (!hasEssenceOfFinalityEquipped(equipmentIds)) return null;
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return id.length > 0 ? id : null;
}

/**
 * Equip or clear one slot. Two-hand clears MH/OH; MH/OH clears two-hand.
 * When activeRelicNames is provided, relic-granted items cannot be equipped
 * without their relic (no-op leave previous loadout).
 */
export function equipInSlot(
  loadout: Loadout,
  slot: EquipmentSlot,
  itemId: string | null,
  activeRelicNames?: readonly string[] | ReadonlySet<string>,
): Loadout {
  const normalizedItemId = itemId == null ? null : normalizeSavedEquipmentId(itemId);
  if (
    normalizedItemId != null &&
    activeRelicNames !== undefined &&
    !isRelicGrantedItemAvailable(normalizedItemId, activeRelicNames)
  ) {
    return loadout;
  }
  const slots: Partial<Record<EquipmentSlot, string | null>> = {
    ...(loadout.equipmentSlots ?? {}),
  };
  if (normalizedItemId == null) {
    delete slots[slot];
  } else {
    slots[slot] = normalizedItemId;
    if (slot === "twohand") {
      delete slots.mainhand;
      delete slots.offhand;
    }
    if (slot === "mainhand" || slot === "offhand") {
      delete slots.twohand;
    }
  }
  const unlocks = unlockOnlyIds(loadout);
  const ammoRecord = equipmentById(slots.ammo ?? "");
  const equipmentIds = mergeEquipmentIds(slots, unlocks);
  const next: Loadout = {
    ...loadout,
    equipmentSlots: slots,
    selectedAmmunitionId: normalizeSelectedAmmunitionId(
      ammoRecord?.quiver != null,
      loadout.selectedAmmunitionId,
    ),
    equipmentIds,
    eofStoredSpecialId: normalizeEofStoredSpecialId(equipmentIds, loadout.eofStoredSpecialId),
    buffs:
      loadout.buffs.sliverOfEdictsActive && slots.pocket !== "item:sliver-of-edicts"
        ? { ...loadout.buffs, sliverOfEdictsActive: false }
        : loadout.buffs,
  };
  // Weapon equip owns style + weaponConfiguration from gear.
  next.weaponConfiguration = weaponConfigurationFor(next) ?? next.weaponConfiguration;
  const style = weaponStyle(slots);
  return style != null ? withCombatStyle(next, style) : next;
}

/**
 * Unequip relic-granted items whose relic is not active.
 * Call after relic toggle, load/import, and when assembling sim inputs.
 */
export function syncRelicGrantedEquipment(
  loadout: Loadout,
  activeRelicNames: readonly string[] | ReadonlySet<string> | undefined,
): Loadout {
  const slots = loadout.equipmentSlots ?? {};
  const nextSlots = stripUnavailableRelicItems(slots, activeRelicNames);
  const slotsChanged = nextSlots !== slots;
  const pocket = nextSlots.pocket;
  const sliverStillOn = typeof pocket === "string" && pocket === "item:sliver-of-edicts";
  const clearSliverActive = !sliverStillOn && loadout.buffs.sliverOfEdictsActive;
  if (!slotsChanged && !clearSliverActive) return loadout;
  const unlocks = unlockOnlyIds(loadout).filter((id) =>
    isRelicGrantedItemAvailable(id, activeRelicNames),
  );
  const ammoRecord = equipmentById(nextSlots.ammo ?? "");
  const equipmentIds = mergeEquipmentIds(nextSlots, unlocks);
  return {
    ...loadout,
    equipmentSlots: nextSlots,
    selectedAmmunitionId: normalizeSelectedAmmunitionId(
      ammoRecord?.quiver != null,
      loadout.selectedAmmunitionId,
    ),
    equipmentIds,
    eofStoredSpecialId: normalizeEofStoredSpecialId(equipmentIds, loadout.eofStoredSpecialId),
    buffs: clearSliverActive ? { ...loadout.buffs, sliverOfEdictsActive: false } : loadout.buffs,
  };
}

/** Strip inactive grants, then equip each active grant when a selection changes. */
export function syncRelicGrantedEquipmentWithAutoEquip(
  loadout: Loadout,
  activeRelicNames: readonly string[] | ReadonlySet<string> | undefined,
): Loadout {
  const active =
    activeRelicNames instanceof Set ? [...activeRelicNames] : [...(activeRelicNames ?? [])];
  let next = syncRelicGrantedEquipment(loadout, active);
  for (const relicName of active) {
    next = equipGrantedItemForRelic(next, relicName, active);
  }
  return next;
}

/**
 * After selecting a relic, strip invalid grants then equip that relic's item
 * when the grant table names one. No-op when deselecting.
 */
export function equipGrantedItemForRelic(
  loadout: Loadout,
  relicName: string,
  activeRelicNames: readonly string[] | ReadonlySet<string>,
): Loadout {
  const stripped = syncRelicGrantedEquipment(loadout, activeRelicNames);
  const grant = relicGrantedItemForRelic(relicName);
  if (!grant) return stripped;
  if (!isRelicGrantedItemAvailable(grant.itemId, activeRelicNames)) return stripped;
  return equipInSlot(stripped, grant.slot, grant.itemId, activeRelicNames);
}

export function toggleUnlockPin(loadout: Loadout, itemId: string): Loadout {
  const unlocks = new Set(unlockOnlyIds(loadout));
  if (unlocks.has(itemId)) unlocks.delete(itemId);
  else unlocks.add(itemId);
  return {
    ...loadout,
    equipmentSlots: loadout.equipmentSlots ?? {},
    equipmentIds: mergeEquipmentIds(loadout.equipmentSlots ?? {}, [...unlocks]),
  };
}

export function toggleEquipmentEnchantment(
  loadout: Loadout,
  enchantment: EquipmentEnchantmentId,
): Loadout {
  const enchantments = new Set(loadout.enchantments);
  if (enchantments.has(enchantment)) enchantments.delete(enchantment);
  else enchantments.add(enchantment);
  return { ...loadout, enchantments: [...enchantments] };
}

export function clearEquipment(loadout: Loadout): Loadout {
  return {
    ...loadout,
    equipmentSlots: {},
    selectedAmmunitionId: null,
    eofStoredSpecialId: null,
    equipmentIds: [],
  };
}

/** Catalogue id still equippable: present and not unlock.type === "removed". */
export function isKnownEquipmentId(id: string): boolean {
  const rec = equipmentById(id);
  return rec != null && rec.unlock?.type !== "removed";
}

/**
 * Drop slotted ids / unlock pins missing from the catalogue or unlock.type "removed".
 * Inject `known` in tests; default isKnownEquipmentId. Call on load/update so orphans
 * do not linger in equipmentIds after a corpus trim.
 */
export function pruneUnknownEquipment(
  loadout: Loadout,
  known: (id: string) => boolean = isKnownEquipmentId,
): Loadout {
  const slots: Partial<Record<EquipmentSlot, string | null>> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const id = loadout.equipmentSlots?.[slot];
    if (typeof id === "string" && id.length > 0 && known(id)) {
      slots[slot] = id;
    }
  }
  // Only original unlock pins - never convert a pruned slot orphan into a pin.
  const unlocks = unlockOnlyIds(loadout).filter((id) => known(id));
  const ammoRecord = equipmentById(slots.ammo ?? "");
  const equipmentIds = mergeEquipmentIds(slots, unlocks);
  return {
    ...loadout,
    equipmentSlots: slots,
    selectedAmmunitionId: normalizeSelectedAmmunitionId(
      ammoRecord?.quiver != null,
      loadout.selectedAmmunitionId,
    ),
    equipmentIds,
    eofStoredSpecialId: normalizeEofStoredSpecialId(equipmentIds, loadout.eofStoredSpecialId),
  };
}

export function withStyleLevel(loadout: Loadout, level: number): Loadout {
  return { ...loadout, level };
}

/** Style of equipped 2H/MH weapon (owns loadout style). Hybrid or empty slot => null. */
export function weaponStyle(
  equipmentSlots: Partial<Record<EquipmentSlot, string | null>> | undefined,
): CombatStyle | null {
  const id = equipmentSlots?.twohand ?? equipmentSlots?.mainhand;
  if (typeof id !== "string" || id.length === 0) return null;
  const style = equipmentById(id)?.style;
  return style != null && style !== "hybrid" ? style : null;
}

/** Map active curse to same prayer-level tier for `style` (e.g. Turmoil→Anguish). */
function curseForStyle(current: StyleCurseChoice, style: CombatStyle): StyleCurseChoice {
  const active = current === "none" ? undefined : styleCurseById(current);
  if (!active) return current;
  const match = STYLE_CURSE_BOOSTS.find(
    (curse) => curse.style === style && curse.prayerLevel === active.prayerLevel,
  );
  return (match?.id as StyleCurseChoice | undefined) ?? current;
}

/**
 * Weapon shape from equipped gear: offensive OH→dualwield; defender→defender (DW cast OK);
 * shield→shield; empty OH→mainhand. Null if no weapon equipped.
 */
export function weaponConfigurationFor(
  loadout: LoadoutEquipmentView,
): LoadoutWeaponConfiguration | null {
  const slots = resolvedEquipmentSlots(loadout);
  if (slots.twohand) return "twohand";
  if (!slots.mainhand) return null;
  const oh = wieldedOffhandKind(loadout);
  if (oh === "shield") return "shield";
  if (oh === "defender") return "defender";
  if (slots.offhand) return "dualwield";
  return "mainhand";
}

export function withCombatStyle(loadout: Loadout, style: CombatStyle): Loadout {
  if (style === loadout.style) return loadout;
  let target = loadout.target;
  if (target?.targetPresetId) {
    const preset = targetPresetById(target.targetPresetId);
    if (preset) {
      const previousStyleFields = materializeTargetPreset(preset, {
        style: loadout.style,
      });
      const nextStyleFields = materializeTargetPreset(preset, { style });
      if (
        previousStyleFields &&
        nextStyleFields &&
        !targetDiffersFromPreset(target, previousStyleFields)
      ) {
        target = {
          ...target,
          affinity: nextStyleFields.affinity,
          ...(nextStyleFields.weaknessAffinity != null
            ? { weaknessAffinity: nextStyleFields.weaknessAffinity }
            : {}),
        };
      }
    }
  }
  return {
    ...loadout,
    style,
    target,
    // Melee damage level is Strength; leave/enter melee seeds `level` from strengthLevel.
    level: style === "melee" || loadout.style === "melee" ? loadout.strengthLevel : loadout.level,
    buffs: { ...loadout.buffs, styleCurse: curseForStyle(loadout.buffs.styleCurse, style) },
  };
}

export function withAttackLevel(loadout: Loadout, attackLevel: number): Loadout {
  return { ...loadout, attackLevel };
}

export function withStrengthLevel(loadout: Loadout, strengthLevel: number): Loadout {
  return { ...loadout, strengthLevel, level: strengthLevel };
}

export function withLoadoutBuffs(
  loadout: Loadout,
  patch: Partial<LoadoutBuffs>,
  unlockedRegions?: readonly RegionId[],
): Loadout {
  const buffs = { ...loadout.buffs, ...patch };
  if (patch.fortitude === true) buffs.styleCurse = "none";
  else if (patch.styleCurse != null && patch.styleCurse !== "none") buffs.fortitude = false;
  if (patch.totemOfVitality === true) {
    buffs.bonfireLogType = null;
    buffs.bonfireFiremakingLevel = null;
  } else if (patch.bonfireLogType === null) {
    buffs.bonfireFiremakingLevel = null;
  } else if (patch.bonfireLogType != null || patch.bonfireFiremakingLevel != null) {
    buffs.bonfireLogType ??= "normal";
    buffs.bonfireFiremakingLevel ??= MAX_FIREMAKING_LEVEL;
    buffs.totemOfVitality = false;
  }

  let selectedIds = loadout.archaeology?.selectedIds ?? [];
  const energyCap = loadout.archaeology?.energyCap ?? MONOLITH_ENERGY_DEFAULT;
  let archTouched = false;
  for (const [buffKey, relicId] of Object.entries(FULL_ARCH_BUFF_TO_RELIC) as [
    FullArchBuffKey,
    string,
  ][]) {
    if (patch[buffKey] === undefined) continue;
    archTouched = true;
    // Buff patch is a convenience mirror of selection; never leave booleans authoritative.
    // When unlockedRegions is provided, region-locked selects reject (same as Arch panel).
    if (patch[buffKey] === true) {
      if (!selectedIds.includes(relicId)) {
        const result = tryToggleArchaeologyRelic({
          relicId,
          selectedIds,
          energyCap,
          unlockedRegions,
        });
        selectedIds = result.selectedIds;
      }
    } else {
      selectedIds = selectedIds.filter((id) => id !== relicId);
    }
  }
  if (archTouched) {
    Object.assign(buffs, buffsFromArchSelected(selectedIds));
    return {
      ...loadout,
      buffs,
      archaeology: { selectedIds, energyCap },
    };
  }
  return { ...loadout, buffs };
}

/**
 * Replace monolith selection. Buff mirrors re-derived from selectedIds.
 * Sanitizes for corrupt lists (repair); interactive toggles should use
 * applyArchaeologyToggle so rejects stay explicit.
 * Pass unlockedRegions so region-locked ids match ArchPanel display.
 */
export function withArchaeologySelection(
  loadout: Loadout,
  selectedIds: readonly string[],
  energyCap: MonolithEnergyCap,
  unlockedRegions?: readonly RegionId[],
  leagueRelics?: readonly string[] | ReadonlySet<string>,
): Loadout {
  const ignoreRegionGates = hasAntiquarianLeagueRelic(leagueRelics);
  const cleaned = sanitizeSelectedRelics({
    selectedIds,
    energyCap,
    unlockedRegions,
    ignoreRegionGates,
  });
  return {
    ...loadout,
    archaeology: { selectedIds: cleaned, energyCap },
    buffs: {
      ...loadout.buffs,
      ...buffsFromArchSelected(cleaned),
    },
  };
}

/**
 * Interactive relic toggle. Operates on sanitized selection (region/energy/slot)
 * so click semantics match ArchPanel display; write-back is sanitized.
 * Rejects do not mutate selection or drop neighbors.
 */
export function applyArchaeologyToggle(
  loadout: Loadout,
  relicId: string,
  energyCap?: MonolithEnergyCap,
  unlockedRegions?: readonly RegionId[],
  leagueRelics?: readonly string[] | ReadonlySet<string>,
): { loadout: Loadout; result: ArchaeologyToggleResult } {
  const cap = energyCap ?? loadout.archaeology?.energyCap ?? MONOLITH_ENERGY_DEFAULT;
  const ignoreRegionGates = hasAntiquarianLeagueRelic(leagueRelics);
  // Effective selection only - raw may still hold region-locked / over-budget ids.
  const baseSelected = sanitizeSelectedRelics({
    selectedIds: loadout.archaeology?.selectedIds ?? [],
    energyCap: cap,
    unlockedRegions,
    ignoreRegionGates,
  });
  const result = tryToggleArchaeologyRelic({
    relicId,
    selectedIds: baseSelected,
    energyCap: cap,
    unlockedRegions,
    ignoreRegionGates,
  });
  if (!result.ok) {
    return { loadout, result };
  }
  const cleaned = sanitizeSelectedRelics({
    selectedIds: result.selectedIds,
    energyCap: cap,
    unlockedRegions,
    ignoreRegionGates,
  });
  return {
    loadout: {
      ...loadout,
      archaeology: { selectedIds: cleaned, energyCap: cap },
      buffs: {
        ...loadout.buffs,
        ...buffsFromArchSelected(cleaned),
      },
    },
    result: { ...result, selectedIds: cleaned },
  };
}

export function activatePowerburstOfVitality(loadout: Loadout, now = Date.now()): Loadout {
  if (!isPowerburstOfVitalityReady(loadout, now)) return loadout;
  return withLoadoutBuffs(loadout, {
    powerburstOfVitalityUntil: now + POWERBURST_DURATION_MS,
    powerburstOfVitalityCooldownUntil: now + POWERBURST_COOLDOWN_MS,
  });
}

export function isPowerburstOfVitalityActive(loadout: Loadout, now = Date.now()): boolean {
  return (loadout.buffs.powerburstOfVitalityUntil ?? 0) > now;
}

export function isPowerburstOfVitalityReady(loadout: Loadout, now = Date.now()): boolean {
  return (loadout.buffs.powerburstOfVitalityCooldownUntil ?? 0) <= now;
}

function normalizeEquipmentSlots(raw: unknown): Partial<Record<EquipmentSlot, string | null>> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Partial<Record<EquipmentSlot, string | null>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!SLOT_SET.has(key)) continue;
    if (value == null || value === "") continue;
    const id = normalizeSavedEquipmentId(value);
    if (id != null) out[key as EquipmentSlot] = id;
  }
  return out;
}

/** Forward-migrate stored loadouts. Exported for tests. */
export function normalizeLoadout(value: unknown, now = Date.now()): Loadout {
  if (typeof value !== "object" || value === null) return DEFAULT_LOADOUT;
  const raw = value as Partial<Loadout> & {
    base?: unknown;
    baseDamage?: unknown;
    level?: unknown;
    attackLevel?: unknown;
    strengthLevel?: unknown;
    equipmentSlots?: unknown;
    buffs?: unknown;
  };
  const rawPerks = (raw.perks ?? {}) as Partial<LoadoutPerks>;
  const rawBuffs = (raw.buffs ?? {}) as Partial<LoadoutBuffs>;
  const rawTarget = raw.target as Partial<LoadoutTarget> | null | undefined;
  const equipmentSlots = normalizeEquipmentSlots(raw.equipmentSlots);
  const storedStyle = STYLES.includes(raw.style as string)
    ? (raw.style as CombatStyle)
    : DEFAULT_LOADOUT.style;
  // Equipped weapon style outranks stored style.
  const style = weaponStyle(equipmentSlots) ?? storedStyle;

  const hasAttack = Number.isFinite(raw.attackLevel);
  const hasStrength = Number.isFinite(raw.strengthLevel);
  const hasLevel = Number.isFinite(raw.level);
  const legacyLevel = clamp(raw.level, 1, 145, DEFAULT_LOADOUT.level);
  const attackLevel = hasAttack ? clamp(raw.attackLevel, 1, 145, legacyLevel) : legacyLevel;
  const strengthLevel = hasStrength ? clamp(raw.strengthLevel, 1, 145, legacyLevel) : legacyLevel;
  let level = hasLevel ? legacyLevel : strengthLevel;

  if (style === "melee") {
    level = strengthLevel;
  } else if (!hasLevel && (hasAttack || hasStrength)) {
    level = hasStrength ? strengthLevel : attackLevel;
  }

  const enchantments = Array.isArray(raw.enchantments)
    ? [
        ...new Set(
          raw.enchantments.filter(
            (id): id is EquipmentEnchantmentId =>
              typeof id === "string" &&
              EQUIPMENT_ENCHANTMENTS.includes(id as EquipmentEnchantmentId),
          ),
        ),
      ]
    : [...EQUIPMENT_ENCHANTMENTS];
  const legacyIds = Array.isArray(raw.equipmentIds)
    ? raw.equipmentIds
        .map((id) => normalizeSavedEquipmentId(id))
        .filter((id): id is string => id != null)
    : [];
  const slotted = new Set(equipmentIdList(equipmentSlots));
  const unlocks = legacyIds.filter((id) => !slotted.has(id));
  const ammoRecord = equipmentById(equipmentSlots.ammo ?? "");
  // Remap curse to resolved style (weapon swap must not leave a melee curse on magic).
  const styleCurse = curseForStyle(
    STYLE_CURSES.includes(rawBuffs.styleCurse as StyleCurseChoice)
      ? (rawBuffs.styleCurse as StyleCurseChoice)
      : "none",
    style,
  );
  const fortitude = rawBuffs.fortitude === true && styleCurse === "none";
  const totemOfVitality = rawBuffs.totemOfVitality === true;
  const bonfireLogType =
    !totemOfVitality && BONFIRE_LOG_TYPE_SET.has(rawBuffs.bonfireLogType as string)
      ? (rawBuffs.bonfireLogType as BonfireLogType)
      : !totemOfVitality && Number.isFinite(rawBuffs.bonfireFiremakingLevel)
        ? "normal"
        : null;
  const bonfireFiremakingLevel =
    bonfireLogType != null && Number.isFinite(rawBuffs.bonfireFiremakingLevel)
      ? clamp(rawBuffs.bonfireFiremakingLevel, 1, MAX_FIREMAKING_LEVEL, MAX_FIREMAKING_LEVEL)
      : bonfireLogType != null
        ? MAX_FIREMAKING_LEVEL
        : null;
  const powerburstOfVitalityUntil =
    Number.isFinite(rawBuffs.powerburstOfVitalityUntil) &&
    Number(rawBuffs.powerburstOfVitalityUntil) > now
      ? Math.min(Number(rawBuffs.powerburstOfVitalityUntil), now + POWERBURST_DURATION_MS)
      : null;
  const storedPowerburstCooldown =
    Number.isFinite(rawBuffs.powerburstOfVitalityCooldownUntil) &&
    Number(rawBuffs.powerburstOfVitalityCooldownUntil) > now
      ? Math.min(Number(rawBuffs.powerburstOfVitalityCooldownUntil), now + POWERBURST_COOLDOWN_MS)
      : null;
  const inferredPowerburstCooldown =
    powerburstOfVitalityUntil == null
      ? null
      : powerburstOfVitalityUntil + POWERBURST_COOLDOWN_MS - POWERBURST_DURATION_MS;
  const powerburstOfVitalityCooldownUntil =
    Math.max(storedPowerburstCooldown ?? 0, inferredPowerburstCooldown ?? 0) || null;

  const archaeology = normalizeArchaeology(
    (raw as { archaeology?: unknown }).archaeology,
    rawBuffs,
  );
  const archBuffs = buffsFromArchSelected(archaeology.selectedIds);
  // Persist clamp: vestments 120 + Heightened Senses +10 (AJ blessing is resolve-time only).
  const startingAdrenalineCap =
    (activeEquipmentEffects({ style, equipmentSlots, enchantments }).vestments
      .increasedAdrenalineCap
      ? 120
      : 100) + (archBuffs.heightenedSenses ? HEIGHTENED_SENSES_ADRENALINE_BONUS : 0);

  const rawSchemaVersion =
    typeof (raw as { loadoutSchemaVersion?: unknown }).loadoutSchemaVersion === "number" &&
    Number.isFinite((raw as { loadoutSchemaVersion?: number }).loadoutSchemaVersion)
      ? Math.floor(Number((raw as { loadoutSchemaVersion: number }).loadoutSchemaVersion))
      : 0;
  // Pre-v2 full-object saves always wrote startingAdrenaline:0 as default.
  // Impossible to tell intentional zero from that default; rewrite 0 -> null
  // (open at max). Schema >=2 keeps intentional zeros; missing field is null.
  const rawStart = raw.startingAdrenaline;
  const startingAdrenaline =
    rawStart === null
      ? null
      : typeof rawStart === "number" && Number.isFinite(rawStart)
        ? rawSchemaVersion < 2 && rawStart === 0
          ? null
          : Math.min(startingAdrenalineCap, Math.max(0, Math.round(rawStart)))
        : DEFAULT_LOADOUT.startingAdrenaline;

  const storedIncomingHitIntervalSeconds =
    Number.isFinite(rawTarget?.incomingHitIntervalSeconds) &&
    Number(rawTarget?.incomingHitIntervalSeconds) > 0
      ? Number(rawTarget?.incomingHitIntervalSeconds)
      : undefined;
  let incomingHitIntervalSeconds = storedIncomingHitIntervalSeconds;
  if (incomingHitIntervalSeconds == null && typeof rawTarget?.targetPresetId === "string") {
    const preset = targetPresetById(rawTarget.targetPresetId);
    const fields = preset ? materializeTargetPreset(preset, { style }) : null;
    incomingHitIntervalSeconds = fields?.incomingHitIntervalSeconds;
  }

  return {
    style,
    level,
    attackLevel,
    strengthLevel,
    defenceLevel: clamp(raw.defenceLevel, 1, MAX_DEFENCE_LEVEL, DEFAULT_LOADOUT.defenceLevel),
    constitutionLevel: clamp(
      raw.constitutionLevel,
      10,
      MAX_CONSTITUTION_LEVEL,
      DEFAULT_LOADOUT.constitutionLevel,
    ),
    agilityLevel: clamp(raw.agilityLevel, 1, 99, DEFAULT_LOADOUT.agilityLevel),
    currentLife: Number.isFinite(raw.currentLife) ? Math.max(0, Number(raw.currentLife)) : null,
    currentHealthPercent: clamp(
      raw.currentHealthPercent,
      0,
      100,
      DEFAULT_LOADOUT.currentHealthPercent,
    ),
    weaponTier: clamp(raw.weaponTier, 0, 145, DEFAULT_LOADOUT.weaponTier),
    offhandTier: clamp(raw.offhandTier, 0, 145, num(raw.weaponTier, DEFAULT_LOADOUT.offhandTier)),
    spellTier: clamp(raw.spellTier, 0, 145, num(raw.weaponTier, DEFAULT_LOADOUT.spellTier)),
    ammunitionTier: clamp(
      raw.ammunitionTier,
      0,
      145,
      num(raw.weaponTier, DEFAULT_LOADOUT.ammunitionTier),
    ),
    styleDamageBonus: Math.max(0, num(raw.styleDamageBonus, DEFAULT_LOADOUT.styleDamageBonus)),
    // Equipped gear outranks stored weaponConfiguration.
    weaponConfiguration:
      weaponConfigurationFor({ equipmentSlots }) ??
      (raw.weaponConfiguration === "dualwield" ||
      raw.weaponConfiguration === "mainhand" ||
      raw.weaponConfiguration === "shield" ||
      raw.weaponConfiguration === "defender"
        ? raw.weaponConfiguration
        : "twohand"),
    baseDamage: { mode: "automatic" },
    startingAdrenaline,
    loadoutSchemaVersion: LOADOUT_SCHEMA_VERSION,
    hitCapEnabled: raw.hitCapEnabled === true,
    ...(typeof raw.slayerLevel === "number" &&
    Number.isFinite(raw.slayerLevel) &&
    raw.slayerLevel > 0
      ? { slayerLevel: Math.min(200, Math.floor(raw.slayerLevel)) }
      : {}),
    accuracy: clamp(raw.accuracy, 0, 100, DEFAULT_LOADOUT.accuracy),
    critChance: clamp(raw.critChance, 0, 100, DEFAULT_LOADOUT.critChance),
    target:
      rawTarget && parseLoadoutAffinity(rawTarget.affinity) != null
        ? {
            defenceLevel: Math.max(0, num(rawTarget.defenceLevel, 80)),
            armour: Math.max(0, num(rawTarget.armour, 0)),
            affinity: parseLoadoutAffinity(rawTarget.affinity)!,
            additiveHitChance: clamp(rawTarget.additiveHitChance, -100, 100, 0),
            ...(typeof rawTarget.targetPresetId === "string" && rawTarget.targetPresetId.length > 0
              ? { targetPresetId: rawTarget.targetPresetId }
              : {}),
            ...(parseLoadoutAffinity(rawTarget.weaknessAffinity) != null
              ? { weaknessAffinity: parseLoadoutAffinity(rawTarget.weaknessAffinity)! }
              : {}),
            ...(Number.isFinite(rawTarget.damagePotentialOverride)
              ? {
                  damagePotentialOverride: Math.min(
                    1,
                    Math.max(0, Number(rawTarget.damagePotentialOverride)),
                  ),
                }
              : {}),
            ...(Number.isFinite(rawTarget.hpPercent)
              ? { hpPercent: Math.min(100, Math.max(0, Number(rawTarget.hpPercent))) }
              : {}),
            ...(Number.isFinite(rawTarget.maximumLifePoints) &&
            Number(rawTarget.maximumLifePoints) > 0
              ? {
                  maximumLifePoints: Math.min(
                    10_000_000,
                    Math.floor(Number(rawTarget.maximumLifePoints)),
                  ),
                }
              : {}),
            ...(rawTarget.hasApplicableWeakness === true ? { hasApplicableWeakness: true } : {}),
            elementalWeakness:
              rawTarget.elementalWeakness === "water" ||
              rawTarget.elementalWeakness === "fire" ||
              rawTarget.elementalWeakness === "other"
                ? rawTarget.elementalWeakness
                : "unknown",
            dragonfireImmune: rawTarget.dragonfireImmune === true,
            ...(Number.isFinite(rawTarget.size)
              ? { size: Math.max(1, Math.floor(Number(rawTarget.size))) }
              : {}),
            ...(Number.isFinite(rawTarget.occupiedTiles)
              ? { occupiedTiles: Math.max(1, Math.floor(Number(rawTarget.occupiedTiles))) }
              : {}),
            ...(Number.isFinite(rawTarget.areaTargets)
              ? { areaTargets: Math.max(1, Math.floor(Number(rawTarget.areaTargets))) }
              : {}),
            ...(rawTarget.undead === true ? { undead: true } : {}),
            ...(rawTarget.demon === true ? { demon: true } : {}),
            ...(rawTarget.dragon === true ? { dragon: true } : {}),
            ...(rawTarget.onSlayerTask === true ? { onSlayerTask: true } : {}),
            ...(rawTarget.poisonImmune === true ? { poisonImmune: true } : {}),
            ...(incomingHitIntervalSeconds != null ? { incomingHitIntervalSeconds } : {}),
            ...(Number.isFinite(rawTarget.incomingHitDamage) &&
            Number(rawTarget.incomingHitDamage) >= 0
              ? { incomingHitDamage: Number(rawTarget.incomingHitDamage) }
              : {}),
          }
        : null,
    perks: {
      equilibrium: clampRank(rawPerks.equilibrium, 4),
      eruptive: clampRank(rawPerks.eruptive, 4),
      biting: clampRank(rawPerks.biting, 4),
      bitingLevel20: rawPerks.bitingLevel20 === true,
      invigorating: clampRank(rawPerks.invigorating, 4),
      impatient: clampRank(rawPerks.impatient, 4),
      impatientLevel20: rawPerks.impatientLevel20 === true,
      ultimatums: clampRank(rawPerks.ultimatums, 4),
      lunging: clampRank(rawPerks.lunging, 4),
      caroming: clampRank(rawPerks.caroming, 4),
      energising: clampRank(rawPerks.energising, 4),
      crackling: clampRank(rawPerks.crackling, 4),
      aftershock: clampRank(rawPerks.aftershock, 4),
      relentless: clampRank(rawPerks.relentless, 5),
      relentlessLevel20: rawPerks.relentlessLevel20 === true,
      precise: clampRank(rawPerks.precise, 6),
      flanking: clampRank(rawPerks.flanking, 4),
      shieldBashing: clampRank(rawPerks.shieldBashing, 4),
      spendthrift: clampRank(rawPerks.spendthrift, 6),
      ruthless: clampRank(rawPerks.ruthless, 3),
      // Legacy boolean saves (pre-gizmo placement) migrate to rank 1.
      plantedFeet: legacyToggleRank(rawPerks.plantedFeet),
      demonSlayer: legacyToggleRank(rawPerks.demonSlayer),
      dragonSlayer: legacyToggleRank(rawPerks.dragonSlayer),
      undeadSlayer: legacyToggleRank(rawPerks.undeadSlayer),
    },
    gizmos: normalizeGizmos((raw as { gizmos?: unknown }).gizmos),
    powerArchive: normalizePowerArchiveState((raw as { powerArchive?: unknown }).powerArchive),
    buffs: {
      useEquippedWeaponSpecial: rawBuffs.useEquippedWeaponSpecial === true,
      weaponSpecialAfterAbilityId:
        typeof rawBuffs.weaponSpecialAfterAbilityId === "string" &&
        rawBuffs.weaponSpecialAfterAbilityId.trim().length > 0
          ? rawBuffs.weaponSpecialAfterAbilityId.trim()
          : null,
      vulnerability: rawBuffs.vulnerability === true,
      weaponPoison: normalizeWeaponPoisonChoice(rawBuffs.weaponPoison),
      kwuarmPotency: normalizeKwuarmPotency(rawBuffs.kwuarmPotency),
      herbloreLevel: clamp(rawBuffs.herbloreLevel, 1, 120, 99),
      styleCurse,
      overload: OVERLOADS.includes(rawBuffs.overload as OverloadChoice)
        ? (rawBuffs.overload as OverloadChoice)
        : "none",
      fortitude,
      reaperCrew: rawBuffs.reaperCrew === true,
      fontOfLife: rawBuffs.fontOfLife === true,
      boonOfHet: rawBuffs.boonOfHet === true,
      bonfireLogType,
      bonfireFiremakingLevel,
      totemOfVitality,
      thermalBath: rawBuffs.thermalBath === true,
      overheal: OVERHEALS.includes(rawBuffs.overheal as OverhealChoice)
        ? (rawBuffs.overheal as OverhealChoice)
        : "none",
      powerburstOfVitalityUntil,
      powerburstOfVitalityCooldownUntil,
      strengthCape99: rawBuffs.strengthCape99 === true,
      attackCape120: rawBuffs.attackCape120 === true,
      eliteSeersVillage: rawBuffs.eliteSeersVillage === true,
      protectionPrayer: rawBuffs.protectionPrayer === true,
      sliverOfEdictsActive: rawBuffs.sliverOfEdictsActive === true,
      ruthlessStacks: clamp(rawBuffs.ruthlessStacks, 0, 5, 0),
      targetNotFacing: rawBuffs.targetNotFacing === true,
      ringOfVigourPassive: rawBuffs.ringOfVigourPassive === true,
      slayerHelmetStand: normalizeSlayerHelmetStand(rawBuffs.slayerHelmetStand),
      ensouledSpectralLens: rawBuffs.ensouledSpectralLens === true,
      ...archBuffs,
    },
    archaeology,
    equipmentSlots,
    selectedAmmunitionId: normalizeSelectedAmmunitionId(
      ammoRecord?.quiver != null,
      raw.selectedAmmunitionId,
    ),
    enchantments,
    equipmentIds: mergeEquipmentIds(equipmentSlots, unlocks),
    eofStoredSpecialId: normalizeEofStoredSpecialId(
      mergeEquipmentIds(equipmentSlots, unlocks),
      raw.eofStoredSpecialId,
    ),
  };
}
