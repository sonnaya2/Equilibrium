import { defenceStats, type DefenceStats } from "@/combat/core/defence";
import { lifePointStats, type LifePointStats } from "@/combat/core/lifePoints";
import { TICK_SECONDS } from "@/combat/core/ticks";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { baseCritDamageMultiplier, type CritLayers } from "@/combat/core/critical";
import { STANDARD_HIT_CAP, type HitCapRule } from "@/combat/core/hitCaps";
import { mulFloor } from "@/combat/core/rounding";
import { targetDamagePotential, playerAccuracy } from "@/combat/target/genericTarget";
import {
  ATTACK_CAPE_MELEE_HIT_CHANCE,
  bitingCritChanceBonus,
  energisingAccuracyBonus,
  invigoratingAdrenalineMultiplier,
  lungingPerkModifier,
  raceSlayerPerkModifier,
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
  hasEnchantment,
  hasPassive,
  loadoutFirstNecromancerConjureDamageMult,
  loadoutFirstNecromancerConjureDurationMult,
  loadoutSetCritChance,
  setDamageModifiers,
  staticEquipmentCritBonus,
  wieldedOffhandKind,
  type ActiveEquipmentEffects,
} from "@/combat/shared/equipment";
import {
  prayerBoostedStyleLevel,
  prayerDamageModifier,
  styleCurseById,
  type StyleCurseBoost,
} from "@/combat/shared/prayers";
import { vulnerabilityModifier } from "@/combat/shared/vulnerability";
import {
  formatSalveDamageLine,
  formatSalveHitChanceLine,
  resolveSalve,
  salveDamageModifier,
} from "@/combat/shared/salveAmulet";
import {
  formatSlayerHelmetDamageLine,
  formatSlayerHelmetHitChanceLine,
  resolveSlayerHelmet,
  slayerHelmetDamageModifier,
} from "@/combat/shared/slayerHelmet";
import {
  berserkersFuryModifier,
  getBerserkersFuryBonus,
  lifePointsFromHealthPercent,
  sanitizeHealthPercent,
  BERSERKERS_FURY_ID,
} from "@/combat/shared/berserkersFury";
import {
  FURY_OF_THE_SMALL_EXTRA_ADRENALINE,
  FURY_OF_THE_SMALL_ID,
} from "@/combat/shared/furyOfTheSmall";
import {
  HEIGHTENED_SENSES_ADRENALINE_BONUS,
  HEIGHTENED_SENSES_ID,
} from "@/combat/shared/heightenedSenses";
import {
  CONSERVATION_OF_ENERGY_ID,
  CONSERVATION_OF_ENERGY_REFUND,
} from "@/combat/shared/conservationOfEnergy";
import {
  formatRingOfVigourSources,
  hasRingOfVigourEffect,

  ringOfVigourActiveSources,
} from "@/combat/shared/ringOfVigour";
import {
  sanitizeArchaeologyState,
  sanitizeSelectedRelics,
} from "@/combat/shared/archaeologyRelics";
import type { RegionId } from "@/league";
import { overloadBoostedLevel, type OverloadTier } from "@/combat/shared/potions";
import type { AdrenalineRules, ProcRules } from "@/combat/engine/simulation/simulate";
import type { CombatModifier, CombatContext } from "@/combat/types";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import {
  aggregateLoadoutEquipment,
  type EquipmentStatTotals,
} from "@/combat/shared/equipmentStats";
import {
  aegisArmourBonus,
  blessingAdrenalineGenerationMultiplier,
  blessingLifeMultiplier,
  blessingRule,
  effectiveTargetAffinity,
  hasIcyenicFaith,
  icyenicFromLoadout,
  leagueModifiers,
  resolveLeagueRules,
  resolveMaximumAdrenaline,
  type AegisArmourBonus,
  type ResolvedLeagueRules,
} from "@/combat/league/ruleset";
import { barkscalesOutcome, type BarkscalesOutcome } from "@/combat/league/barkscales";
import {
  icyenicProtectionOutcome,
  isTomeOfTheIcyeneWorn,
  type IcyenicFaithBonuses,
  type IcyenicProtectionOutcome,
} from "@/combat/league/icyenicFaith";
import type { BlessingPath } from "@/league/blessings";
import { isPowerburstOfVitalityActive, type Loadout } from "./model";
import {
  equippedRecordIds,
  equipmentStyleDamageBonus,
  equipmentStyleDamageContributions,
  loadoutAttackLevel,
  loadoutDamageLevel,
  loadoutOverloadTier,
  loadoutEffectiveDamageLevel,
  loadoutWeaponConfig,
  loadoutWeaponTier,
  computedLoadoutBase,
  loadoutBase,
  type StyleDamageContribution,
  type WeaponHand,
} from "./weaponConfiguration";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clampLevel = (value: number) => Math.min(Math.max(1, value), 145);
const TICK_MS = TICK_SECONDS * 1000;

export interface LoadoutStatsOptions {
  now?: number;
  blessingPicks?: readonly BlessingPath[];
  /** Chosen relic display names from the Build planner. */
  relics?: readonly string[];
  ruleset?: "base" | "equilibrium";
  /** Window the incoming-combat scenario is measured over; one minute by default. */
  scenarioSeconds?: number;
  /**
   * League unlocks for monolith energy (500 vs 650). When set, over-budget and
   * 650-without-Anachronia selections are dropped before combat resolve.
   */
  unlockedRegions?: readonly RegionId[];
}

function leagueRulesetFromOptions(options: LoadoutStatsOptions): "base" | "equilibrium" {
  if (options.ruleset) return options.ruleset;
  if (options.blessingPicks !== undefined || options.relics !== undefined) return "equilibrium";
  return "base";
}

export type DamagePotentialSource =
  "target stats" | "target weakness" | "manual override" | "100% assumption";

export type BreakdownRow = { label: string; value: number };

/** Sum named breakdown rows (Setup dropdowns / diagnostics). */
export function sumBreakdown(rows: readonly { value: number }[]): number {
  return rows.reduce((sum, row) => sum + row.value, 0);
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

/** Remaining Powerburst ticks from frozen now (half-open until-tick basis). */
export function powerburstRemainingTicks(untilMs: number | null | undefined, now: number): number {
  if (untilMs == null || !Number.isFinite(untilMs)) return 0;
  const remainingMs = untilMs - now;
  if (!(remainingMs > 0)) return 0;
  return Math.ceil(remainingMs / TICK_MS);
}

export interface ResolvedLevels {
  attackLevel: number;
  /** Pre-prayer attack level used by equipment effect gates. */
  visibleAttackLevel: number;
  /** Strength (melee) or style level - feeds crit damage from level. */
  level: number;
  effectiveDamageLevel: number;
  energising: number;
  overloadTier: OverloadTier | null;
  curse: StyleCurseBoost | undefined;
}

export function resolveLevels(loadout: Loadout): ResolvedLevels {
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
  const effectiveDamageLevel = loadoutEffectiveDamageLevel(loadout);
  const energising =
    loadout.perks.energising > 0 ? energisingAccuracyBonus(loadout.perks.energising) : 0;

  return {
    attackLevel,
    visibleAttackLevel,
    level,
    effectiveDamageLevel,
    energising,
    overloadTier,
    curse,
  };
}

export interface ResolvedEquipment {
  equipmentStats: EquipmentStatTotals;
  equipmentEffects: ActiveEquipmentEffects;
  weaponTier: number;
  weaponConfig: WeaponHand;
  accessoryAccuracy: number;
  setCounts: Map<string, number>;
  tumekensPieces: number;
  styleContributions: StyleDamageContribution[];
  styleGearDamage: number;
  equipmentIds: readonly string[];
  wieldedOffhand: "shield" | "defender" | null;
  mainhandTier: number;
  offhandTier: number | null;
  spellTier: number | null;
  ammunitionTier: number | null;
  weaponConfiguration: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";
  equipmentStyleDamageBonus: number;
  styleDamageBonus: number;
}

export function resolveEquipment(loadout: Loadout, levels: ResolvedLevels): ResolvedEquipment {
  const equipmentStats = aggregateLoadoutEquipment({
    equipmentSlots: loadout.equipmentSlots,
    style: loadout.style,
  });
  const accessoryAccuracy = equipmentStats.appliedAccuracy;
  const weaponTier = loadoutWeaponTier(loadout);
  const equipmentEffects = activeEquipmentEffects({
    style: loadout.style,
    equipmentSlots: loadout.equipmentSlots,
    enchantments: loadout.enchantments,
    effectiveAttackLevel: levels.visibleAttackLevel,
    effectiveStrengthLevel: levels.effectiveDamageLevel,
  });
  const setCounts = equippedSetCounts({ equipmentSlots: loadout.equipmentSlots });
  const tumekensPieces = effectiveTumekenPieces(setCounts);
  const styleContributions = equipmentStyleDamageContributions(loadout);
  const styleGearDamage = equipmentStyleDamageBonus(loadout);
  const weaponConfig = loadoutWeaponConfig(loadout);
  const wieldedOffhand = wieldedOffhandKind(loadout);
  const equipmentDamage = styleGearDamage;
  const mainhandTier =
    weaponConfig.kind === "necromancy" ? weaponConfig.deathGuard.tier : weaponConfig.weapon.tier;
  const offhandTier =
    weaponConfig.kind === "necromancy"
      ? (weaponConfig.conduit?.tier ?? null)
      : weaponConfig.kind === "mainhand"
        ? (weaponConfig.offhand?.tier ?? null)
        : null;
  const spellTier =
    weaponConfig.kind !== "necromancy" && weaponConfig.style === "magic"
      ? (weaponConfig.spellTier ?? null)
      : null;
  const ammunitionTier =
    weaponConfig.kind !== "necromancy" && weaponConfig.style === "ranged"
      ? (weaponConfig.ammunitionTier ?? null)
      : null;
  // Necromancy: `"necromancy"` only when a conduit is available (equipped
  // conduit, or empty off-hand with dual-hand tier sliders). A shield /
  // defender in the off-hand reports that shape so conjures gate correctly
  // while necrotic abilities still cast (wiki: conduit required to conjure).
  const weaponConfiguration: ResolvedEquipment["weaponConfiguration"] =
    weaponConfig.kind === "necromancy"
      ? wieldedOffhand
        ? wieldedOffhand
        : weaponConfig.conduit != null
          ? "necromancy"
          : "mainhand"
      : weaponConfig.kind === "twohand"
        ? "twohand"
        : wieldedOffhand
          ? wieldedOffhand
          : weaponConfig.offhand
            ? "dualwield"
            : "mainhand";

  return {
    equipmentStats,
    equipmentEffects,
    weaponTier,
    weaponConfig,
    accessoryAccuracy,
    setCounts,
    tumekensPieces,
    styleContributions,
    styleGearDamage,
    equipmentIds: equippedRecordIds(loadout),
    wieldedOffhand,
    mainhandTier,
    offhandTier,
    spellTier,
    ammunitionTier,
    weaponConfiguration,
    equipmentStyleDamageBonus: equipmentDamage,
    styleDamageBonus: equipmentDamage + loadout.styleDamageBonus,
  };
}

export interface ResolvedDefenceLife {
  defence: DefenceStats;
  life: LifePointStats;
  /** Undoubled max life for league rules (Big Boned / Powerburst until-tick). */
  maximumLifeForLeague: number;
  powerburstUntilTick: number;
  powerburstActive: boolean;
}

export function resolveDefenceLife(
  loadout: Loadout,
  levels: ResolvedLevels,
  equipment: ResolvedEquipment,
  options: LoadoutStatsOptions = {},
): ResolvedDefenceLife {
  const now = options.now ?? Date.now();
  const leagueLoadout = {
    ruleset: leagueRulesetFromOptions(options),
    blessingPicks: options.blessingPicks,
    relics: options.relics,
  } as const;
  const defence = defenceStats({
    baseLevel: loadout.defenceLevel,
    overloadTier: levels.overloadTier,
    prayerBlockLevels: levels.curse?.defenceLevels ?? 0,
    fortitude: loadout.buffs.fortitude,
    equipmentArmour: equipment.equipmentStats.armour,
  });
  const powerburstActive = isPowerburstOfVitalityActive(loadout, now);
  const lifeInputBase = {
    constitutionLevel: loadout.constitutionLevel,
    equipmentLife: equipment.equipmentStats.life,
    reaperCrew: loadout.buffs.reaperCrew,
    boonOfHet: loadout.buffs.boonOfHet,
    fontOfLife: loadout.buffs.fontOfLife,
    fortitude: loadout.buffs.fortitude,
    thermalBath: loadout.buffs.thermalBath,
    bonfireFiremakingLevel: loadout.buffs.bonfireFiremakingLevel,
    totemOfVitality: loadout.buffs.totemOfVitality,
    overheal: loadout.buffs.overheal === "none" ? null : loadout.buffs.overheal,
    maximumLifeMultiplier: blessingLifeMultiplier(leagueLoadout),
  } as const;
  // Absolute currentLife wins; otherwise derive from shared currentHealthPercent of undoubled max.
  const undoubledMax = lifePointStats({
    ...lifeInputBase,
    powerburstOfVitality: false,
  }).temporaryMaxLife;
  const healthPercent = sanitizeHealthPercent(loadout.currentHealthPercent ?? 50);
  const currentFromPercent = lifePointsFromHealthPercent(undoubledMax, healthPercent);
  const resolvedCurrentLife =
    loadout.currentLife != null ? loadout.currentLife : currentFromPercent;
  const lifeInput = {
    ...lifeInputBase,
    currentLife: resolvedCurrentLife,
  } as const;
  // UI life includes Powerburst doubling; league rules store the undoubled max
  // and a remaining until-tick so Big Boned resolves at each land tick.
  const life = lifePointStats({
    ...lifeInput,
    powerburstOfVitality: powerburstActive,
  });
  const maximumLifeForLeague = undoubledMax;
  const powerburstUntilTick = powerburstRemainingTicks(
    loadout.buffs.powerburstOfVitalityUntil,
    now,
  );
  return {
    defence,
    life,
    maximumLifeForLeague,
    powerburstUntilTick,
    powerburstActive,
  };
}

export interface ResolvedLeagueBundle {
  league: ResolvedLeagueRules;
  aegis: AegisArmourBonus;
  barkscales: BarkscalesOutcome;
  leagueBaseAbilityDamageBonus: number;
  icyenic: IcyenicFaithBonuses;
  icyenicProtection: IcyenicProtectionOutcome;
  tomeOfTheIcyeneWorn: boolean;
}

export function resolveLeagueBundle(
  loadout: Loadout,
  defenceLife: ResolvedDefenceLife,
  options: LoadoutStatsOptions = {},
  equipment?: ResolvedEquipment,
): ResolvedLeagueBundle {
  const leagueLoadout = {
    ruleset: leagueRulesetFromOptions(options),
    blessingPicks: options.blessingPicks,
    relics: options.relics,
  } as const;
  const league = resolveLeagueRules(leagueLoadout, {
    totalArmour: defenceLife.defence.totalArmour,
    maximumLife: defenceLife.maximumLifeForLeague,
    powerburstUntilTick: defenceLife.powerburstUntilTick,
    targetTiles: loadout.target?.occupiedTiles,
  });
  const aegis = aegisArmourBonus(
    blessingRule(league, "teragards-aegis"),
    defenceLife.defence,
    wieldedOffhandKind(loadout),
  );
  // Barkscales needs an incoming attack cadence the outgoing rotation cannot
  // supply; the scenario is stated on the target or the result stays unavailable.
  const barkscales = barkscalesOutcome(
    blessingRule(league, "barkscales"),
    defenceLife.defence.totalArmour,
    options.scenarioSeconds ?? 60,
    {
      incomingHitIntervalSeconds: loadout.target?.incomingHitIntervalSeconds,
      targetsStruck: loadout.target?.occupiedTiles,
      poisonImmune: loadout.target?.poisonImmune,
    },
  );
  const equipmentIds = equipment?.equipmentIds ?? equippedRecordIds(loadout);
  const equipmentPrayer =
    equipment?.equipmentStats.prayer ??
    aggregateLoadoutEquipment({
      equipmentSlots: loadout.equipmentSlots,
      style: loadout.style,
    }).prayer;
  const tomeOfTheIcyeneWorn = isTomeOfTheIcyeneWorn(equipmentIds);
  const icyenic = icyenicFromLoadout(league, equipmentPrayer, tomeOfTheIcyeneWorn);
  const icyenicProtection = icyenicProtectionOutcome({
    relicActive: hasIcyenicFaith(league),
    windowSeconds: options.scenarioSeconds ?? 60,
    scenario: {
      protectionActive: loadout.buffs.protectionPrayer === true,
      incomingHitIntervalSeconds: loadout.target?.incomingHitIntervalSeconds,
      incomingHitDamage: loadout.target?.incomingHitDamage,
    },
  });
  return {
    league,
    aegis,
    barkscales,
    leagueBaseAbilityDamageBonus: aegis.baseAbilityDamageBonus,
    icyenic,
    icyenicProtection,
    tomeOfTheIcyeneWorn,
  };
}

export interface ResolvedAccuracyDp {
  accuracyRating: number;
  dp: number;
  damagePotentialSource: DamagePotentialSource;
  accuracyBreakdown: readonly BreakdownRow[];
  targetAffinity: ReturnType<typeof effectiveTargetAffinity> | undefined;
}

export function resolveAccuracyDp(
  loadout: Loadout,
  levels: ResolvedLevels,
  equipment: ResolvedEquipment,
  leagueBundle: ResolvedLeagueBundle,
  options: LoadoutStatsOptions = {},
): ResolvedAccuracyDp {
  // Target model: level+tier curve + Energising + non-weapon flat accuracy only.
  // Without a target, the manual accuracy% slider is the FINAL override - no
  // equipment accuracy/DP passives on that path.
  const weaponAccuracy = playerAccuracy(levels.attackLevel, equipment.weaponTier);
  const accuracyBeforeEffects = weaponAccuracy + levels.energising + equipment.accessoryAccuracy;
  const accuracyRating = applyEquipmentAccuracy(accuracyBeforeEffects, equipment.equipmentEffects);
  // Attack master cape (120): +2% melee hit chance (buff, not equipment accuracy).
  const attackCapeHit =
    loadout.buffs.attackCape120 && loadout.style === "melee" ? ATTACK_CAPE_MELEE_HIT_CHANCE : 0;
  // Slayer Spirit + Salve: multiplicative accuracy rating (wiki Hit chance page).
  const slayerHelm = resolveSlayerHelmet({
    equipmentSlots: loadout.equipmentSlots,
    standTier: loadout.buffs.slayerHelmetStand,
    unlockedRegions: options.unlockedRegions,
    onSlayerTask: loadout.target?.onSlayerTask === true,
    style: loadout.style,
    ensouledSpectralLens: loadout.buffs.ensouledSpectralLens,
  });
  const salve = resolveSalve({
    equipmentSlots: loadout.equipmentSlots,
    targetUndead: loadout.target?.undead === true,
  });
  const accuracyMult =
    (slayerHelm.active ? slayerHelm.hitChanceMult : 1) * (salve.active ? salve.hitChanceMult : 1);
  const accuracyAfterTargetPassives = accuracyRating * accuracyMult;
  const targetAffinity = loadout.target
    ? effectiveTargetAffinity(
        loadout.target.affinity,
        loadout.target.hasApplicableWeakness === true,
        leagueBundle.league,
      )
    : undefined;
  const dp = loadout.target
    ? applyEquipmentDamagePotential(
        targetDamagePotential(accuracyAfterTargetPassives, {
          defenceLevel: loadout.target.defenceLevel,
          armour: loadout.target.armour,
          affinity: targetAffinity,
          additiveHitChance: (loadout.target.additiveHitChance ?? 0) / 100 + attackCapeHit,
          damagePotentialOverride: loadout.target.damagePotentialOverride,
        }),
        equipment.equipmentEffects,
      )
    : // Manual slider is final DP; skillcape hit chance still stacks on top.
      // Target-specific accuracy mults (slayer/salve) need a target model.
      clamp01(loadout.accuracy / 100 + attackCapeHit);
  const damagePotentialSource: DamagePotentialSource = loadout.target
    ? loadout.target.damagePotentialOverride != null
      ? "manual override"
      : targetAffinity !== loadout.target.affinity
        ? "target weakness"
        : "target stats"
    : loadout.accuracy === 100
      ? "100% assumption"
      : "manual override";
  const accuracyBreakdown: BreakdownRow[] = [
    { label: "Weapon", value: weaponAccuracy },
    { label: "Energising", value: levels.energising },
    { label: "Accessories", value: equipment.accessoryAccuracy },
    { label: "Equipment effects", value: accuracyRating - accuracyBeforeEffects },
    ...(accuracyMult !== 1
      ? [{ label: "Slayer / Salve accuracy", value: accuracyAfterTargetPassives - accuracyRating }]
      : []),
  ];
  return {
    accuracyRating: accuracyAfterTargetPassives,
    dp,
    damagePotentialSource,
    accuracyBreakdown,
    targetAffinity,
  };
}

export interface ResolvedBaseDamage {
  baseDamageMode: "automatic" | "manual";
  rawBase: number;
  base: number;
  baseAbilityDamageBreakdown: readonly BreakdownRow[];
  equipmentDamageBreakdown: readonly BreakdownRow[];
  styleMismatchNotes: readonly string[];
  armourBreakdown: readonly BreakdownRow[];
  armourRatingBreakdown: readonly BreakdownRow[];
  defenceBreakdown: readonly BreakdownRow[];
}

export function resolveBaseDamage(
  loadout: Loadout,
  levels: ResolvedLevels,
  equipment: ResolvedEquipment,
  defenceLife: ResolvedDefenceLife,
  leagueBundle: ResolvedLeagueBundle,
): ResolvedBaseDamage {
  const formulaBase = computedLoadoutBase(loadout);
  const enteredBase =
    loadout.baseDamage.mode === "manual" && loadout.baseDamage.manualValue > 0
      ? loadout.baseDamage.manualValue
      : formulaBase;
  const afterPerksBase = loadoutBase(loadout);
  const withAegis = afterPerksBase + leagueBundle.leagueBaseAbilityDamageBonus;
  const icyenicMult = leagueBundle.icyenic.baseAbilityDamageMultiplier;
  const resolvedBase = icyenicMult === 1 ? withAegis : mulFloor(withAegis, icyenicMult);
  const styleMismatchNotes = equipment.styleContributions
    .filter((row) => row.blockedByStyle)
    .map(
      (row) =>
        `${row.label}: ${row.blockedByStyle} style damage not applied (loadout is ${loadout.style})`,
    );
  // Split weapon tier AD from style Damage (rings/armour) so Channeller's etc. show.
  const bareWeaponBase =
    loadout.baseDamage.mode === "manual"
      ? enteredBase
      : baseAbilityDamage(levels.effectiveDamageLevel, {
          ...equipment.weaponConfig,
          styleBonus: 0,
        });
  const styleInBase =
    loadout.baseDamage.mode === "manual" ? 0 : Math.max(0, formulaBase - bareWeaponBase);
  const baseAbilityDamageBreakdown: BreakdownRow[] = [
    {
      label: loadout.baseDamage.mode === "manual" ? "Manual" : "Weapon",
      value: loadout.baseDamage.mode === "manual" ? enteredBase : bareWeaponBase,
    },
    { label: "Style damage", value: styleInBase },
    { label: "Invention perks", value: afterPerksBase - enteredBase },
    { label: "Teragard's Aegis", value: leagueBundle.leagueBaseAbilityDamageBonus },
    { label: "Icyenic Faith", value: resolvedBase - withAegis },
  ];
  // Defenders contribute equipment Damage but are weapon-slot (not style b).
  const defenderEquipmentDamage = Math.max(
    0,
    equipment.equipmentStats.damage - equipment.styleGearDamage,
  );
  const equipmentDamageBreakdown: BreakdownRow[] = [
    ...equipment.styleContributions
      .filter((row) => row.value !== 0)
      .map((row) => ({ label: row.label, value: row.value })),
    ...(defenderEquipmentDamage > 0 ? [{ label: "Defender", value: defenderEquipmentDamage }] : []),
  ];
  const armourBreakdown: BreakdownRow[] = [
    { label: "Equipped gear", value: defenceLife.defence.totalArmour },
  ];
  const defenceBreakdown: BreakdownRow[] = [
    { label: "Base", value: loadout.defenceLevel },
    {
      label: "Overload",
      value: defenceLife.defence.visibleLevel - loadout.defenceLevel,
    },
  ];
  // Armour rating floors the sum; pin the residual on the Defence share so the
  // dropdown still reconciles to the displayed total.
  const armourRatingBreakdown: BreakdownRow[] = [
    { label: "Armour", value: defenceLife.defence.totalArmour },
    {
      label: loadout.buffs.fortitude
        ? "From Defence (Fortitude)"
        : loadout.buffs.styleCurse !== "none"
          ? "From Defence (style curse)"
          : "From Defence",
      value: defenceLife.defence.blockArmourRating - defenceLife.defence.totalArmour,
    },
  ];
  return {
    baseDamageMode: loadout.baseDamage.mode,
    rawBase: enteredBase,
    base: resolvedBase,
    baseAbilityDamageBreakdown,
    equipmentDamageBreakdown,
    styleMismatchNotes,
    armourBreakdown,
    armourRatingBreakdown,
    defenceBreakdown,
  };
}

export interface ResolvedCrit {
  critChance: number;
  critChanceBreakdown: {
    configured: number;
    biting: number;
    sets: number;
    equipment: number;
    icyenic: number;
    adjustment: number;
  };
  critChanceSources: readonly BreakdownRow[];
  critConditionalNotes: readonly string[];
  /** Invention Equilibrium perk zeros crit - not the League. */
  critsDisabled: boolean;
  critDamageBonus: number;
  baseCritDamage: number;
  totalCritDamage: number;
  baseCritDamageBonus: number;
  totalCritDamageBonus: number;
  tumekensCritEnabled: boolean;
  critByHitFor: (
    ability: AbilitySpec,
    crit: Omit<CritLayers, "eligible">,
  ) => Omit<CritLayers, "eligible">[];
}

export function resolveCrit(
  loadout: Loadout,
  levels: ResolvedLevels,
  equipment: ResolvedEquipment,
  leagueBundle?: ResolvedLeagueBundle,
): ResolvedCrit {
  const equipmentCrit = staticEquipmentCritBonus(equipment.equipmentEffects);
  const critChanceSources: BreakdownRow[] = [];
  if (hasPassive(equipment.equipmentEffects, "reaver-ring")) {
    critChanceSources.push({ label: "Reaver's ring", value: 0.05 });
  }
  if (
    hasPassive(equipment.equipmentEffects, "stalker-ring") &&
    equipment.equipmentEffects.weaponClass === "bow"
  ) {
    critChanceSources.push({
      label: hasEnchantment(equipment.equipmentEffects, "shadows")
        ? "Stalker's ring + Shadows"
        : "Stalker's ring",
      value: hasEnchantment(equipment.equipmentEffects, "shadows") ? 0.04 : 0.03,
    });
  }
  const icyenicCrit = leagueBundle?.icyenic.critChanceBonus ?? 0;
  if (icyenicCrit > 0) {
    critChanceSources.push({ label: "Icyenic Faith", value: icyenicCrit });
  }
  const critConditionalNotes: string[] = [];
  if (hasPassive(equipment.equipmentEffects, "channeller-ring")) {
    critConditionalNotes.push(
      hasEnchantment(equipment.equipmentEffects, "metaphysics")
        ? "Channeller's ring: +4% crit chance and +2.5% crit damage per successive channel hit"
        : "Channeller's ring: +4% crit chance per successive channel hit",
    );
  }
  if (hasPassive(equipment.equipmentEffects, "champion-ring")) {
    critConditionalNotes.push(
      hasEnchantment(equipment.equipmentEffects, "heroism")
        ? "Champion's ring: +4% crit while a bleed is active; +1.5% crit damage per bleed"
        : "Champion's ring: +3% crit while a bleed is active",
    );
  }
  if (
    hasPassive(equipment.equipmentEffects, "stalker-ring") &&
    equipment.equipmentEffects.weaponClass !== "bow"
  ) {
    critConditionalNotes.push("Stalker's ring: equip a bow for its static crit chance");
  }
  const critDamage = critDamageStats(levels.level, equipmentCrit.damageBonus);
  const biting =
    loadout.perks.biting > 0
      ? bitingCritChanceBonus(loadout.perks.biting, loadout.perks.bitingLevel20)
      : 0;
  const setCrit = loadoutSetCritChance({ equipmentSlots: loadout.equipmentSlots });
  const configuredCrit = loadout.critChance / 100;
  const critSubtotal = configuredCrit + biting + setCrit + equipmentCrit.chance + icyenicCrit;
  // Invention perk Equilibrium zeros crit - not the League.
  const critsDisabled = loadout.perks.equilibrium > 0;
  const critChance = critsDisabled ? 0 : clamp01(critSubtotal);
  return {
    critChance,
    critChanceBreakdown: {
      configured: configuredCrit,
      biting,
      sets: setCrit,
      equipment: equipmentCrit.chance,
      icyenic: icyenicCrit,
      adjustment: critChance - critSubtotal,
    },
    critChanceSources,
    critConditionalNotes,
    critsDisabled,
    critDamageBonus: equipmentCrit.damageBonus,
    baseCritDamage: critDamage.baseMultiplier,
    totalCritDamage: critDamage.totalMultiplier,
    baseCritDamageBonus: critDamage.baseBonus,
    totalCritDamageBonus: critDamage.totalBonus,
    tumekensCritEnabled: !critsDisabled,
    critByHitFor: (ability, crit) => equipmentCritByHit(equipment.equipmentEffects, ability, crit),
  };
}

export interface BerserkersFuryResolved {
  active: boolean;
  /** Damage bonus fraction (0.03 = +3%). */
  bonus: number;
  currentLifePoints: number;
  maximumLifePoints: number;
  currentHealthPercent: number;
}

export interface ResolvedCombatRules {
  globalModifiers: CombatModifier[];
  castModifiersFor: (ability: AbilitySpec) => CombatModifier[];
  adrenaline: AdrenalineRules;
  procs: ProcRules;
  plantedFeet: boolean;
  preciseRank: number;
  conjureBasicDamageMult: number;
  conjureDurationMult: number;
  maxAdrenaline: number;
  startingAdrenaline: number;
  cap: HitCapRule;
  activePassives: readonly string[];
  combatContext: CombatContext;
  berserkersFury: BerserkersFuryResolved;
}

export function resolveCombatRules(
  loadout: Loadout,
  levels: ResolvedLevels,
  equipment: ResolvedEquipment,
  leagueBundle: ResolvedLeagueBundle,
  defenceLife?: ResolvedDefenceLife,
  options: LoadoutStatsOptions = {},
): ResolvedCombatRules {
  const globalModifiers: CombatModifier[] = [];
  // Catalogue damageMult sets (none sourced yet - structure ready).
  globalModifiers.push(...setDamageModifiers(equipment.setCounts));
  if (loadout.buffs?.vulnerability) globalModifiers.push(vulnerabilityModifier());
  if (levels.curse) globalModifiers.push(prayerDamageModifier(levels.curse));
  if (equipment.equipmentEffects.amZiFlatDamage > 0) {
    globalModifiers.push(amZiModifier(equipment.equipmentEffects.amZiFlatDamage));
  }
  if (equipment.equipmentEffects.amHejDamageBonus > 0) {
    globalModifiers.push(additiveMeleeDamageModifier(equipment.equipmentEffects.amHejDamageBonus));
  }
  if (loadout.perks.demonSlayer > 0) {
    globalModifiers.push(raceSlayerPerkModifier("demon", loadout.target?.demon === true));
  }
  if (loadout.perks.dragonSlayer > 0) {
    globalModifiers.push(raceSlayerPerkModifier("dragon", loadout.target?.dragon === true));
  }
  if (loadout.perks.undeadSlayer > 0) {
    globalModifiers.push(raceSlayerPerkModifier("undead", loadout.target?.undead === true));
  }
  const slayerHelmet = resolveSlayerHelmet({
    equipmentSlots: loadout.equipmentSlots,
    standTier: loadout.buffs.slayerHelmetStand,
    unlockedRegions: options.unlockedRegions,
    onSlayerTask: loadout.target?.onSlayerTask === true,
    style: loadout.style,
    ensouledSpectralLens: loadout.buffs.ensouledSpectralLens,
  });
  const salveResolved = resolveSalve({
    equipmentSlots: loadout.equipmentSlots,
    targetUndead: loadout.target?.undead === true,
  });
  const helmDmg = slayerHelmetDamageModifier(slayerHelmet);
  if (helmDmg) globalModifiers.push(helmDmg);
  const salveDmg = salveDamageModifier(salveResolved);
  if (salveDmg) globalModifiers.push(salveDmg);
  globalModifiers.push(...leagueModifiers(leagueBundle.league));

  // selectedIds is the sole runtime source for arch relic activation.
  // Buff booleans are display mirrors only (never re-activate a relic here).
  // When regions are known, re-clamp energy (650 without Anachronia) and the 3-slot cap.
  const archState = loadout.archaeology ?? { selectedIds: [], energyCap: 500 as const };
  const effectiveArch =
    options.unlockedRegions != null
      ? sanitizeArchaeologyState(archState, options.unlockedRegions)
      : {
          energyCap: archState.energyCap,
          selectedIds: sanitizeSelectedRelics({
            selectedIds: archState.selectedIds ?? [],
            energyCap: archState.energyCap,
          }),
        };
  const archSelected = new Set(effectiveArch.selectedIds);

  // Berserker's Fury: live LP vs temporary max (includes Powerburst when active).
  const maximumLifePoints = defenceLife?.life.temporaryMaxLife ?? 0;
  const currentLifePoints = defenceLife?.life.currentLife ?? maximumLifePoints;
  const currentHealthPercent =
    maximumLifePoints > 0
      ? sanitizeHealthPercent((currentLifePoints / maximumLifePoints) * 100)
      : sanitizeHealthPercent(loadout.currentHealthPercent ?? 50);
  const furyActive = archSelected.has(BERSERKERS_FURY_ID);
  const furyBonus = furyActive
    ? getBerserkersFuryBonus({
        currentLifePoints,
        maximumLifePoints,
      })
    : 0;
  const berserkersFury: BerserkersFuryResolved = {
    active: furyActive,
    bonus: furyBonus,
    currentLifePoints,
    maximumLifePoints,
    currentHealthPercent,
  };
  if (furyActive) {
    const furyMod = berserkersFuryModifier(furyBonus);
    if (furyMod) globalModifiers.push(furyMod);
  }

  const furyOfTheSmall = archSelected.has(FURY_OF_THE_SMALL_ID);
  const heightenedSenses = archSelected.has(HEIGHTENED_SENSES_ID);
  const conservationOfEnergy = archSelected.has(CONSERVATION_OF_ENERGY_ID);
  const ringOfVigour = hasRingOfVigourEffect({
    equipmentIds: equipment.equipmentIds,
    ringOfVigourPassive: loadout.buffs.ringOfVigourPassive,
    unlockedRegions: options.unlockedRegions,
  });
  const conservationOfEnergyRefund = conservationOfEnergy ? CONSERVATION_OF_ENERGY_REFUND : 0;

  // Explicit CoE + RoV only (no legacy ultimateAdrenalineRefund sum).
  const adrenaline: AdrenalineRules = {
    abilityGainMultiplier: blessingAdrenalineGenerationMultiplier(leagueBundle.league),
    basicGainMultiplier:
      loadout.perks.invigorating > 0
        ? invigoratingAdrenalineMultiplier(loadout.perks.invigorating)
        : 1,
    ...(furyOfTheSmall ? { basicAdrenalineFlatBonus: FURY_OF_THE_SMALL_EXTRA_ADRENALINE } : {}),
    ...(heightenedSenses ? { maxAdrenalineBonus: HEIGHTENED_SENSES_ADRENALINE_BONUS } : {}),
    ...(conservationOfEnergyRefund > 0 ? { conservationOfEnergyRefund } : {}),
    ...(ringOfVigour ? { ringOfVigour: true } : {}),
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
  const equipmentAdrenalineCap = equipment.equipmentEffects.vestments.increasedAdrenalineCap
    ? 120
    : 100;
  const maxAdrenaline =
    resolveMaximumAdrenaline(equipmentAdrenalineCap, leagueBundle.league) +
    (adrenaline.maxAdrenalineBonus ?? 0);

  return {
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
    plantedFeet: loadout.perks.plantedFeet > 0,
    preciseRank: loadout.perks.precise > 0 ? loadout.perks.precise : 0,
    conjureBasicDamageMult: loadoutFirstNecromancerConjureDamageMult({
      equipmentSlots: loadout.equipmentSlots,
    }),
    conjureDurationMult: loadoutFirstNecromancerConjureDurationMult({
      equipmentSlots: loadout.equipmentSlots,
    }),
    maxAdrenaline,
    startingAdrenaline: Math.min(maxAdrenaline, loadout.startingAdrenaline),
    cap: { cap: STANDARD_HIT_CAP, bypass: !loadout.hitCapEnabled },
    activePassives: (() => {
      // Equipment list may already include "Ring of Vigour"; collapse to one
      // line that names equipped vs permanent sources (no double stack).
      const rows = equippedPassiveSummaries(loadout)
        .map(({ label }) => label)
        .filter((label) => label !== "Ring of Vigour");
      const vigourSources = ringOfVigourActiveSources({
        equipmentIds: equipment.equipmentIds,
        ringOfVigourPassive: loadout.buffs.ringOfVigourPassive,
        unlockedRegions: options.unlockedRegions,
      });
      if (vigourSources.length > 0) rows.push(formatRingOfVigourSources(vigourSources));
      const helmDmgLine = formatSlayerHelmetDamageLine(slayerHelmet);
      const helmHitLine = formatSlayerHelmetHitChanceLine(slayerHelmet);
      const salveDmgLine = formatSalveDamageLine(salveResolved);
      const salveHitLine = formatSalveHitChanceLine(salveResolved);
      if (helmDmgLine) rows.push(helmDmgLine);
      if (helmHitLine) rows.push(helmHitLine);
      if (salveDmgLine) rows.push(salveDmgLine);
      if (salveHitLine) rows.push(salveHitLine);
      return rows;
    })(),
    combatContext: {
      style: loadout.style,
      ruleset: leagueBundle.league.ruleset,
      targetTiles: leagueBundle.league.targetTiles,
    },
    berserkersFury,
  };
}
