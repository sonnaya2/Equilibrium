import equipmentSetsData from "#shard/combat/equipment-sets.json";
import { equipmentById } from "../data";
import type { EquipmentBonuses, EquipmentSlot, ItemPassiveId, WeaponClass } from "../data/records";
import type { CritLayers } from "../core/critical";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { CombatModifier, CombatStyle, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";
import { equipmentRecordPassiveIds } from "./requirements";
import { setEffectSupport, type SetEffectSupport } from "../equipmentSets/support";
import {
  IGNEOUS_ULTIMATE_PASSIVE_SET,
  LENG_PASSIVES,
  LENG_PASSIVE_SET,
  igneousCombinedPresentation,
  lengCombinedPresentation,
  presentPassive,
  presentationContextFromEffects,
  type PassiveSupport,
} from "../passives";

export type { SetEffectSupport, PassiveSupport };

/**
 * Equipment set effects with sourced current numbers. Per-item combat stats live on
 * EquipmentRecord.bonuses (wiki-sourced where filled). Weapon tier still drives base
 * AD and playerAccuracy; adding weapon Accuracy would count the tier curve twice.
 *
 * Style damage on armour / accessories is not folded into base AD either - ability
 * damage stays level+tier driven (wiki weapon Damage is the face of that tier).
 *
 * Set crit bonuses feed CritLayers.chance, not the modifier pipeline.
 * Catalogue: data/combat/equipment-sets.json contains combat-relevant facts only.
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

/** Effect kinds that feed crit chance or damage modifiers. */
export type SetEffectKind = "critChancePerPiece" | "damageMult" | "damageMultPerPiece";

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

/** Slots a two-handed weapon overrides: when twohand is occupied, both hands are locked. */
export const TWOHAND_LOCKED_SLOTS: readonly string[] = ["mainhand", "offhand"];

/**
 * The canonical equipped state, and the only correct answer to "what is the
 * player actually wearing". A stored main-hand or off-hand survives a switch to
 * a two-handed weapon in persisted loadouts, imports and hand-built fixtures, so
 * reading `equipmentSlots` directly sees gear the game would have unequipped.
 * Every consumer - stat aggregation, weapon configuration, passives, sets, and
 * the League blessings that ask what is being wielded - resolves through here.
 */
export function resolvedEquipmentSlots(loadout: LoadoutEquipmentView): Record<string, string> {
  const slots = loadout.equipmentSlots ?? {};
  const twohandEquipped = typeof slots.twohand === "string";
  const resolved: Record<string, string> = {};
  for (const [slot, id] of Object.entries(slots)) {
    if (typeof id !== "string") continue;
    if (twohandEquipped && TWOHAND_LOCKED_SLOTS.includes(slot)) continue;
    resolved[slot] = id;
  }
  return resolved;
}

/**
 * The off-hand item genuinely being wielded, in the two categories Teragard's
 * Aegis distinguishes. Driven purely by the equipped record's own `shield` /
 * `defender` classification, so an ability that grants a shield effect without
 * one in hand - Necromancy's Bone Shield - never reads as a wielded shield, and
 * a Necromancy conduit reads as neither.
 */
export function wieldedOffhandKind(loadout: LoadoutEquipmentView): "shield" | "defender" | null {
  const id = resolvedEquipmentSlots(loadout).offhand;
  const record = id === undefined ? undefined : equipmentById(id);
  return record?.defender ? "defender" : record?.shield ? "shield" : null;
}

const SET_PIECE_WEIGHTS: Readonly<Record<string, number>> = {
  // The combined crown + death mask occupies one slot but counts twice.
  "item:visage-of-the-first-necromancer": 2,
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
    const max = equipmentSetById(setId)?.maxPieces ?? Number.POSITIVE_INFINITY;
    counts.set(setId, Math.min(max, (counts.get(setId) ?? 0) + (SET_PIECE_WEIGHTS[id] ?? 1)));
  };
  for (const id of Object.values(resolvedEquipmentSlots(loadout))) add(id);
  for (const id of loadout.equipmentIds ?? []) add(id);
  return counts;
}

export const EQUIPMENT_SET_ACTIVATION = "pre-activated-static-loadout" as const;

export const EQUIPMENT_ENCHANTMENTS = ["agony", "heroism", "shadows", "metaphysics"] as const;
export type EquipmentEnchantmentId = (typeof EQUIPMENT_ENCHANTMENTS)[number];

export interface ActiveEquipmentEffects {
  activation: typeof EQUIPMENT_SET_ACTIVATION;
  passiveIds: readonly ItemPassiveId[];
  enchantments: readonly EquipmentEnchantmentId[];
  weaponClass: WeaponClass | null;
  defenderEquipped: boolean;
  passage: {
    active: boolean;
    agonyActive: boolean;
  };
  amZiFlatDamage: number;
  amHejDamageBonus: number;
  vestments: {
    pieces: number;
    heraldOfChaos: boolean;
    berserkExtension: boolean;
    increasedAdrenalineCap: boolean;
  };
}

/** Active set effects for the fixed loadout the simulator starts with at tick 0. */
export function activeEquipmentEffects(
  loadout: LoadoutEquipmentView & {
    style?: CombatStyle;
    enchantments?: readonly EquipmentEnchantmentId[];
    effectiveAttackLevel?: number;
    effectiveStrengthLevel?: number;
  },
): ActiveEquipmentEffects {
  const pieces = Math.min(4, equippedSetCounts(loadout).get("vestments-of-havoc") ?? 0);
  const slots = resolvedEquipmentSlots(loadout);
  const weaponId = slots.twohand ?? slots.mainhand;
  const weapon = weaponId ? equipmentById(weaponId) : undefined;
  const offhandId = slots.offhand;
  const offhand = offhandId ? equipmentById(offhandId) : undefined;
  const meleeWeapon = weaponId ? weapon?.style === "melee" : loadout.style === "melee";
  const passiveIds = [
    ...new Set(
      Object.values(slots).flatMap((id) => {
        const item = equipmentById(id);
        if (!item) return [] as ItemPassiveId[];
        return [
          ...equipmentRecordPassiveIds(item),
          ...(item.defender ? (["defender-accuracy"] as const) : []),
        ];
      }),
    ),
  ];
  const enchantments = [
    ...new Set(
      (loadout.enchantments ?? []).filter((id): id is EquipmentEnchantmentId =>
        EQUIPMENT_ENCHANTMENTS.includes(id),
      ),
    ),
  ];
  const passageActive = passiveIds.includes("enduring-ruin");
  return {
    activation: EQUIPMENT_SET_ACTIVATION,
    passiveIds,
    enchantments,
    weaponClass:
      loadout.style === "ranged" && weapon?.style === "ranged"
        ? (weapon.weaponClass ?? null)
        : null,
    defenderEquipped: offhand?.defender === true,
    passage: {
      active: passageActive,
      agonyActive:
        passageActive &&
        loadout.equipmentSlots?.gloves === "item:enhanced-gloves-of-passage" &&
        enchantments.includes("agony"),
    },
    amZiFlatDamage: passiveIds.includes("am-zi")
      ? Math.floor((loadout.effectiveAttackLevel ?? 0) * 1.35)
      : 0,
    amHejDamageBonus: passiveIds.includes("am-hej")
      ? Math.floor((loadout.effectiveStrengthLevel ?? 0) * 0.05) / 100
      : 0,
    vestments: {
      pieces,
      heraldOfChaos: meleeWeapon && pieces >= 2,
      berserkExtension: meleeWeapon && pieces >= 3,
      increasedAdrenalineCap: meleeWeapon && pieces >= 4,
    },
  };
}

export function hasPassive(
  effects: ActiveEquipmentEffects | undefined,
  id: ItemPassiveId,
): boolean {
  return effects?.passiveIds.includes(id) === true;
}

export function hasEnchantment(
  effects: ActiveEquipmentEffects | undefined,
  id: EquipmentEnchantmentId,
): boolean {
  return effects?.enchantments.includes(id) === true;
}

const itemSource = (title: string, path: string): SourceReference => ({
  source: "runescape-wiki",
  url: `https://runescape.wiki/w/${path}`,
  title,
  verifiedAt: "2026-08-01",
});

export const AM_ZI_SOURCE = itemSource("Am-zi", "Am-zi");
export const AM_HEJ_SOURCE = itemSource("Am-hej", "Am-hej");
export const ENDURING_RUIN_SOURCE = itemSource("Gloves of passage", "Gloves_of_passage");
export const REX_RING_SOURCE = itemSource("Critical strike", "Critical_strike");

export function amZiModifier(flatDamage: number): CombatModifier {
  return {
    id: "item:am-zi",
    stage: "roll",
    priority: 100,
    applies: (context) => context.style === "melee" && context.dotKind !== "bleed",
    apply: (state) => ({ ...state, damage: state.damage + flatDamage }),
    source: AM_ZI_SOURCE,
  };
}

/** Frostblades: flat damage equal to 24% of ability damage on melee ability hits. */
export function frostbladesModifier(flatDamage: number): CombatModifier {
  return {
    id: "item:frostblades",
    stage: "roll",
    priority: 101,
    applies: (context) => context.style === "melee" && context.dotKind !== "bleed",
    apply: (state) => ({ ...state, damage: state.damage + flatDamage }),
    source: {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Dark_Sliver_of_Leng",
      title: "Dark Sliver of Leng",
      verifiedAt: "2026-08-02",
    },
  };
}

export function amHejDamageBonus(effectiveStrengthLevel: number): number {
  return Math.floor(effectiveStrengthLevel * 0.05) / 100;
}

export function additiveMeleeDamageModifier(
  bonus: number,
  source: SourceReference = AM_HEJ_SOURCE,
): CombatModifier {
  return {
    id: "item:additive-melee",
    stage: "onCast",
    priority: 90,
    applies: (context) => context.style === "melee" && context.dotKind !== "bleed",
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1 + bonus) }),
    source,
  };
}

export function staticEquipmentCritBonus(effects: ActiveEquipmentEffects): {
  chance: number;
  damageBonus: number;
} {
  if (hasPassive(effects, "reaver-ring")) return { chance: 0.05, damageBonus: 0 };
  if (hasPassive(effects, "stalker-ring") && effects.weaponClass === "bow") {
    return hasEnchantment(effects, "shadows")
      ? { chance: 0.04, damageBonus: 0.03 }
      : { chance: 0.03, damageBonus: 0 };
  }
  return { chance: 0, damageBonus: 0 };
}

export function dynamicEquipmentCritBonus(
  effects: ActiveEquipmentEffects | undefined,
  ability: Pick<AbilitySpec, "style" | "channelTicks">,
  hitIndex: number,
  activeBleeds: number,
): { chance: number; damageBonus: number } {
  let chance = 0;
  let damageBonus = 0;
  if (activeBleeds > 0 && hasPassive(effects, "champion-ring")) {
    chance += hasEnchantment(effects, "heroism") ? 0.04 : 0.03;
    if (hasEnchantment(effects, "heroism")) damageBonus += activeBleeds * 0.015;
  }
  if (
    ability.style === "magic" &&
    ability.channelTicks != null &&
    hasPassive(effects, "channeller-ring")
  ) {
    const step = hitIndex + 1;
    chance += step * 0.04;
    if (hasEnchantment(effects, "metaphysics")) damageBonus += step * 0.025;
  }
  return { chance, damageBonus };
}

export function equipmentCritByHit(
  effects: ActiveEquipmentEffects,
  ability: AbilitySpec,
  crit: Omit<CritLayers, "eligible">,
): Omit<CritLayers, "eligible">[] {
  return ability.hits.map((_, hitIndex) => {
    const bonus = dynamicEquipmentCritBonus(effects, ability, hitIndex, 0);
    return {
      ...crit,
      chance: crit.chance + bonus.chance,
      damageBonus: (crit.damageBonus ?? 0) + bonus.damageBonus,
    };
  });
}

export function applyEquipmentDamagePotential(
  damagePotential: number,
  effects: ActiveEquipmentEffects,
): number {
  return Math.min(
    1,
    Math.max(0, damagePotential - (hasPassive(effects, "reaver-ring") ? 0.05 : 0)),
  );
}

/** Defender-class gear multiplies accuracy before the hit-chance formula. */
export function applyEquipmentAccuracy(accuracy: number, effects: ActiveEquipmentEffects): number {
  return effects.defenderEquipped ? accuracy * 1.03 : accuracy;
}

export interface EquippedPassiveSummary {
  passiveId: ItemPassiveId;
  itemId: string;
  itemName: string;
  label: string;
  effects: readonly string[];
  support: PassiveSupport;
  source: SourceReference;
}

/** Equipped passive rows for Gear. Item identity and source stay catalogue-driven. */
export function equippedPassiveSummaries(
  loadout: LoadoutEquipmentView & {
    style?: CombatStyle;
    enchantments?: readonly EquipmentEnchantmentId[];
  },
): EquippedPassiveSummary[] {
  const effects = activeEquipmentEffects(loadout);
  const presentCtx = presentationContextFromEffects(effects);
  const seenItems = new Set<string>();
  const seenPassives = new Set<ItemPassiveId>();
  const rows: EquippedPassiveSummary[] = [];
  for (const id of Object.values(resolvedEquipmentSlots(loadout))) {
    if (seenItems.has(id)) continue;
    seenItems.add(id);
    const item = equipmentById(id);
    if (!item || !item.sources[0]) continue;
    const passiveList: ItemPassiveId[] = [
      ...equipmentRecordPassiveIds(item),
      ...(item.defender ? (["defender-accuracy"] as const) : []),
    ];
    const igneousOnItem = passiveList.filter((p) => IGNEOUS_ULTIMATE_PASSIVE_SET.has(p));
    const lengOnItem = passiveList.filter((p) => LENG_PASSIVE_SET.has(p));
    const otherOnItem = passiveList.filter(
      (p) => !IGNEOUS_ULTIMATE_PASSIVE_SET.has(p) && !LENG_PASSIVE_SET.has(p),
    );

    // Kal-Zuk (and any multi-igneous grant): one Gear row, not four.
    if (igneousOnItem.length > 1) {
      const fresh = igneousOnItem.filter((p) => !seenPassives.has(p));
      for (const p of fresh) seenPassives.add(p);
      if (fresh.length > 0) {
        rows.push({
          passiveId: fresh[0]!,
          itemId: item.id,
          itemName: item.name,
          source: item.sources[0],
          ...igneousCombinedPresentation(),
        });
      }
    } else if (igneousOnItem.length === 1) {
      const passiveId = igneousOnItem[0]!;
      if (!seenPassives.has(passiveId)) {
        seenPassives.add(passiveId);
        rows.push({
          passiveId,
          itemId: item.id,
          itemName: item.name,
          source: item.sources[0],
          ...presentPassive(passiveId, presentCtx),
        });
      }
    }

    // Dual-wield Leng: collapse to one pair row when both passives are equipped.
    for (const passiveId of lengOnItem) {
      if (seenPassives.has(passiveId)) continue;
      const bothActive =
        effects.passiveIds.includes("leng-endless-frost") &&
        effects.passiveIds.includes("leng-boundless-chill");
      if (bothActive) {
        for (const p of LENG_PASSIVES) seenPassives.add(p);
        rows.push({
          passiveId: "leng-endless-frost",
          itemId: item.id,
          itemName: "Dark Shard & Sliver of Leng",
          source: item.sources[0],
          ...lengCombinedPresentation(),
        });
        break;
      }
      seenPassives.add(passiveId);
      rows.push({
        passiveId,
        itemId: item.id,
        itemName: item.name,
        source: item.sources[0],
        ...presentPassive(passiveId, presentCtx),
      });
    }

    for (const passiveId of otherOnItem) {
      if (seenPassives.has(passiveId)) continue;
      seenPassives.add(passiveId);
      rows.push({
        passiveId,
        itemId: item.id,
        itemName: item.name,
        source: item.sources[0],
        ...presentPassive(passiveId, presentCtx),
      });
    }
  }
  return rows;
}

/** Herald of Chaos: 15% over 18s after a melee ultimate. */
export const VESTMENTS_REGEN_SECONDS = 18;
/** Instant grant when a second melee ultimate lands during the regen window. */
export const VESTMENTS_INSTANT_ON_REFRESH = 20;
/** Passive rate: 15% / secondsToTicks(18) = 0.5 per tick. */
export const VESTMENTS_REGEN_PER_TICK = 0.5;

export function vestmentsUltimateEligible(
  effects: ActiveEquipmentEffects | undefined,
  ability: { style: CombatStyle; category: string },
): boolean {
  return (
    effects?.vestments.heraldOfChaos === true &&
    ability.style === "melee" &&
    ability.category === "ultimate"
  );
}

export type SetEffectSummary = {
  setId: string;
  pieces: number;
  label: string;
  support: SetEffectSupport;
};

export { setEffectSupport };

/**
 * Equipped sets with piece counts for GearPanel.
 * Only catalogue set definitions surface here - raw grouping tags on items
 * (e.g. setId "igneous" / "leng") are not combat sets and must not paint empty cards.
 */
export function setEffectsSummary(loadout: LoadoutEquipmentView): SetEffectSummary[] {
  const counts = equippedSetCounts(loadout);
  const out: SetEffectSummary[] = [];
  for (const [setId, pieces] of counts) {
    if (pieces <= 0) continue;
    const def = equipmentSetById(setId);
    if (!def) continue;
    out.push({
      setId,
      pieces: Math.min(def.maxPieces, pieces),
      label: def.label,
      support: setEffectSupport(def),
    });
  }
  out.sort((a, b) => a.setId.localeCompare(b.setId));
  return out;
}

export type SetCritContext = {
  insideSunshine?: boolean;
};

/** Effective tectonic piece count comes only from equipped catalogue records. */
export function effectiveTectonicPieces(counts: Map<string, number>): {
  pieces: number;
  elite: boolean;
} {
  const gearElite = counts.get("elite-tectonic") ?? 0;
  const gearBase = counts.get("tectonic") ?? 0;
  return { pieces: Math.max(gearElite, gearBase), elite: gearElite > 0 };
}

/** Effective Tumeken piece count comes only from equipped catalogue records. */
export function effectiveTumekenPieces(counts: Map<string, number>): number {
  return counts.get("tumekens-resplendence") ?? 0;
}

function effectActive(effect: EquipmentSetEffectDef, pieces: number, ctx: SetCritContext): boolean {
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
 * Total set crit chance from equipped gear. Tumeken's bonus requires a live
 * Sunshine context; the rotation engine supplies that at hit land time.
 */
export function loadoutSetCritChance(loadout: LoadoutEquipmentView & SetCritContext): number {
  const counts = equippedSetCounts(loadout);
  const { pieces: tecPieces, elite } = effectiveTectonicPieces(counts);
  const tumPieces = effectiveTumekenPieces(counts);

  let bonus = 0;
  const tecDef = equipmentSetById(elite ? "elite-tectonic" : "tectonic");
  if (tecDef) bonus += setCritChanceFromDef(tecDef, tecPieces, loadout);

  const tumDef = equipmentSetById("tumekens-resplendence");
  if (tumDef) {
    bonus += setCritChanceFromDef(tumDef, tumPieces, {
      insideSunshine: loadout.insideSunshine === true,
    });
  }
  return bonus;
}

/**
 * Outgoing player ability-damage CombatModifiers from set catalogue
 * (damageMult / damageMultPerPiece only). First Necromancer conjure mult is
 * separate (firstNecromancerConjureDamageMult) - not player AD.
 * Catalogue currently has no player-AD mult effects; returns [] until one is
 * sourced into equipment-sets.json.
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

/**
 * First Necromancer robes set(2+): +7% conjure spirit basic-attack damage per
 * piece (wiki, cap 5). Returns 1 when pieces < 2. Not player ability AD;
 * apply to spirit autos only (not poison / commands).
 * https://runescape.wiki/w/First_Necromancer%27s_equipment
 */
export function firstNecromancerConjureDamageMult(pieces: number): number {
  const n = Math.max(0, Math.min(5, Math.floor(pieces)));
  if (n < 2) return 1;
  return 1 + 0.07 * n;
}

/** First Necromancer set(4+): +5% conjure lifetime per effective piece. */
export function firstNecromancerConjureDurationMult(pieces: number): number {
  const n = Math.max(0, Math.min(5, Math.floor(pieces)));
  return n < 4 ? 1 : 1 + 0.05 * n;
}

/** Equipped first-necromancer piece count → conjure basic mult (1 if none / <2). */
export function loadoutFirstNecromancerConjureDamageMult(loadout: LoadoutEquipmentView): number {
  return firstNecromancerConjureDamageMult(
    equippedSetCounts(loadout).get("first-necromancer") ?? 0,
  );
}

export function loadoutFirstNecromancerConjureDurationMult(loadout: LoadoutEquipmentView): number {
  return firstNecromancerConjureDurationMult(
    equippedSetCounts(loadout).get("first-necromancer") ?? 0,
  );
}

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
