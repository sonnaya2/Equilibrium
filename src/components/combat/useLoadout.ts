"use client";

import { useEffect, useState } from "react";
import { equipmentById } from "@/combat/data";
import type { EquipmentSlot } from "@/combat/data/records";
import type { AffinityKind } from "@/combat/target/genericTarget";
import type { CombatStyle } from "@/combat/types";

/** Shared combat loadout: Setup writes, Rotation and Analysis read. Persisted to
 *  localStorage under eq:loadout:v1; older stored shapes normalize forward. */

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
  affinity: AffinityKind;
}

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
  /** Relentless: EV refund of adren cost (1%/rank, no ICD model). Rank 0 = off, max 5. */
  relentless: number;
  relentlessLevel20: boolean;
  tectonicPieces: number;
  eliteTectonic: boolean;
  tumekensPieces: number;
  insideSunshine: boolean;
  /** Planted Feet: base Sunshine / Death's Swiftness ×1.25 duration (→ 63 ticks). */
  plantedFeet: boolean;
}

export type OverloadChoice = "none" | "overload" | "supreme" | "elder";
export type StyleCurseChoice =
  | "none"
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
}

export interface Loadout {
  style: CombatStyle;
  /**
   * Non-melee style level. For melee, alias of strengthLevel (damage/crit).
   * Prefer attackLevel / strengthLevel for melee.
   */
  level: number;
  /** Melee Attack — accuracy only. Mirrors level when not melee. */
  attackLevel: number;
  /** Melee Strength — ability damage + crit damage-from-level. */
  strengthLevel: number;
  weaponTier: number;
  /** Manual base override; NaN means compute from level + weapon tier. */
  base: number;
  accuracy: number;
  critChance: number;
  target: LoadoutTarget | null;
  perks: LoadoutPerks;
  buffs: LoadoutBuffs;
  equipmentSlots: Partial<Record<EquipmentSlot, string | null>>;
  /** Derived: slotted ids + unlock pins. */
  equipmentIds: string[];
}

export const DEFAULT_LOADOUT: Loadout = {
  style: "melee",
  level: 99,
  attackLevel: 99,
  strengthLevel: 99,
  weaponTier: 90,
  base: 1000,
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
    tectonicPieces: 0,
    eliteTectonic: false,
    tumekensPieces: 0,
    insideSunshine: false,
    plantedFeet: false,
  },
  buffs: {
    vulnerability: false,
    styleCurse: "none",
    overload: "none",
  },
  equipmentSlots: {},
  equipmentIds: [],
};

const KEY = "eq:loadout:v1";
const STYLES = ["melee", "ranged", "magic", "necromancy"];
const AFFINITIES = ["weak", "same", "strong", "weakness"];
const STYLE_CURSES: StyleCurseChoice[] = [
  "none",
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

const clampRank = (value: unknown, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(0, Math.floor(Number(value))), max) : 0;
const num = (value: unknown, fallback: number) =>
  Number.isFinite(value) ? Number(value) : fallback;

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
  return {
    ...loadout,
    equipmentSlots: slots,
    equipmentIds: mergeEquipmentIds(slots, unlocks),
  };
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

export function clearEquipment(loadout: Loadout): Loadout {
  return { ...loadout, equipmentSlots: {}, equipmentIds: [] };
}

/** Catalogue id still equippable: present and not unlock.type === "removed". */
export function isKnownEquipmentId(id: string): boolean {
  const rec = equipmentById(id);
  return rec != null && rec.unlock?.type !== "removed";
}

/**
 * Drop slotted ids / unlock pins that no longer exist in the combat equipment
 * catalogue (removed after a corpus trim) or are unlock.type "removed".
 * Inject `known` in tests; default uses isKnownEquipmentId. Orphans leave empty
 * doll cells while still counting as equipped — prune on load/update so counts
 * and localStorage stay honest.
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
  // Only original unlock pins — never convert a pruned slot orphan into a pin.
  const unlocks = unlockOnlyIds(loadout).filter((id) => known(id));
  return {
    ...loadout,
    equipmentSlots: slots,
    equipmentIds: mergeEquipmentIds(slots, unlocks),
  };
}

export function withStyleLevel(loadout: Loadout, level: number): Loadout {
  return { ...loadout, level, attackLevel: level, strengthLevel: level };
}

export function withAttackLevel(loadout: Loadout, attackLevel: number): Loadout {
  return { ...loadout, attackLevel };
}

export function withStrengthLevel(loadout: Loadout, strengthLevel: number): Loadout {
  return { ...loadout, strengthLevel, level: strengthLevel };
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
export function normalizeLoadout(value: unknown): Loadout {
  if (typeof value !== "object" || value === null) return DEFAULT_LOADOUT;
  const raw = value as Partial<Loadout> & {
    level?: unknown;
    attackLevel?: unknown;
    strengthLevel?: unknown;
    equipmentSlots?: unknown;
    buffs?: unknown;
  };
  const rawPerks = (raw.perks ?? {}) as Partial<LoadoutPerks>;
  const rawBuffs = (raw.buffs ?? {}) as Partial<LoadoutBuffs>;
  const rawTarget = raw.target as Partial<LoadoutTarget> | null | undefined;
  const style = STYLES.includes(raw.style as string)
    ? (raw.style as CombatStyle)
    : DEFAULT_LOADOUT.style;

  const hasAttack = Number.isFinite(raw.attackLevel);
  const hasStrength = Number.isFinite(raw.strengthLevel);
  const hasLevel = Number.isFinite(raw.level);
  const legacyLevel = num(raw.level, DEFAULT_LOADOUT.level);
  let attackLevel = hasAttack ? num(raw.attackLevel, legacyLevel) : legacyLevel;
  let strengthLevel = hasStrength ? num(raw.strengthLevel, legacyLevel) : legacyLevel;
  let level = hasLevel ? legacyLevel : strengthLevel;

  if (style === "melee") {
    level = strengthLevel;
  } else {
    if (!hasLevel && (hasAttack || hasStrength)) {
      level = hasStrength ? strengthLevel : attackLevel;
    }
    attackLevel = level;
    strengthLevel = level;
  }

  const equipmentSlots = normalizeEquipmentSlots(raw.equipmentSlots);
  const legacyIds = Array.isArray(raw.equipmentIds)
    ? raw.equipmentIds.filter((id): id is string => typeof id === "string")
    : [];
  const slotted = new Set(equipmentIdList(equipmentSlots));
  const unlocks = legacyIds.filter((id) => !slotted.has(id));

  return {
    style,
    level,
    attackLevel,
    strengthLevel,
    weaponTier: num(raw.weaponTier, DEFAULT_LOADOUT.weaponTier),
    base: num(raw.base, DEFAULT_LOADOUT.base),
    accuracy: num(raw.accuracy, DEFAULT_LOADOUT.accuracy),
    critChance: num(raw.critChance, DEFAULT_LOADOUT.critChance),
    target:
      rawTarget && AFFINITIES.includes(rawTarget.affinity as string)
        ? {
            defenceLevel: num(rawTarget.defenceLevel, 80),
            affinity: rawTarget.affinity as AffinityKind,
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
      tectonicPieces: clampRank(rawPerks.tectonicPieces, 5),
      eliteTectonic: rawPerks.eliteTectonic === true,
      tumekensPieces: clampRank(rawPerks.tumekensPieces, 5),
      insideSunshine: rawPerks.insideSunshine === true,
      plantedFeet: rawPerks.plantedFeet === true,
    },
    buffs: {
      vulnerability: rawBuffs.vulnerability === true,
      styleCurse: STYLE_CURSES.includes(rawBuffs.styleCurse as StyleCurseChoice)
        ? (rawBuffs.styleCurse as StyleCurseChoice)
        : "none",
      overload: OVERLOADS.includes(rawBuffs.overload as OverloadChoice)
        ? (rawBuffs.overload as OverloadChoice)
        : "none",
    },
    equipmentSlots,
    equipmentIds: mergeEquipmentIds(equipmentSlots, unlocks),
  };
}

export function useLoadout() {
  const [loadout, setLoadout] = useState<Loadout>(DEFAULT_LOADOUT);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (!stored) return;
      const cleaned = pruneUnknownEquipment(normalizeLoadout(JSON.parse(stored)));
      setLoadout(cleaned);
      // Persist prune so retired/orphan ids do not reappear every boot.
      try {
        window.localStorage.setItem(KEY, JSON.stringify(cleaned));
      } catch {
        // Storage full/blocked — in-memory prune still applies.
      }
    } catch {
      // Corrupt storage falls back to defaults.
    }
  }, []);

  const update = (next: Loadout) => {
    const withLevels =
      next.style === "melee"
        ? { ...next, level: next.strengthLevel }
        : { ...next, attackLevel: next.level, strengthLevel: next.level };
    const unlocks = unlockOnlyIds(withLevels);
    const normalized = pruneUnknownEquipment({
      ...withLevels,
      equipmentSlots: withLevels.equipmentSlots ?? {},
      equipmentIds: mergeEquipmentIds(withLevels.equipmentSlots ?? {}, unlocks),
    });
    setLoadout(normalized);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(normalized));
    } catch {
      // Storage full/blocked — session state still works.
    }
  };

  return [loadout, update] as const;
}
