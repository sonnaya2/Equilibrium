import aurasData from "#data/combat/auras.json";
import type { CombatContext, CombatModifier, CombatStyle, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";

/**
 * Historical combat auras (removed 2 Mar / 13 Apr 2026). Catalogue is for
 * Catalyst/legacy loadout comparison only — not Equilibrium baseline.
 *
 * Static damage % → CombatModifier when the aura slot is equipped and style matches.
 * Accuracy / level / lifesteal / proc effects are documented on the record; only
 * flat ability-damage mults enter the modifier pipeline.
 */

export type AuraStyle = CombatStyle | "hybrid";

export interface AuraDef {
  id: string;
  equipmentId: string;
  name: string;
  status: "removed";
  removedAt: string;
  tier: number;
  style: AuraStyle;
  durationMinutes: number;
  cooldownHours: number;
  /** Ability damage mult fraction (0.1 = +10%). Null when no static damage % (procs/sustain). */
  damageBonus: number | null;
  /** Invisible hit-chance mult fraction. Documented; not wired into DP yet. */
  accuracyBonus: number | null;
  styleLevelBoostPercent: number | null;
  defenceLevelReductionPercent: number | null;
  damageTakenIncrease: number | null;
  preventsCriticalStrikes: boolean;
  lifestealPercent?: number;
  lifestealCapPerHit?: number;
  facts: string[];
  sources: SourceReference[];
  successor?: { kind: string; name: string; url: string };
}

interface AurasFile {
  lastSynced: string | null;
  trackedSince: string;
  policy?: Record<string, unknown>;
  records: AuraDef[];
}

const file = aurasData as AurasFile;

export const COMBAT_AURAS: readonly AuraDef[] = file.records;

const byEquipmentId = new Map(COMBAT_AURAS.map((a) => [a.equipmentId, a]));
const byId = new Map(COMBAT_AURAS.map((a) => [a.id, a]));

export function auraByEquipmentId(equipmentId: string | null | undefined): AuraDef | undefined {
  if (typeof equipmentId !== "string") return undefined;
  return byEquipmentId.get(equipmentId);
}

export function auraById(id: string): AuraDef | undefined {
  return byId.get(id);
}

export function auraStyleMatches(def: AuraDef, style: CombatStyle): boolean {
  return def.style === "hybrid" || def.style === style;
}

/** Primary source on the record (first entry). */
function primarySource(def: AuraDef): SourceReference {
  return def.sources[0] ?? {
    source: "runescape-wiki",
    url: "https://runescape.wiki/w/Aura",
    verifiedAt: "2026-07-26",
  };
}

/**
 * Damage CombatModifier for a static damage-bonus aura, or null when the aura
 * has no static damage % (Dark magic, Vampyrism) or bonus is zero.
 */
export function auraDamageModifier(def: AuraDef): CombatModifier | null {
  const bonus = def.damageBonus;
  if (bonus == null || bonus === 0) return null;
  const mult = 1 + bonus;
  const stage = def.preventsCriticalStrikes ? "base" : "ability";
  return {
    id: `${def.id}:damage`,
    stage,
    priority: def.preventsCriticalStrikes ? 100 : 20,
    applies: (context: CombatContext) => auraStyleMatches(def, context.style),
    apply: (state) => ({ damage: mulFloor(state.damage, mult) }),
    source: primarySource(def),
  };
}

export type AuraLoadoutView = {
  equipmentSlots?: Partial<Record<string, string | null | undefined>>;
};

/** Aura record equipped in the historical aura slot, if any. */
export function equippedAura(loadout: AuraLoadoutView): AuraDef | undefined {
  return auraByEquipmentId(loadout.equipmentSlots?.aura);
}

/** Damage modifiers for the equipped aura (0–1 entries). */
export function auraDamageModifiers(loadout: AuraLoadoutView): CombatModifier[] {
  const def = equippedAura(loadout);
  if (!def) return [];
  const mod = auraDamageModifier(def);
  return mod ? [mod] : [];
}

/** True when equipped aura blocks critical strikes (Equilibrium aura). */
export function auraBlocksCrits(loadout: AuraLoadoutView): boolean {
  return equippedAura(loadout)?.preventsCriticalStrikes === true;
}
