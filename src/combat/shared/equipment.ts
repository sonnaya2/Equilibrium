import equipmentSetsData from "#data/combat/equipment-sets.json";
import { equipmentById } from "../data";
import {
  AMASCUT_MASTERIES_WIKI_2025_09_29,
  MASTERWORK_WEAPONS_WIKI_2025_05_27,
} from "../data/sources";
import type { EquipmentBonuses, EquipmentSlot } from "../data/records";
import type { CombatModifier, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";

/**
 * Equipment set effects with sourced current numbers. Per-item combat stats live on
 * EquipmentRecord.bonuses (wiki-sourced where filled). Weapon tier still drives base
 * AD and playerAccuracy; do not add weapon Accuracy ratings into playerAccuracy or
 * you double-count the tier curve.
 *
 * Style damage on armour / accessories is not folded into base AD either — ability
 * damage stays level+tier driven (wiki weapon Damage is the face of that tier).
 *
 * Set crit bonuses feed CritLayers.chance, not the modifier pipeline.
 * Catalogue: data/combat/equipment-sets.json (combat-relevant only; no invented numbers).
 */

/** Slots whose Accuracy rating is already encoded by playerAccuracy(level, weaponTier). */
export const WEAPON_ACCURACY_SLOTS: ReadonlySet<EquipmentSlot> = new Set([
  "mainhand",
  "offhand",
  "twohand",
]);

export function isWeaponAccuracySlot(slot: string | null | undefined): boolean {
  return slot != null && WEAPON_ACCURACY_SLOTS.has(slot as EquipmentSlot);
}

export interface SetEffect {
  id: string;
  pieces: number;
  critChanceBonus: number;
  source: SourceReference;
}

/** Effect kinds that feed crit chance or damage modifiers. */
export type SetEffectKind =
  | "critChancePerPiece"
  | "damageMult"
  | "damageMultPerPiece";

export type SetEffectRequires = "sunshine";

export interface EquipmentSetEffectDef {
  minPieces: number;
  kind: SetEffectKind;
  value: number;
  /** Optional combat context gate (e.g. Tumeken Sunshine crit). */
  requires?: SetEffectRequires;
  /** Damage mult stage when kind is damageMult / damageMultPerPiece. */
  stage?: "base" | "onCast";
}

export interface EquipmentSetDef {
  id: string;
  label: string;
  maxPieces: number;
  effects: EquipmentSetEffectDef[];
  /** Wiki facts that are not yet / not ever player-AD modifiers. */
  facts?: string[];
  source: SourceReference;
}

interface EquipmentSetsFile {
  lastSynced: string | null;
  trackedSince: string;
  records: EquipmentSetDef[];
}

const setsFile = equipmentSetsData as EquipmentSetsFile;

/** Data-driven set catalogue (combat-relevant sets only). */
export const EQUIPMENT_SETS: readonly EquipmentSetDef[] = setsFile.records;

const setsById = new Map(EQUIPMENT_SETS.map((s) => [s.id, s]));

export function equipmentSetById(id: string): EquipmentSetDef | undefined {
  return setsById.get(id);
}

export type LoadoutEquipmentView = {
  equipmentSlots?: Partial<Record<string, string | null | undefined>>;
  equipmentIds?: readonly string[] | null;
};

/**
 * Count equipped set pieces from slotted gear (and legacy flat equipmentIds).
 * Uses equipmentById → record.setId. Duplicate item ids count once.
 */
export function equippedSetCounts(loadout: LoadoutEquipmentView): Map<string, number> {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (typeof id !== "string" || seen.has(id)) return;
    seen.add(id);
    const setId = equipmentById(id)?.setId;
    if (!setId) return;
    counts.set(setId, (counts.get(setId) ?? 0) + 1);
  };
  for (const id of Object.values(loadout.equipmentSlots ?? {})) add(id);
  for (const id of loadout.equipmentIds ?? []) add(id);
  return counts;
}

export type SetEffectSummary = { setId: string; pieces: number; label: string };

/**
 * Equipped sets with piece counts for GearPanel. Prefers catalogue labels;
 * unknown setIds still surface with raw id as label.
 */
export function setEffectsSummary(loadout: LoadoutEquipmentView): SetEffectSummary[] {
  const counts = equippedSetCounts(loadout);
  const out: SetEffectSummary[] = [];
  for (const [setId, pieces] of counts) {
    if (pieces <= 0) continue;
    const def = equipmentSetById(setId);
    out.push({ setId, pieces, label: def?.label ?? setId });
  }
  out.sort((a, b) => a.setId.localeCompare(b.setId));
  return out;
}

export type SetCritContext = {
  /** Manual UI perk piece count for tectonic / elite tectonic. */
  tectonicPieces?: number;
  eliteTectonic?: boolean;
  tumekensPieces?: number;
  insideSunshine?: boolean;
};

/**
 * Effective tectonic piece count: max(gear tectonic | elite-tectonic, perk).
 * Elite rate when elite gear is worn OR perk eliteTectonic is set.
 */
export function effectiveTectonicPieces(
  counts: Map<string, number>,
  ctx: SetCritContext = {},
): { pieces: number; elite: boolean } {
  const gearElite = counts.get("elite-tectonic") ?? 0;
  const gearBase = counts.get("tectonic") ?? 0;
  const elite = gearElite > 0 || ctx.eliteTectonic === true;
  const gear = Math.max(gearElite, gearBase);
  const perk = Math.max(0, Math.floor(ctx.tectonicPieces ?? 0));
  return { pieces: Math.max(gear, perk), elite };
}

/** Effective Tumeken piece count: max(gear, perk). */
export function effectiveTumekenPieces(
  counts: Map<string, number>,
  ctx: SetCritContext = {},
): number {
  const gear = counts.get("tumekens-resplendence") ?? 0;
  const perk = Math.max(0, Math.floor(ctx.tumekensPieces ?? 0));
  return Math.max(gear, perk);
}

function effectActive(
  effect: EquipmentSetEffectDef,
  pieces: number,
  ctx: SetCritContext,
): boolean {
  if (pieces < effect.minPieces) return false;
  if (effect.requires === "sunshine" && !ctx.insideSunshine) return false;
  return true;
}

/**
 * Crit chance from a single set definition at `pieces` (no perk merge).
 * Returns 0 when no crit effect is active.
 */
export function setCritChanceFromDef(
  def: EquipmentSetDef,
  pieces: number,
  ctx: SetCritContext = {},
): number {
  const n = Math.max(0, Math.min(def.maxPieces, Math.floor(pieces)));
  let bonus = 0;
  for (const effect of def.effects) {
    if (effect.kind !== "critChancePerPiece") continue;
    if (!effectActive(effect, n, ctx)) continue;
    bonus += n * effect.value;
  }
  return bonus;
}

/**
 * Total set crit chance for a loadout: tectonic/elite + tumeken (Sunshine),
 * using Math.max(gear, perk) so manual UI never double-counts.
 */
export function loadoutSetCritChance(
  loadout: LoadoutEquipmentView & { perks?: SetCritContext | null },
): number {
  const counts = equippedSetCounts(loadout);
  const ctx: SetCritContext = loadout.perks ?? {};
  const { pieces: tecPieces, elite } = effectiveTectonicPieces(counts, ctx);
  const tumPieces = effectiveTumekenPieces(counts, ctx);

  let bonus = 0;
  const tecDef = equipmentSetById(elite ? "elite-tectonic" : "tectonic");
  if (tecDef) bonus += setCritChanceFromDef(tecDef, tecPieces, ctx);

  const tumDef = equipmentSetById("tumekens-resplendence");
  if (tumDef) {
    bonus += setCritChanceFromDef(tumDef, tumPieces, {
      ...ctx,
      insideSunshine: ctx.insideSunshine === true,
    });
  }
  return bonus;
}

/**
 * Outgoing damage CombatModifiers from set catalogue (damageMult kinds only).
 * Current wiki-sourced sets in the catalogue have no player-AD mult effects —
 * returns [] until a sourced damage mult is added to equipment-sets.json.
 */
export function setDamageModifiers(
  counts: Map<string, number>,
  ctx: SetCritContext = {},
): CombatModifier[] {
  const mods: CombatModifier[] = [];
  for (const def of EQUIPMENT_SETS) {
    const pieces = Math.max(0, Math.min(def.maxPieces, counts.get(def.id) ?? 0));
    if (pieces <= 0) continue;
    for (const effect of def.effects) {
      if (effect.kind !== "damageMult" && effect.kind !== "damageMultPerPiece") continue;
      if (!effectActive(effect, pieces, ctx)) continue;
      const mult =
        effect.kind === "damageMultPerPiece" ? 1 + pieces * effect.value : 1 + effect.value;
      if (mult === 1) continue;
      const stage = effect.stage ?? "base";
      mods.push({
        id: `set:${def.id}:${effect.kind}:${pieces}`,
        stage,
        priority: 50,
        applies: () => true,
        apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
        source: def.source,
      });
    }
  }
  return mods;
}

function setCritChance(id: string, pieces: number, perPiece: number, source: SourceReference): SetEffect {
  if (!Number.isInteger(pieces) || pieces < 0 || pieces > 5) {
    throw new RangeError(`${id}: bad piece count ${pieces}`);
  }
  return { id, pieces, critChanceBonus: pieces * perPiece, source };
}

/** Tectonic armour: +1% crit chance per piece; elite tectonic +2% per piece (27 May 2025). */
export const tectonicSet = (pieces: number, elite = false) =>
  setCritChance(elite ? "elite_tectonic" : "tectonic", pieces, elite ? 0.02 : 0.01, MASTERWORK_WEAPONS_WIKI_2025_05_27);

/**
 * Tumeken's resplendence set(3): +1.5% crit chance per piece while inside Sunshine
 * (29 Sep 2025 rebalance). Wiki requires ≥3 pieces for the crit effect.
 */
export function tumekensSunshineSet(pieces: number, insideSunshine: boolean): SetEffect {
  const effect = setCritChance("tumekens_resplendence", pieces, 0.015, AMASCUT_MASTERIES_WIKI_2025_09_29);
  if (!insideSunshine || pieces < 3) return { ...effect, critChanceBonus: 0 };
  return effect;
}

// --- Facts-only helpers (no player AD / crit modifiers) ---

export interface SetFactsResult {
  setId: string;
  pieces: number;
  facts: string[];
  /** Always empty for facts-only sets — no invented AD/crit mods. */
  modifiers: CombatModifier[];
  source: SourceReference;
}

function factsFor(setId: string, pieces: number): SetFactsResult {
  const def = equipmentSetById(setId);
  const n = Math.max(0, Math.floor(pieces));
  return {
    setId,
    pieces: n,
    facts: def?.facts ?? [],
    modifiers: [],
    source: def?.source ?? {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Set_bonus",
      title: setId,
      verifiedAt: "2026-07-26",
    },
  };
}

/** Conjure damage/duration only — 0 player modifiers. */
export const firstNecromancerSetFacts = (pieces: number) => factsFor("first-necromancer", pieces);

/** Herald of Chaos adren/Berserk duration — 0 damage modifiers. */
export const vestmentsOfHavocSetFacts = (pieces: number) => factsFor("vestments-of-havoc", pieces);

/** Death Mark proc chance only — 0 crit/damage modifiers. */
export const deathdealer90SetFacts = (pieces: number) => factsFor("deathdealer-90", pieces);

/** No combat set bonus. */
export const malevolentSetFacts = (pieces: number) => factsFor("malevolent", pieces);

/** Chromatic Choir bolt procs — not crit. */
export const sirenicSetFacts = (pieces: number) => factsFor("sirenic", pieces);

/** Defensive delayed damage — not outgoing AD. */
export const trimmedMasterworkSetFacts = (pieces: number) => factsFor("trimmed-masterwork", pieces);

/** Sum numeric damage/accuracy from equipped piece bonus bags (display totals). */
export function sumEquipmentBonuses(pieces: Iterable<EquipmentBonuses | undefined>): {
  damage: number;
  accuracy: number;
} {
  let damage = 0;
  let accuracy = 0;
  for (const b of pieces) {
    if (!b) continue;
    if (b.damage != null && Number.isFinite(b.damage)) damage += b.damage;
    if (b.accuracy != null && Number.isFinite(b.accuracy)) accuracy += b.accuracy;
  }
  return { damage, accuracy };
}

/**
 * Flat accuracy from non-weapon pieces only (rings, amulets, cape, gloves, armour, …).
 * Pieces without a known slot are skipped so unscoped legacy weapon pins cannot
 * leak a full wiki Accuracy rating into hit chance.
 */
export function sumNonWeaponAccuracy(
  pieces: Iterable<{ slot?: string | null; bonuses?: EquipmentBonuses | null } | null | undefined>,
): number {
  let accuracy = 0;
  for (const p of pieces) {
    if (!p || p.slot == null || isWeaponAccuracySlot(p.slot)) continue;
    const a = p.bonuses?.accuracy;
    if (a != null && Number.isFinite(a)) accuracy += a;
  }
  return accuracy;
}
