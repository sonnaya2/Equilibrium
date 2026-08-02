import { defenceStats, type DefenceStats } from "@/combat/core/defence";
import { lifePointStats, type LifePointStats } from "@/combat/core/lifePoints";
import { targetDamagePotential, playerAccuracy } from "@/combat/target/genericTarget";
import {
  bitingCritChanceBonus,
  energisingAccuracyBonus,
  invigoratingAdrenalineMultiplier,
  lungingPerkModifier,
  ultimatumsPerkModifier,
} from "@/combat/shared/perks";
import {
  activeEquipmentEffects,
  additiveMeleeDamageModifier,
  amZiModifier,
  applyEquipmentAccuracy,
  applyEquipmentDamagePotential,
  equipmentCritByHit,
  equippedPassiveSummaries,
  equippedSetCounts,
  effectiveTumekenPieces,
  loadoutFirstNecromancerConjureDamageMult,
  loadoutFirstNecromancerConjureDurationMult,
  loadoutSetCritChance,
  setDamageModifiers,
  setEffectsSummary,
  staticEquipmentCritBonus,
  sumEquipmentBonuses,
  wieldedOffhandKind,
  type ActiveEquipmentEffects,
} from "@/combat/shared/equipment";
import {
  prayerBoostedStyleLevel,
  prayerDamageModifier,
  styleCurseById,
} from "@/combat/shared/prayers";
import { vulnerabilityModifier } from "@/combat/shared/vulnerability";
import { overloadBoostedLevel } from "@/combat/shared/potions";
import { STANDARD_HIT_CAP, type HitCapRule } from "@/combat/core/hitCaps";
import { equipmentById } from "@/combat/data";
import type { AdrenalineRules, ProcRules } from "@/combat/engine/simulation/simulate";
import type { CombatModifier } from "@/combat/types";
import type { CombatContext } from "@/combat/types";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { baseCritDamageMultiplier, type CritLayers } from "@/combat/core/critical";
import {
  aggregateLoadoutEquipment,
  type EquipmentStatTotals,
} from "@/combat/shared/equipmentStats";
import { isPowerburstOfVitalityActive, type Loadout } from "./useLoadout";
import {
  equippedRecordIds,
  equipmentStyleDamageBonus,
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
  aegisArmourBonus,
  blessingAdrenalineGenerationMultiplier,
  blessingLifeMultiplier,
  blessingRule,
  effectiveTargetAffinity,
  leagueModifiers,
  resolveLeagueRules,
  resolveMaximumAdrenaline,
  type AegisArmourBonus,
  type ResolvedLeagueRules,
} from "@/combat/league/ruleset";
import { barkscalesOutcome, type BarkscalesOutcome } from "@/combat/league/barkscales";
import type { BlessingPath } from "@/league/blessings";

/** Re-export for GearPanel / setup consumers. */
export { equippedSetCounts, setEffectsSummary };
/** Weapon/offence derivation lives in loadout/weaponConfiguration. */
export {
  equipmentStyleDamageBonus,
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

/** Pure derivation of engine inputs from a Setup loadout — single place tabs
 *  resolve "what does this loadout mean numerically". */

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
  /** Named sources for the setup summary dropdowns — zero rows are filtered in the UI. */
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
    adjustment: number;
  };
  critsDisabled: boolean;
  /** Crit chance for the simulator before land-time Tumeken Sunshine bonus. */
  simulationCritChance: number;
  /** Persistent equipment crit-damage bonus (conditional ability/runtime bonuses excluded). */
  critDamageBonus: number;
  /** Level-derived base crit damage multiplier (+50% at level 90). */
  baseCritDamage: number;
  /** baseCritDamage plus the persistent equipment bonus — the static loadout total. */
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
  globalModifiers: CombatModifier[];
  castModifiersFor: (ability: AbilitySpec) => CombatModifier[];
  /** Invigorating / Impatient rules for rotation + revolution sim. */
  adrenaline?: AdrenalineRules;
  /** Stateful Crackling / Aftershock rules for rotation + revolution simulation. */
  procs?: ProcRules;
  /** Planted Feet: base Sunshine / Death's Swiftness duration ×1.25. */
  plantedFeet?: boolean;
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
  /** Diagnostic breakdown of the Aegis armour conversion; zeroed without the blessing. */
  aegis: AegisArmourBonus;
  /** Barkscales resolved against the stated incoming scenario, or marked unavailable. */
  barkscales: BarkscalesOutcome;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clampLevel = (value: number) => Math.min(Math.max(1, value), 145);

/**
 * Sum wiki combat Damage / Accuracy from equipped pieces (display totals).
 * Hit chance does NOT add full weapon Accuracy ratings — those mirror tier and
 * would double-count playerAccuracy(level, weaponTier). See nonWeaponAccuracyBonus.
 * Matching armour and jewellery damage is folded into base AD separately.
 */
export function equippedBonuses(loadout: Loadout): { damage: number; accuracy: number } {
  return sumEquipmentBonuses(equippedRecordIds(loadout).map((id) => equipmentById(id)?.bonuses));
}

/**
 * Flat accuracy from non-weapon slots only (gloves, rings, amulets, cape, armour, …).
 * Mainhand / offhand / twohand Accuracy is excluded — encoded by weapon tier.
 * Resolved through the canonical equipment aggregation.
 */
export function nonWeaponAccuracyBonus(loadout: Loadout): number {
  return aggregateLoadoutEquipment({
    equipmentSlots: loadout.equipmentSlots,
    style: loadout.style,
  }).appliedAccuracy;
}

export function critDamageStats(level: number, equipmentBonus = 0) {
  const baseMultiplier = baseCritDamageMultiplier(clampLevel(level));
  const totalMultiplier = baseCritDamageMultiplier(clampLevel(level), equipmentBonus);
  return {
    baseMultiplier,
    totalMultiplier,
    baseBonus: baseMultiplier - 1,
    totalBonus: totalMultiplier - 1,
  };
}

export interface LoadoutStatsOptions {
  now?: number;
  blessingPicks?: readonly BlessingPath[];
  ruleset?: "base" | "equilibrium";
  /** Window the incoming-combat scenario is measured over; one minute by default. */
  scenarioSeconds?: number;
}

export function loadoutStats(loadout: Loadout, options: LoadoutStatsOptions = {}): CalcStats {
  const now = options.now ?? Date.now();
  const leagueLoadout = {
    ruleset: options.ruleset ?? (options.blessingPicks === undefined ? "base" : "equilibrium"),
    blessingPicks: options.blessingPicks,
  } as const;
  const curse =
    loadout.buffs?.styleCurse && loadout.buffs.styleCurse !== "none"
      ? styleCurseById(loadout.buffs.styleCurse)
      : undefined;
  const overloadTier = loadoutOverloadTier(loadout);

  let attackLevel = loadoutAttackLevel(loadout);
  if (overloadTier) attackLevel = overloadBoostedLevel(attackLevel, overloadTier);
  const visibleAttackLevel = attackLevel;
  if (curse) attackLevel = prayerBoostedStyleLevel(attackLevel, curse);

  const level = loadoutDamageLevel(loadout);
  const effectiveStrengthLevel = loadoutEffectiveDamageLevel(loadout);
  const energising =
    loadout.perks.energising > 0 ? energisingAccuracyBonus(loadout.perks.energising) : 0;
  const equipmentStats = aggregateLoadoutEquipment({
    equipmentSlots: loadout.equipmentSlots,
    style: loadout.style,
  });
  const accessoryAccuracy = equipmentStats.appliedAccuracy;
  const weaponTier = loadoutWeaponTier(loadout);
  const defence = defenceStats({
    baseLevel: loadout.defenceLevel,
    overloadTier,
    prayerBlockLevels: curse?.defenceLevels ?? 0,
    fortitude: loadout.buffs.fortitude,
    equipmentArmour: equipmentStats.armour,
  });
  const life = lifePointStats({
    constitutionLevel: loadout.constitutionLevel,
    equipmentLife: equipmentStats.life,
    reaperCrew: loadout.buffs.reaperCrew,
    boonOfHet: loadout.buffs.boonOfHet,
    fontOfLife: loadout.buffs.fontOfLife,
    fortitude: loadout.buffs.fortitude,
    thermalBath: loadout.buffs.thermalBath,
    bonfireFiremakingLevel: loadout.buffs.bonfireFiremakingLevel,
    totemOfVitality: loadout.buffs.totemOfVitality,
    overheal: loadout.buffs.overheal === "none" ? null : loadout.buffs.overheal,
    powerburstOfVitality: isPowerburstOfVitalityActive(loadout, now),
    currentLife: loadout.currentLife ?? undefined,
    maximumLifeMultiplier: blessingLifeMultiplier(leagueLoadout),
  });

  const league = resolveLeagueRules(leagueLoadout, {
    totalArmour: defence.totalArmour,
    maximumLife: life.temporaryMaxLife,
    targetTiles: loadout.target?.occupiedTiles,
  });

  // Target model: level+tier curve + Energising + non-weapon flat accuracy only.
  // Without a target, the manual accuracy% slider remains authoritative.
  const equipmentEffects = activeEquipmentEffects({
    style: loadout.style,
    equipmentSlots: loadout.equipmentSlots,
    enchantments: loadout.enchantments,
    effectiveAttackLevel: visibleAttackLevel,
    effectiveStrengthLevel,
  });
  const accuracyRating = applyEquipmentAccuracy(
    playerAccuracy(attackLevel, weaponTier) + energising + accessoryAccuracy,
    equipmentEffects,
  );
  const targetAffinity = loadout.target
    ? effectiveTargetAffinity(
        loadout.target.affinity,
        loadout.target.hasApplicableWeakness === true,
        league,
      )
    : undefined;
  const dp = loadout.target
    ? applyEquipmentDamagePotential(
        targetDamagePotential(accuracyRating, {
          defenceLevel: loadout.target.defenceLevel,
          armour: loadout.target.armour,
          affinity: targetAffinity,
          additiveHitChance: (loadout.target.additiveHitChance ?? 0) / 100,
          damagePotentialOverride: loadout.target.damagePotentialOverride,
        }),
        equipmentEffects,
      )
    : applyEquipmentDamagePotential(
        clamp01(applyEquipmentAccuracy(loadout.accuracy / 100, equipmentEffects)),
        equipmentEffects,
      );

  // Equilibrium prevents critical strikes. Set bonuses come only from equipped records.
  const setCounts = equippedSetCounts({ equipmentSlots: loadout.equipmentSlots });
  const tumekensPieces = effectiveTumekenPieces(setCounts);
  const equipmentCrit = staticEquipmentCritBonus(equipmentEffects);
  const critDamage = critDamageStats(level, equipmentCrit.damageBonus);
  const biting =
    loadout.perks.biting > 0
      ? bitingCritChanceBonus(loadout.perks.biting, loadout.perks.bitingLevel20)
      : 0;
  const setCrit = loadoutSetCritChance({ equipmentSlots: loadout.equipmentSlots });
  const configuredCrit = loadout.critChance / 100;
  const critSubtotal = configuredCrit + biting + setCrit + equipmentCrit.chance;
  const critChance = loadout.perks.equilibrium > 0 ? 0 : clamp01(critSubtotal);
  const simulationCritChance =
    loadout.perks.equilibrium > 0
      ? 0
      : clamp01(loadout.critChance / 100 + biting + setCrit + equipmentCrit.chance);
  const equipmentAdrenalineCap = equipmentEffects.vestments.increasedAdrenalineCap ? 120 : 100;
  const maxAdrenaline = resolveMaximumAdrenaline(equipmentAdrenalineCap, league);

  const aegisRule = blessingRule(league, "teragards-aegis");
  const wieldedOffhand = wieldedOffhandKind(loadout);
  const aegis = aegisArmourBonus(aegisRule, defence, wieldedOffhand);
  const leagueBaseAbilityDamageBonus = aegis.baseAbilityDamageBonus;
  const formulaBase = computedLoadoutBase(loadout);
  const enteredBase =
    loadout.baseDamage.mode === "manual" && loadout.baseDamage.manualValue > 0
      ? loadout.baseDamage.manualValue
      : formulaBase;
  const afterPerksBase = loadoutBase(loadout);
  const resolvedBase = afterPerksBase + leagueBaseAbilityDamageBonus;
  const weaponAccuracy = playerAccuracy(attackLevel, weaponTier);
  const baseAbilityDamageBreakdown = [
    {
      label: loadout.baseDamage.mode === "manual" ? "Manual" : "Weapon",
      value: enteredBase,
    },
    { label: "Invention perks", value: afterPerksBase - enteredBase },
    { label: "Teragard's Aegis", value: leagueBaseAbilityDamageBonus },
  ];
  const equipmentDamageBreakdown = [{ label: "Equipped gear", value: equipmentStats.damage }];
  const accuracyBeforeEffects = weaponAccuracy + energising + accessoryAccuracy;
  const accuracyBreakdown = [
    { label: "Weapon", value: weaponAccuracy },
    { label: "Energising", value: energising },
    { label: "Accessories", value: accessoryAccuracy },
    { label: "Equipment effects", value: accuracyRating - accuracyBeforeEffects },
  ];
  const armourBreakdown = [{ label: "Equipped gear", value: defence.totalArmour }];
  const defenceBreakdown = [
    { label: "Base", value: loadout.defenceLevel },
    { label: "Overload", value: defence.visibleLevel - loadout.defenceLevel },
  ];
  // Armour rating floors the sum; pin the residual on the Defence share so the
  // dropdown still reconciles to the displayed total.
  const armourRatingBreakdown = [
    { label: "Armour", value: defence.totalArmour },
    {
      label: loadout.buffs.fortitude
        ? "From Defence (Fortitude)"
        : loadout.buffs.styleCurse !== "none"
          ? "From Defence (style curse)"
          : "From Defence",
      value: defence.blockArmourRating - defence.totalArmour,
    },
  ];
  // Barkscales needs an incoming attack cadence the outgoing rotation cannot
  // supply; the scenario is stated on the target or the result stays unavailable.
  const barkscales = barkscalesOutcome(
    blessingRule(league, "barkscales"),
    defence.totalArmour,
    options.scenarioSeconds ?? 60,
    {
      incomingHitIntervalSeconds: loadout.target?.incomingHitIntervalSeconds,
      targetsStruck: loadout.target?.occupiedTiles,
      poisonImmune: loadout.target?.poisonImmune,
    },
  );

  const globalModifiers: CombatModifier[] = [];
  // Catalogue damageMult sets (none sourced yet — structure ready).
  globalModifiers.push(...setDamageModifiers(setCounts));
  if (loadout.buffs?.vulnerability) globalModifiers.push(vulnerabilityModifier());
  if (curse) globalModifiers.push(prayerDamageModifier(curse));
  if (equipmentEffects.amZiFlatDamage > 0) {
    globalModifiers.push(amZiModifier(equipmentEffects.amZiFlatDamage));
  }
  if (equipmentEffects.amHejDamageBonus > 0) {
    globalModifiers.push(additiveMeleeDamageModifier(equipmentEffects.amHejDamageBonus));
  }
  globalModifiers.push(...leagueModifiers(league));

  const adrenaline: AdrenalineRules = {
    abilityGainMultiplier: blessingAdrenalineGenerationMultiplier(league),
    basicGainMultiplier:
      loadout.perks.invigorating > 0
        ? invigoratingAdrenalineMultiplier(loadout.perks.invigorating)
        : 1,
    // Impatient / Relentless are state-changing RNG: the rotation drivers
    // branch on them (probability-weighted), never flat expected value.
    impatientRank: loadout.perks.impatient > 0 ? loadout.perks.impatient : 0,
    impatientLevel20: loadout.perks.impatientLevel20,
    relentlessRank: loadout.perks.relentless > 0 ? loadout.perks.relentless : 0,
    relentlessLevel20: loadout.perks.relentlessLevel20,
  };

  const procs: ProcRules = {
    cracklingRank: loadout.perks.crackling > 0 ? loadout.perks.crackling : 0,
    aftershockRank: loadout.perks.aftershock > 0 ? loadout.perks.aftershock : 0,
  };
  const weaponConfig = loadoutWeaponConfig(loadout);
  const offhandType = wieldedOffhand;
  const equipmentDamage = equipmentStyleDamageBonus(loadout);
  const mainhandTier =
    weaponConfig.kind === "necromancy" ? weaponConfig.deathGuard.tier : weaponConfig.weapon.tier;
  const offhandTier =
    weaponConfig.kind === "necromancy"
      ? (weaponConfig.conduit?.tier ?? null)
      : weaponConfig.kind === "mainhand"
        ? (weaponConfig.offhand?.tier ?? null)
        : null;

  return {
    combatStyle: loadout.style,
    baseDamageMode: loadout.baseDamage.mode,
    rawBase: enteredBase,
    base: resolvedBase,
    level,
    attackLevel,
    dp,
    accuracyRating,
    baseAbilityDamageBreakdown,
    equipmentDamageBreakdown,
    accuracyBreakdown,
    armourBreakdown,
    armourRatingBreakdown,
    defenceBreakdown,
    critChance,
    critChanceBreakdown: {
      configured: configuredCrit,
      biting,
      sets: setCrit,
      equipment: equipmentCrit.chance,
      adjustment: critChance - critSubtotal,
    },
    critsDisabled: loadout.perks.equilibrium > 0,
    simulationCritChance,
    critDamageBonus: equipmentCrit.damageBonus,
    baseCritDamage: critDamage.baseMultiplier,
    totalCritDamage: critDamage.totalMultiplier,
    baseCritDamageBonus: critDamage.baseBonus,
    totalCritDamageBonus: critDamage.totalBonus,
    activePassives: equippedPassiveSummaries(loadout).map(({ label }) => label),
    critByHitFor: (ability, crit) => equipmentCritByHit(equipmentEffects, ability, crit),
    cap: { cap: STANDARD_HIT_CAP, bypass: !loadout.hitCapEnabled },
    startingAdrenaline: Math.min(maxAdrenaline, loadout.startingAdrenaline),
    maxAdrenaline,
    effectiveDamageLevel: loadoutEffectiveDamageLevel(loadout),
    mainhandTier,
    offhandTier,
    spellTier:
      weaponConfig.kind !== "necromancy" && weaponConfig.style === "magic"
        ? (weaponConfig.spellTier ?? null)
        : null,
    ammunitionTier:
      weaponConfig.kind !== "necromancy" && weaponConfig.style === "ranged"
        ? (weaponConfig.ammunitionTier ?? null)
        : null,
    equipmentStyleDamageBonus: equipmentDamage,
    styleDamageBonus: equipmentDamage + loadout.styleDamageBonus,
    damagePotentialSource: loadout.target
      ? loadout.target.damagePotentialOverride != null
        ? "manual override"
        : targetAffinity !== loadout.target.affinity
          ? "target weakness"
          : "target stats"
      : loadout.accuracy === 100
        ? "100% assumption"
        : "manual override",
    equipmentIds: equippedRecordIds(loadout),
    // Necromancy: `"necromancy"` only when a conduit is available (equipped
    // conduit, or empty off-hand with dual-hand tier sliders). A shield /
    // defender in the off-hand reports that shape so conjures gate correctly
    // while necrotic abilities still cast (wiki: conduit required to conjure).
    weaponConfiguration:
      weaponConfig.kind === "necromancy"
        ? offhandType
          ? offhandType
          : weaponConfig.conduit != null
            ? "necromancy"
            : "mainhand"
        : weaponConfig.kind === "twohand"
          ? "twohand"
          : offhandType
            ? offhandType
            : weaponConfig.offhand
              ? "dualwield"
              : "mainhand",
    globalModifiers,
    castModifiersFor: (ability) => [
      ...globalModifiers,
      ...(loadout.perks.ultimatums > 0
        ? [ultimatumsPerkModifier(loadout.perks.ultimatums, ability.category)]
        : []),
      ...(loadout.perks.lunging > 0
        ? [lungingPerkModifier(loadout.perks.lunging, ability.id)]
        : []),
    ],
    adrenaline,
    procs,
    plantedFeet: loadout.perks.plantedFeet === true,
    conjureBasicDamageMult: loadoutFirstNecromancerConjureDamageMult({
      equipmentSlots: loadout.equipmentSlots,
    }),
    conjureDurationMult: loadoutFirstNecromancerConjureDurationMult({
      equipmentSlots: loadout.equipmentSlots,
    }),
    tumekensPieces,
    tumekensCritEnabled: loadout.perks.equilibrium === 0,
    equipmentEffects,
    equipment: equipmentStats,
    defence,
    life,
    league,
    combatContext: {
      style: loadout.style,
      ruleset: league.ruleset,
      targetTiles: league.targetTiles,
    },
    leagueBaseAbilityDamageBonus,
    aegis,
    barkscales,
  };
}
