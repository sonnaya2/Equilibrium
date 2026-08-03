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
import {
  isRelicActive,
  MONOLITH_ENERGY_DEFAULT,
  MONOLITH_ENERGY_EXTENDED,
  relicById,
  sanitizeSelectedRelics,
  tryToggleArchaeologyRelic,
  type ArchaeologyToggleResult,
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
import { STYLE_CURSES as STYLE_CURSE_BOOSTS, styleCurseById } from "@/combat/shared/prayers";
import type { AffinityKind } from "@/combat/target/genericTarget";
import type { CombatStyle } from "@/combat/types";

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
  affinity: AffinityKind;
  additiveHitChance?: number;
  damagePotentialOverride?: number;
  /** Optional target life-points % (0-100) for HP-dependent mechanics; absent = unavailable. */
  hpPercent?: number;
  hasApplicableWeakness?: boolean;
  occupiedTiles?: number;
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
  /** Seconds between hits large enough for Barkscales; omit when no incoming scenario. */
  incomingHitIntervalSeconds?: number;
  /** Optional assumed hit size for Icyenic 100% protect mitigation totals. */
  incomingHitDamage?: number;
}

export interface BaseDamageSettings {
  mode: "automatic" | "manual";
  manualValue: number;
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
  energising: number;
  /** Crackling: PvM zap 50% AD × rank, 60s CD. Rank 0 = off, max 4. */
  crackling: number;
  /** Aftershock: AoE after 50k damage, avg 31.8% AD × rank, 6s min. Rank 0 = off, max 4. */
  aftershock: number;
  /** Relentless: branched cost refund with its 30s lockout. Rank 0 = off, max 5. */
  relentless: number;
  relentlessLevel20: boolean;
  /** Precise: raises min hit by 1.5% of max per rank. Rank 0 = off, max 6. */
  precise: number;
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
  energising: "both",
  crackling: "both",
  aftershock: "weapon",
  relentless: "both",
  precise: "weapon",
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
  vulnerability: boolean;
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
  energyCap: 500 | 650;
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

function normalizeArchaeologyEnergyCap(value: unknown): 500 | 650 {
  return value === MONOLITH_ENERGY_EXTENDED ? MONOLITH_ENERGY_EXTENDED : MONOLITH_ENERGY_DEFAULT;
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
    selectedIds: sanitizeSelectedRelics({
      selectedIds,
      energyCap,
      unlockedRegions: [],
    }),
  };
}

/** Bump when normalizeLoadout needs a one-shot field migration. */
export const LOADOUT_SCHEMA_VERSION = 2;

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
  startingAdrenaline: number;
  /**
   * Persist schema. v1 had startingAdrenaline default 0 (broke ultimates).
   * v2 defaults open adren to 100; load migrates stored 0 -> 100 once.
   */
  loadoutSchemaVersion: number;
  hitCapEnabled: boolean;
  accuracy: number;
  critChance: number;
  target: LoadoutTarget | null;
  perks: LoadoutPerks;
  /** Which perks the player keeps on which gizmo. Display grouping, not engine input. */
  gizmos: GizmoLayout;
  buffs: LoadoutBuffs;
  /** Archaeology monolith powers (selection + energy budget). */
  archaeology: LoadoutArchaeology;
  equipmentSlots: Partial<Record<EquipmentSlot, string | null>>;
  enchantments: EquipmentEnchantmentId[];
  /** Derived: slotted ids + unlock pins. */
  equipmentIds: string[];
}

export const DEFAULT_LOADOUT: Loadout = {
  style: "melee",
  level: 99,
  attackLevel: 99,
  strengthLevel: 99,
  defenceLevel: 99,
  constitutionLevel: 99,
  currentLife: null,
  currentHealthPercent: 50,
  weaponTier: 90,
  offhandTier: 90,
  spellTier: 90,
  ammunitionTier: 90,
  styleDamageBonus: 0,
  weaponConfiguration: "twohand",
  baseDamage: { mode: "automatic", manualValue: 1000 },
  // Combat open is full adren in almost every PvM setup; 0 made ultimates
  // (Death's Swiftness, Sunshine, Berserk) look "broken" until Stats was touched.
  startingAdrenaline: 100,
  loadoutSchemaVersion: LOADOUT_SCHEMA_VERSION,
  hitCapEnabled: true,
  accuracy: 100,
  critChance: 10,
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
    energising: 0,
    crackling: 0,
    aftershock: 0,
    relentless: 0,
    relentlessLevel20: false,
    precise: 0,
    plantedFeet: 0,
    demonSlayer: 0,
    dragonSlayer: 0,
    undeadSlayer: 0,
  },
  gizmos: {},
  buffs: {
    vulnerability: false,
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
    protectionPrayer: false,
    berserkersFury: false,
    furyOfTheSmall: false,
    heightenedSenses: false,
    conservationOfEnergy: false,
    ringOfVigourPassive: false,
    slayerHelmetStand: null,
    ensouledSpectralLens: false,
  },
  archaeology: {
    selectedIds: [],
    energyCap: MONOLITH_ENERGY_DEFAULT,
  },
  equipmentSlots: {},
  enchantments: [...EQUIPMENT_ENCHANTMENTS],
  equipmentIds: [],
};

export const LOADOUT_STORAGE_KEY = "eq:loadout:v1";
const STYLES = ["melee", "ranged", "magic", "necromancy"];
const AFFINITIES = ["weak", "same", "strong", "weakness"];
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

/** Equip or clear one slot. Two-hand clears MH/OH; MH/OH clears two-hand. */
export function equipInSlot(loadout: Loadout, slot: EquipmentSlot, itemId: string | null): Loadout {
  const slots: Partial<Record<EquipmentSlot, string | null>> = {
    ...(loadout.equipmentSlots ?? {}),
  };
  if (itemId == null || itemId === "") {
    delete slots[slot];
  } else {
    slots[slot] = itemId;
    if (slot === "twohand") {
      delete slots.mainhand;
      delete slots.offhand;
    }
    if (slot === "mainhand" || slot === "offhand") {
      delete slots.twohand;
    }
  }
  const unlocks = unlockOnlyIds(loadout);
  const next: Loadout = {
    ...loadout,
    baseDamage: { ...loadout.baseDamage, mode: "automatic" },
    equipmentSlots: slots,
    equipmentIds: mergeEquipmentIds(slots, unlocks),
  };
  // Weapon equip owns style + weaponConfiguration from gear.
  next.weaponConfiguration = weaponConfigurationFor(next) ?? next.weaponConfiguration;
  const style = weaponStyle(slots);
  return style != null ? withCombatStyle(next, style) : next;
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
    baseDamage: { ...loadout.baseDamage, mode: "automatic" },
    equipmentSlots: {},
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
  return {
    ...loadout,
    equipmentSlots: slots,
    equipmentIds: mergeEquipmentIds(slots, unlocks),
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
  return {
    ...loadout,
    style,
    baseDamage: { ...loadout.baseDamage, mode: "automatic" },
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

export function withLoadoutBuffs(loadout: Loadout, patch: Partial<LoadoutBuffs>): Loadout {
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
    if (patch[buffKey] === true) {
      if (!selectedIds.includes(relicId)) {
        const result = tryToggleArchaeologyRelic({ relicId, selectedIds, energyCap });
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
 */
export function withArchaeologySelection(
  loadout: Loadout,
  selectedIds: readonly string[],
  energyCap: 500 | 650,
): Loadout {
  const cleaned = sanitizeSelectedRelics({
    selectedIds,
    energyCap,
    unlockedRegions: [],
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

/** Interactive relic toggle. Rejects do not mutate selection or drop neighbors. */
export function applyArchaeologyToggle(
  loadout: Loadout,
  relicId: string,
  energyCap?: 500 | 650,
): { loadout: Loadout; result: ArchaeologyToggleResult } {
  const cap = energyCap ?? loadout.archaeology?.energyCap ?? MONOLITH_ENERGY_DEFAULT;
  const result = tryToggleArchaeologyRelic({
    relicId,
    selectedIds: loadout.archaeology?.selectedIds ?? [],
    energyCap: cap,
  });
  if (!result.ok) {
    return { loadout, result };
  }
  return {
    loadout: {
      ...loadout,
      archaeology: { selectedIds: result.selectedIds, energyCap: cap },
      buffs: {
        ...loadout.buffs,
        ...buffsFromArchSelected(result.selectedIds),
      },
    },
    result,
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
    if (typeof value === "string") out[key as EquipmentSlot] = value;
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
  const rawBaseDamage =
    typeof raw.baseDamage === "object" && raw.baseDamage !== null
      ? (raw.baseDamage as Partial<BaseDamageSettings>)
      : undefined;
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
    ? raw.equipmentIds.filter((id): id is string => typeof id === "string")
    : [];
  const slotted = new Set(equipmentIdList(equipmentSlots));
  const unlocks = legacyIds.filter((id) => !slotted.has(id));
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
  // Pre-v2: stored 0 was the old product default, not an intentional zero-open.
  // Check raw (not clamped) so invalid negatives still clamp to 0 without becoming 100.
  const rawStart = raw.startingAdrenaline;
  const startingAdrenaline =
    typeof rawStart === "number" && Number.isFinite(rawStart)
      ? rawSchemaVersion < 2 && rawStart === 0
        ? Math.min(startingAdrenalineCap, DEFAULT_LOADOUT.startingAdrenaline)
        : Math.min(startingAdrenalineCap, Math.max(0, rawStart))
      : DEFAULT_LOADOUT.startingAdrenaline;

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
    baseDamage: {
      mode: rawBaseDamage?.mode === "manual" ? "manual" : "automatic",
      manualValue: Math.max(
        1,
        num(rawBaseDamage?.manualValue, num(raw.base, DEFAULT_LOADOUT.baseDamage.manualValue)),
      ),
    },
    startingAdrenaline,
    loadoutSchemaVersion: LOADOUT_SCHEMA_VERSION,
    hitCapEnabled: raw.hitCapEnabled !== false,
    accuracy: clamp(raw.accuracy, 0, 100, DEFAULT_LOADOUT.accuracy),
    critChance: clamp(raw.critChance, 0, 100, DEFAULT_LOADOUT.critChance),
    target:
      rawTarget && AFFINITIES.includes(rawTarget.affinity as string)
        ? {
            defenceLevel: Math.max(0, num(rawTarget.defenceLevel, 80)),
            armour: Math.max(0, num(rawTarget.armour, 0)),
            affinity: rawTarget.affinity as AffinityKind,
            additiveHitChance: clamp(rawTarget.additiveHitChance, -100, 100, 0),
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
            ...(rawTarget.hasApplicableWeakness === true ? { hasApplicableWeakness: true } : {}),
            ...(Number.isFinite(rawTarget.occupiedTiles)
              ? { occupiedTiles: Math.max(1, Math.floor(Number(rawTarget.occupiedTiles))) }
              : {}),
            ...(rawTarget.undead === true ? { undead: true } : {}),
            ...(rawTarget.demon === true ? { demon: true } : {}),
            ...(rawTarget.dragon === true ? { dragon: true } : {}),
            ...(rawTarget.onSlayerTask === true ? { onSlayerTask: true } : {}),
            ...(rawTarget.poisonImmune === true ? { poisonImmune: true } : {}),
            ...(Number.isFinite(rawTarget.incomingHitIntervalSeconds) &&
            Number(rawTarget.incomingHitIntervalSeconds) > 0
              ? {
                  incomingHitIntervalSeconds: Number(rawTarget.incomingHitIntervalSeconds),
                }
              : {}),
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
      energising: clampRank(rawPerks.energising, 4),
      crackling: clampRank(rawPerks.crackling, 4),
      aftershock: clampRank(rawPerks.aftershock, 4),
      relentless: clampRank(rawPerks.relentless, 5),
      relentlessLevel20: rawPerks.relentlessLevel20 === true,
      precise: clampRank(rawPerks.precise, 6),
      // Legacy boolean saves (pre-gizmo placement) migrate to rank 1.
      plantedFeet: legacyToggleRank(rawPerks.plantedFeet),
      demonSlayer: legacyToggleRank(rawPerks.demonSlayer),
      dragonSlayer: legacyToggleRank(rawPerks.dragonSlayer),
      undeadSlayer: legacyToggleRank(rawPerks.undeadSlayer),
    },
    gizmos: normalizeGizmos((raw as { gizmos?: unknown }).gizmos),
    buffs: {
      vulnerability: rawBuffs.vulnerability === true,
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
      protectionPrayer: rawBuffs.protectionPrayer === true,
      ringOfVigourPassive: rawBuffs.ringOfVigourPassive === true,
      slayerHelmetStand: normalizeSlayerHelmetStand(rawBuffs.slayerHelmetStand),
      ensouledSpectralLens: rawBuffs.ensouledSpectralLens === true,
      ...archBuffs,
    },
    archaeology,
    equipmentSlots,
    enchantments,
    equipmentIds: mergeEquipmentIds(equipmentSlots, unlocks),
  };
}
