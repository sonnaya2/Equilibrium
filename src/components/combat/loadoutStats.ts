import {
  equippedSetCounts,
  setEffectsSummary,
  sumEquipmentBonuses,
} from "@/combat/shared/equipment";
import { equipmentById } from "@/combat/data";
import type { AdrenalineRules, ProcRules } from "@/combat/engine/simulation/simulate";
import type { CombatModifier, CombatContext } from "@/combat/types";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { CritLayers } from "@/combat/core/critical";
import type { HitCapRule } from "@/combat/core/hitCaps";
import type { DefenceStats } from "@/combat/core/defence";
import type { LifePointStats } from "@/combat/core/lifePoints";
import {
  aggregateLoadoutEquipment,
  type EquipmentStatTotals,
} from "@/combat/shared/equipmentStats";
import type { ActiveEquipmentEffects } from "@/combat/shared/equipment";
import type { AegisArmourBonus, ResolvedLeagueRules } from "@/combat/league/ruleset";
import type { BarkscalesOutcome } from "@/combat/league/barkscales";
import type { IcyenicFaithBonuses, IcyenicProtectionOutcome } from "@/combat/league/icyenicFaith";
import { type Loadout } from "./useLoadout";
import {
  equippedRecordIds,
  equipmentStyleDamageBonus,
  equipmentStyleDamageContributions,
  equippedWeaponTier,
  loadoutWeaponTier,
  loadoutAttackLevel,
  loadoutDamageLevel,
  loadoutOverloadTier,
  loadoutEffectiveDamageLevel,
  loadoutWeaponConfig,
  computedLoadoutBase,
  loadoutBase,
} from "./loadout/weaponConfiguration";
import {
  critDamageStats,
  powerburstRemainingTicks,
  resolveAccuracyDp,
  resolveBaseDamage,
  resolveCombatRules,
  resolveCrit,
  resolveDefenceLife,
  resolveEquipment,
  resolveLeagueBundle,
  resolveLeagueSelection,
  resolveLevels,
  resolveSlayerSalve,
  type BerserkersFuryResolved,
  type LoadoutStatsOptions,
} from "./loadout/resolveStages";
import type {
  SerializableSalveSource,
  SerializableSlayerHelmetSource,
} from "@/combat/solver/worker/serializable";

/** Re-export for GearPanel / setup consumers. */
export { equippedSetCounts, setEffectsSummary };
/** Weapon/offence derivation lives in loadout/weaponConfiguration. */
export {
  equipmentStyleDamageBonus,
  equipmentStyleDamageContributions,
  equippedWeaponTier,
  loadoutWeaponTier,
  loadoutAttackLevel,
  loadoutDamageLevel,
  loadoutOverloadTier,
  loadoutEffectiveDamageLevel,
  loadoutWeaponConfig,
  computedLoadoutBase,
  loadoutBase,
};
export { critDamageStats, powerburstRemainingTicks, type LoadoutStatsOptions };
export {
  resolveLevels,
  resolveEquipment,
  resolveDefenceLife,
  resolveLeagueBundle,
  resolveAccuracyDp,
  resolveBaseDamage,
  resolveCrit,
  resolveCombatRules,
  resolveSlayerSalve,
  sumBreakdown,
} from "./loadout/resolveStages";

/**
 * Pure derivation of engine inputs from a Setup loadout - single place tabs
 * resolve "what does this loadout mean numerically". Stages live in
 * `loadout/resolveStages.ts`; this orchestrator only assembles `CalcStats`.
 */

export interface CalcStats {
  combatStyle: string;
  baseDamageMode: "automatic" | "manual";
  rawBase: number;
  base: number;
  /**
   * Level feeding the crit damage layer. Strength for melee; style level for
   * Ranged / Magic / Necromancy. Base AD uses loadoutEffectiveDamageLevel.
   */
  level: number;
  /** Level feeding playerAccuracy when the target model is active. */
  attackLevel: number;
  dp: number;
  /**
   * Total player Accuracy rating: level+tier curve plus Energising and non-weapon
   * flat accuracy. The same value feeds the target-model Damage Potential.
   */
  accuracyRating: number;
  /** Named sources for the setup summary dropdowns - zero rows are filtered in the UI. */
  baseAbilityDamageBreakdown: readonly { label: string; value: number }[];
  equipmentDamageBreakdown: readonly { label: string; value: number }[];
  accuracyBreakdown: readonly { label: string; value: number }[];
  armourBreakdown: readonly { label: string; value: number }[];
  armourRatingBreakdown: readonly { label: string; value: number }[];
  defenceBreakdown: readonly { label: string; value: number }[];
  critChance: number;
  critChanceBreakdown: {
    configured: number;
    biting: number;
    sets: number;
    equipment: number;
    icyenic?: number;
    trueEquilibrium?: number;
    adjustment: number;
  };
  /** Named static crit sources (rings/sets) for the Setup breakdown. */
  critChanceSources: readonly { label: string; value: number }[];
  critDamageSources: readonly { label: string; value: number }[];
  /**
   * Situational crit that is modelled at land/cast time but not in the static
   * total - Channeller's channel stacking, Champion's bleed window, etc.
   */
  critConditionalNotes: readonly string[];
  /** Style-mismatched style-gear (e.g. Channeller's on a melee loadout). */
  styleMismatchNotes: readonly string[];
  critsDisabled: boolean;
  /** Persistent equipment crit-damage bonus (conditional ability/runtime bonuses excluded). */
  critDamageBonus: number;
  /** Level-derived base crit damage multiplier (+50% at level 90). */
  baseCritDamage: number;
  /** baseCritDamage plus the persistent equipment bonus - the static loadout total. */
  totalCritDamage: number;
  /** Display-ready bonuses above a normal hit (0.5 means +50%). */
  baseCritDamageBonus: number;
  totalCritDamageBonus: number;
  activePassives: readonly string[];
  critByHitFor: (
    ability: AbilitySpec,
    crit: Omit<CritLayers, "eligible">,
  ) => Omit<CritLayers, "eligible">[];
  cap: HitCapRule;
  startingAdrenaline: number;
  maxAdrenaline: number;
  effectiveDamageLevel: number;
  mainhandTier: number;
  offhandTier: number | null;
  spellTier: number | null;
  ammunitionTier: number | null;
  equipmentStyleDamageBonus: number;
  styleDamageBonus: number;
  damagePotentialSource: "target stats" | "target weakness" | "manual override" | "100% assumption";
  equipmentIds: readonly string[];
  weaponConfiguration: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";
  weaponTierOverride: number | null;
  globalModifiers: CombatModifier[];
  castModifiersFor: (ability: AbilitySpec) => CombatModifier[];
  /** Invigorating / Impatient rules for rotation + revolution sim. */
  adrenaline?: AdrenalineRules;
  /** Stateful Crackling / Aftershock rules for rotation + revolution simulation. */
  procs?: ProcRules;
  /** Planted Feet: base Sunshine / Death's Swiftness duration ×1.25. */
  plantedFeet?: boolean;
  /** Strength cape (99): Dismember +3 bleed hits. */
  strengthCape99?: boolean;
  /** Attack master cape (120): +2% melee hit chance (active for melee loadouts only). */
  attackCape120?: boolean;
  /** Precise perk rank 1-6 for sim hit bands. */
  preciseRank?: number;
  /**
   * First Necromancer set mult on conjure spirit basic autos (1 if set inactive).
   * Pass to SimulateInput.conjureBasicDamageMult.
   */
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  tumekensPieces?: number;
  tumekensCritEnabled?: boolean;
  equipmentEffects: ActiveEquipmentEffects;
  equipment: EquipmentStatTotals;
  defence: DefenceStats;
  life: LifePointStats;
  league: ResolvedLeagueRules;
  combatContext: CombatContext;
  leagueBaseAbilityDamageBonus: number;
  leagueBaseAbilityDamageMultiplier: number;
  /** Diagnostic breakdown of the Aegis armour conversion; zeroed without the blessing. */
  aegis: AegisArmourBonus;
  /** Barkscales resolved against the stated incoming scenario, or marked unavailable. */
  barkscales: BarkscalesOutcome;
  /** Icyenic Faith prayer scaling (zero mult when relic off or Tome unworn). */
  icyenic: IcyenicFaithBonuses;
  icyenicProtection: IcyenicProtectionOutcome;
  tomeOfTheIcyeneWorn: boolean;
  berserkersFury: BerserkersFuryResolved;
  /** Host-resolved Slayer Helmet descriptor; null when inactive. Snapshot copies only. */
  slayerHelmet: SerializableSlayerHelmetSource | null;
  /** Host-resolved Salve descriptor; null when inactive. Snapshot copies only. */
  salve: SerializableSalveSource | null;
}

/**
 * Sum wiki combat Damage / Accuracy from equipped pieces (display totals).
 * Hit chance does NOT add full weapon Accuracy ratings - those mirror tier and
 * would double-count playerAccuracy(level, weaponTier). See nonWeaponAccuracyBonus.
 * Matching armour and jewellery damage is folded into base AD separately.
 */
export function equippedBonuses(loadout: Loadout): { damage: number; accuracy: number } {
  return sumEquipmentBonuses(equippedRecordIds(loadout).map((id) => equipmentById(id)?.bonuses));
}

/**
 * Flat accuracy from non-weapon slots only (gloves, rings, amulets, cape, armour, …).
 * Mainhand / offhand / twohand Accuracy is excluded - encoded by weapon tier.
 * Resolved through the canonical equipment aggregation.
 */
export function nonWeaponAccuracyBonus(loadout: Loadout): number {
  return aggregateLoadoutEquipment({
    equipmentSlots: loadout.equipmentSlots,
    style: loadout.style,
  }).appliedAccuracy;
}

export function loadoutStats(loadout: Loadout, options: LoadoutStatsOptions = {}): CalcStats {
  const now = options.now ?? Date.now();
  const levels = resolveLevels(loadout);
  const leagueSelection = resolveLeagueSelection(options);
  const equipment = resolveEquipment(loadout, levels, options, leagueSelection);
  const defenceLife = resolveDefenceLife(
    loadout,
    levels,
    equipment,
    {
      now,
      blessingPicks: options.blessingPicks,
      relics: options.relics,
      ruleset: options.ruleset,
    },
    leagueSelection,
  );
  const leagueBundle = resolveLeagueBundle(
    loadout,
    defenceLife,
    { ...options, now },
    equipment,
    leagueSelection,
  );
  // Helmet + salve once: accuracy mults, damage mods, and snapshot descriptors share this.
  const slayerSalve = resolveSlayerSalve(loadout, options);
  const accuracyDp = resolveAccuracyDp(loadout, levels, equipment, leagueBundle, slayerSalve);
  const baseDamage = resolveBaseDamage(loadout, levels, equipment, defenceLife, leagueBundle);
  const crit = resolveCrit(loadout, levels, equipment, leagueBundle);
  const combat = resolveCombatRules(
    loadout,
    levels,
    equipment,
    leagueBundle,
    defenceLife,
    options,
    slayerSalve,
  );

  return {
    combatStyle: loadout.style,
    baseDamageMode: baseDamage.baseDamageMode,
    rawBase: baseDamage.rawBase,
    base: baseDamage.base,
    level: levels.level,
    attackLevel: levels.attackLevel,
    dp: accuracyDp.dp,
    accuracyRating: accuracyDp.accuracyRating,
    baseAbilityDamageBreakdown: baseDamage.baseAbilityDamageBreakdown,
    equipmentDamageBreakdown: baseDamage.equipmentDamageBreakdown,
    accuracyBreakdown: accuracyDp.accuracyBreakdown,
    armourBreakdown: baseDamage.armourBreakdown,
    armourRatingBreakdown: baseDamage.armourRatingBreakdown,
    defenceBreakdown: baseDamage.defenceBreakdown,
    critChance: crit.critChance,
    critChanceBreakdown: crit.critChanceBreakdown,
    critChanceSources: crit.critChanceSources,
    critDamageSources: crit.critDamageSources,
    critConditionalNotes: crit.critConditionalNotes,
    styleMismatchNotes: baseDamage.styleMismatchNotes,
    critsDisabled: crit.critsDisabled,
    critDamageBonus: crit.critDamageBonus,
    baseCritDamage: crit.baseCritDamage,
    totalCritDamage: crit.totalCritDamage,
    baseCritDamageBonus: crit.baseCritDamageBonus,
    totalCritDamageBonus: crit.totalCritDamageBonus,
    activePassives: combat.activePassives,
    critByHitFor: crit.critByHitFor,
    cap: combat.cap,
    startingAdrenaline: combat.startingAdrenaline,
    maxAdrenaline: combat.maxAdrenaline,
    effectiveDamageLevel: levels.effectiveDamageLevel,
    mainhandTier: equipment.mainhandTier,
    offhandTier: equipment.offhandTier,
    spellTier: equipment.spellTier,
    ammunitionTier: equipment.ammunitionTier,
    equipmentStyleDamageBonus: equipment.equipmentStyleDamageBonus,
    styleDamageBonus: equipment.styleDamageBonus,
    damagePotentialSource: accuracyDp.damagePotentialSource,
    equipmentIds: equipment.equipmentIds,
    weaponConfiguration: equipment.weaponConfiguration,
    weaponTierOverride: equipment.weaponTierOverride,
    globalModifiers: combat.globalModifiers,
    castModifiersFor: combat.castModifiersFor,
    adrenaline: combat.adrenaline,
    procs: combat.procs,
    plantedFeet: combat.plantedFeet,
    strengthCape99: loadout.buffs.strengthCape99 === true,
    attackCape120: loadout.buffs.attackCape120 === true && loadout.style === "melee",
    preciseRank: combat.preciseRank,
    conjureBasicDamageMult: combat.conjureBasicDamageMult,
    conjureDurationMult: combat.conjureDurationMult,
    tumekensPieces: equipment.tumekensPieces,
    tumekensCritEnabled: crit.tumekensCritEnabled,
    equipmentEffects: equipment.equipmentEffects,
    equipment: equipment.equipmentStats,
    defence: defenceLife.defence,
    life: defenceLife.life,
    league: leagueBundle.league,
    combatContext: combat.combatContext,
    leagueBaseAbilityDamageBonus: leagueBundle.leagueBaseAbilityDamageBonus,
    leagueBaseAbilityDamageMultiplier: leagueBundle.leagueBaseAbilityDamageMultiplier,
    aegis: leagueBundle.aegis,
    barkscales: leagueBundle.barkscales,
    icyenic: leagueBundle.icyenic,
    icyenicProtection: leagueBundle.icyenicProtection,
    tomeOfTheIcyeneWorn: leagueBundle.tomeOfTheIcyeneWorn,
    berserkersFury: combat.berserkersFury,
    slayerHelmet: combat.slayerHelmet,
    salve: combat.salve,
  };
}
