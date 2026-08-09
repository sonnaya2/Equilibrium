import {
  activeBlessings,
  activeTierPassives,
  indexActiveBlessings,
  type BlessingChoice,
  type BlessingId,
  type BlessingPath,
  type ActiveBlessingTierPassive,
  uniqueBlessingPathCount,
} from "../../league/blessings";
import {
  resolveAdrenalineCap,
  type MaximumAdrenalineResolution,
  type MaximumAdrenalineSource,
} from "../shared/adrenalineCap";
import { mulFloor } from "../core/rounding";
import { isBasicAttack } from "../shared/adrenalineGain";
import { resolveCombatProvenance } from "../shared/damageProvenance";
import {
  DEFAULT_AFFINITIES,
  resolveAffinityPercent,
  type AffinityKind,
} from "../target/genericTarget";
import type { CombatContext, CombatModifier } from "../types";
import type { SetPieceContributionModifier } from "../shared/equipment";
import {
  ICYENIC_FAITH_RELIC,
  icyenicFaithActive,
  resolveIcyenicFaithBonuses,
  type IcyenicFaithBonuses,
} from "./icyenicFaith";
import { NARAGI_EDICT_RELIC, naragiEdictActive } from "./naragiEdict";
import { noteBlessingIndexRebuild } from "../profiling/allocation";
import type { CritLayers } from "../core/critical";

/** Blessing damage must not re-apply ability-stage blessing mults (no recursion). */
function notBlessingDamage(context: CombatContext): boolean {
  return resolveCombatProvenance(context).kind !== "blessing";
}

export interface LeagueLoadout {
  ruleset?: "base" | "equilibrium";
  blessingPicks?: readonly BlessingPath[];
  /** Chosen relic display names (not tier keys). */
  relics?: readonly string[];
  regions?: readonly string[];
}

/** Big Boned 5% max-life outgoing rider is always on when picked (no opt-out). */
export const BIG_BONED_OUTGOING_ASSUMPTIONS = [
  "Per unique hit (Mod Sponge Discord): flat 5% of maximum life inside the host damage instance",
  "Inherits the host damage family, modifiers, critical result, Damage Potential, rounding, and shared hit cap",
  "Creates no separate event or proc roll; composes once beside Cinders and never rides itself",
  "5% of maximum life including Big Boned's own +50% max-life boost; Powerburst is time-bounded",
  "Rides represented poison, conjure, proc, reflected, derived, Light, Inferno, and Grasp hosts; those sources do not inherit Cinders eligibility",
] as const;

export interface ResolvedLeagueRules {
  ruleset: "base" | "equilibrium";
  /** Ordered active cards for presentation / serialization. */
  blessings: readonly BlessingChoice[];
  tierPassives: readonly ActiveBlessingTierPassive[];
  /**
   * Runtime lookup keyed by blessing id. Optional for worker-revived payloads
   * that only ship the array; use `blessingsIndex` rather than reading directly.
   */
  blessingsById?: ReadonlyMap<BlessingId, BlessingChoice>;
  blessingIds: ReadonlySet<BlessingId>;
  /** Active relic display names when ruleset is equilibrium. */
  relics: readonly string[];
  relicNames: ReadonlySet<string>;
  totalArmour: number;
  /**
   * Maximum life without Powerburst of Vitality doubling. Call
   * `resolveMaximumLife` at a land tick for the timed double.
   */
  maximumLife: number;
  /**
   * Half-open exclusive end tick for Powerburst max-life doubling from sim
   * start (`landTick < powerburstUntilTick`). 0 = inactive for the whole run.
   */
  powerburstUntilTick: number;
  targetSize: number;
  occupiedTiles: number;
  areaTargets: number;
  prayerBonus: number;
  trueEquilibrium: TrueEquilibriumResolution;
  herbloreLevel?: number;
}

export interface TrueEquilibriumResolution {
  uniquePathCount: number;
  baseAbilityDamage: number;
  armour: number;
  maximumLife: number;
  critChance: number;
  critDamage: number;
  prayerBonus: number;
}

export interface LeagueCritualStats {
  uncappedChance: number;
  effectiveChance: number;
  convertedChance: number;
}

const CRITUAL_EFFECTIVE_CHANCE_CAP_DEFAULT = 0.5;

function critualEffectiveChanceCap(rule: {
  effectiveChanceCap?: number;
}): number {
  const cap = rule.effectiveChanceCap;
  if (typeof cap === "number" && Number.isFinite(cap) && cap > 0) {
    return Math.min(1, cap);
  }
  return CRITUAL_EFFECTIVE_CHANCE_CAP_DEFAULT;
}

function critChanceEquivalent(layers: CritLayers): number {
  if (layers.eligible === false || layers.disabled) return 0;
  if (layers.guaranteed) return 1;
  if (!Number.isFinite(layers.chance)) {
    throw new RangeError(`Critual chance must be finite: ${layers.chance}`);
  }
  return Math.max(0, layers.chance);
}

export function resolveLeagueCritualStats(
  rules: ResolvedLeagueRules | undefined,
  baseChance: number,
  disabled = false,
): LeagueCritualStats {
  if (!Number.isFinite(baseChance)) {
    throw new RangeError(`Critual chance must be finite: ${baseChance}`);
  }
  const raw = Math.max(0, baseChance);
  const rule = blessingRule(rules, "unholy-critual")?.unholyCritual;
  if (!rule) {
    return {
      uncappedChance: raw,
      effectiveChance: disabled ? 0 : Math.min(1, raw),
      convertedChance: 0,
    };
  }
  const cap = critualEffectiveChanceCap(rule);
  const excessRatio =
    typeof rule.excessCritDamageRatio === "number" && Number.isFinite(rule.excessCritDamageRatio)
      ? Math.max(0, rule.excessCritDamageRatio)
      : 1;
  const uncappedChance = raw + Math.max(0, rule.chanceBonus);
  const effectiveChance = disabled ? 0 : Math.min(cap, Math.max(0, uncappedChance));
  const convertedChance = disabled
    ? 0
    : Math.max(0, uncappedChance - cap) * excessRatio;
  return { uncappedChance, effectiveChance, convertedChance };
}

export function resolveLeagueCritAtLand(
  rules: ResolvedLeagueRules | undefined,
  current: CritLayers,
): CritLayers {
  // current is the complete chance layer set after all land-time bonuses.
  const rule = blessingRule(rules, "unholy-critual")?.unholyCritual;
  if (!rule || current.disabled || current.eligible === false) return current;
  const cap = critualEffectiveChanceCap(rule);
  const excessRatio =
    typeof rule.excessCritDamageRatio === "number" && Number.isFinite(rule.excessCritDamageRatio)
      ? Math.max(0, rule.excessCritDamageRatio)
      : 1;
  const existingConverted = Math.max(0, current.critualConvertedDamageBonus ?? 0);
  const nonCritualDamageBonus = Math.max(0, (current.damageBonus ?? 0) - existingConverted);
  const uncappedChance = current.guaranteed
    ? 1
    : existingConverted > 0
      ? Math.max(0, current.chance) + existingConverted
      : critChanceEquivalent(current);
  const effectiveChance = Math.min(cap, uncappedChance);
  const convertedChance = Math.max(0, uncappedChance - cap) * excessRatio;
  return {
    ...current,
    chance: effectiveChance,
    guaranteed: false,
    damageBonus: nonCritualDamageBonus + convertedChance,
    critualConvertedDamageBonus: convertedChance,
  };
}

export interface ResolveLeagueRulesDerived {
  totalArmour?: number;
  maximumLife?: number;
  powerburstUntilTick?: number;
  targetSize?: number;
  occupiedTiles?: number;
  areaTargets?: number;
  prayerBonus?: number;
  herbloreLevel?: number;
}

export function resolveLeagueRules(
  loadout: LeagueLoadout,
  derived: ResolveLeagueRulesDerived = {},
  resolvedTrueEquilibrium?: TrueEquilibriumResolution,
): ResolvedLeagueRules {
  const ruleset = loadout.ruleset === "equilibrium" ? "equilibrium" : "base";
  const blessings = ruleset === "equilibrium" ? activeBlessings(loadout.blessingPicks ?? []) : [];
  const tierPassives =
    ruleset === "equilibrium" ? activeTierPassives(loadout.blessingPicks ?? []) : [];
  const blessingsById = indexActiveBlessings(blessings);
  const trueEquilibriumRule = blessingsById.get("true-equilibrium")?.combat;
  const uniquePathCount =
    ruleset === "equilibrium" ? uniqueBlessingPathCount(loadout.blessingPicks ?? []) : 0;
  const computedTrueEquilibrium: TrueEquilibriumResolution = {
    uniquePathCount,
    baseAbilityDamage: uniquePathCount * (trueEquilibriumRule?.baseAbilityDamagePerUniquePath ?? 0),
    armour: uniquePathCount * (trueEquilibriumRule?.armourPerUniquePath ?? 0),
    maximumLife: uniquePathCount * (trueEquilibriumRule?.maximumLifePerUniquePath ?? 0),
    critChance: uniquePathCount * (trueEquilibriumRule?.critChancePerUniquePath ?? 0),
    critDamage: uniquePathCount * (trueEquilibriumRule?.critDamagePerUniquePath ?? 0),
    prayerBonus: uniquePathCount * (trueEquilibriumRule?.prayerBonusPerUniquePath ?? 0),
  };
  const trueEquilibrium = resolvedTrueEquilibrium ?? computedTrueEquilibrium;
  const relics =
    ruleset === "equilibrium"
      ? [
          ...new Set(
            (loadout.relics ?? []).filter((name) => typeof name === "string" && name.length > 0),
          ),
        ]
      : [];
  return {
    ruleset,
    blessings,
    tierPassives,
    blessingsById,
    blessingIds: new Set(blessingsById.keys()),
    relics,
    relicNames: new Set(relics),
    totalArmour: Math.max(0, derived.totalArmour ?? 0),
    maximumLife: Math.max(0, derived.maximumLife ?? 0),
    powerburstUntilTick: Math.max(0, Math.floor(derived.powerburstUntilTick ?? 0)),
    targetSize: Math.max(1, Math.floor(derived.targetSize ?? 1)),
    occupiedTiles: Math.max(1, Math.floor(derived.occupiedTiles ?? 1)),
    areaTargets: Math.max(1, Math.floor(derived.areaTargets ?? 1)),
    prayerBonus: Math.max(0, derived.prayerBonus ?? 0) + trueEquilibrium.prayerBonus,
    trueEquilibrium,
    herbloreLevel: Math.min(120, Math.max(1, Math.floor(derived.herbloreLevel ?? 1))),
  };
}

export function higherPowerBaseAbilityDamageMultiplier(
  rules: ResolvedLeagueRules | undefined,
): number {
  const multiplier = blessingRule(rules, "higher-power")?.baseAbilityDamageMultiplier;
  return typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier > 0
    ? multiplier
    : 1;
}

/** Powerburst doubles maximum life after all other layers, only while active. */
export function resolveMaximumLife(rules: ResolvedLeagueRules, landTick: number): number {
  if (rules.powerburstUntilTick > 0 && landTick < rules.powerburstUntilTick) {
    return rules.maximumLife * 2;
  }
  return rules.maximumLife;
}

export function hasBlessing(rules: ResolvedLeagueRules | undefined, id: BlessingId): boolean {
  return rules?.ruleset === "equilibrium" && rules.blessingIds.has(id);
}

export function hasRelic(rules: ResolvedLeagueRules | undefined, name: string): boolean {
  return rules?.ruleset === "equilibrium" && rules.relicNames.has(name);
}

export function hasIcyenicFaith(rules: ResolvedLeagueRules | undefined): boolean {
  return hasRelic(rules, ICYENIC_FAITH_RELIC) || icyenicFaithActive(rules?.relics);
}

export function hasNaragiEdict(rules: ResolvedLeagueRules | undefined): boolean {
  return hasRelic(rules, NARAGI_EDICT_RELIC) || naragiEdictActive(rules?.relics);
}

/**
 * Icyenic Faith damage layers from equipment Prayer + Tome worn.
 * Crit chance and base AD % only apply when relic is active and the Tome is worn.
 */
export function icyenicFromLoadout(
  rules: ResolvedLeagueRules | undefined,
  prayerBonus: number,
  tomeWorn: boolean,
): IcyenicFaithBonuses {
  return resolveIcyenicFaithBonuses(prayerBonus, {
    relicActive: hasIcyenicFaith(rules),
    tomeWorn,
  });
}

/** Stable index for mechanic lookup; rebuilds from the array when the Map is absent. */
export function blessingsIndex(
  rules: ResolvedLeagueRules | undefined,
): ReadonlyMap<BlessingId, BlessingChoice> {
  if (!rules) return EMPTY_BLESSING_INDEX;
  if (rules.blessingsById) return rules.blessingsById;
  noteBlessingIndexRebuild();
  return indexActiveBlessings(rules.blessings);
}

const EMPTY_BLESSING_INDEX: ReadonlyMap<BlessingId, BlessingChoice> = new Map();

export function blessingRule(
  rules: ResolvedLeagueRules | undefined,
  id: BlessingId,
): BlessingChoice["combat"] | undefined {
  return blessingsIndex(rules).get(id)?.combat;
}

export function setPieceContributionModifier(
  rules: ResolvedLeagueRules | undefined,
): SetPieceContributionModifier {
  const additional = blessingRule(rules, "chaotic-insight")?.additionalSetPiecesPerItem;
  return {
    additionalPiecesPerItem:
      typeof additional === "number" && Number.isFinite(additional) && additional >= 0
        ? Math.floor(additional)
        : 0,
  };
}

/** Resolve tier-changing blessings once; callers apply the result idempotently. */
export function weaponTierOverride(rules: ResolvedLeagueRules | undefined): number | null {
  const value = blessingRule(rules, "genesis-essence")?.weaponTierOverride;
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

export interface AegisArmourBonus {
  offhand: "shield" | "defender" | "none";
  /** The resolved share of armour: 25%, 50% wielding a defender, 75% wielding a shield. */
  armourPercent: number;
  /** Flat addition to base ability damage, before the ability's own damage band. */
  baseAbilityDamageBonus: number;
}

/**
 * Teragard's Aegis: base ability damage +25% of Armour rating (50% with
 * defender, 75% with shield). The flat share is floored once.
 */
export function aegisArmourBonus(
  rule: BlessingChoice["combat"] | undefined,
  armour: { blockArmourRating: number },
  offhand: "shield" | "defender" | null,
): AegisArmourBonus {
  const multiplier =
    offhand === "shield"
      ? (rule?.shieldArmourMultiplier ?? 1)
      : offhand === "defender"
        ? (rule?.defenderArmourMultiplier ?? 1)
        : 1;
  const armourPercent = (rule?.baseAbilityDamageArmourPercent ?? 0) * multiplier;
  return {
    offhand: offhand ?? "none",
    armourPercent,
    baseAbilityDamageBonus: mulFloor(armour.blockArmourRating, armourPercent),
  };
}

export function blessingLifeMultiplier(loadout: LeagueLoadout): number {
  return activeBlessings(
    loadout.ruleset === "equilibrium" ? (loadout.blessingPicks ?? []) : [],
  ).reduce(
    (multiplier, choice) => multiplier * Math.max(1, choice.combat.maximumLifeMultiplier ?? 1),
    1,
  );
}

export function blessingFinalLifeMultiplier(loadout: LeagueLoadout): number {
  return activeBlessings(
    loadout.ruleset === "equilibrium" ? (loadout.blessingPicks ?? []) : [],
  ).reduce(
    (multiplier, choice) =>
      multiplier *
      (choice.combat.maximumLifeMultiplier != null && choice.combat.maximumLifeMultiplier < 1
        ? choice.combat.maximumLifeMultiplier
        : 1),
    1,
  );
}

export function blessingArmourMultiplier(loadout: LeagueLoadout): number {
  return activeBlessings(
    loadout.ruleset === "equilibrium" ? (loadout.blessingPicks ?? []) : [],
  ).reduce((multiplier, choice) => multiplier * (choice.combat.armourMultiplier ?? 1), 1);
}

export function resolveMaximumAdrenaline(
  equipmentCap: number,
  rules: ResolvedLeagueRules | undefined,
  heightenedSensesBonus = 0,
): MaximumAdrenalineResolution {
  const sources: MaximumAdrenalineSource[] = [];
  if (equipmentCap > 100) {
    sources.push({ id: "vestments-of-havoc", kind: "points", value: equipmentCap - 100 });
  }
  const adrenalineJunkie = blessingRule(rules, "adrenaline-junkie")?.maximumAdrenaline;
  if (adrenalineJunkie != null && adrenalineJunkie > 100) {
    sources.push({
      id: "adrenaline-junkie",
      kind: "percentage",
      value: ((adrenalineJunkie - 100) / 100) * 100,
    });
  }
  for (const passive of rules?.tierPassives ?? []) {
    if (passive.effect.type === "maximum-adrenaline") {
      sources.push({
        id: passive.id,
        kind: "percentage",
        value: passive.effect.bonusPercent,
      });
    }
  }
  if (heightenedSensesBonus) {
    sources.push({ id: "heightened-senses", kind: "points", value: heightenedSensesBonus });
  }
  return resolveAdrenalineCap(100, sources);
}

export function blessingAdrenalineGenerationMultiplier(
  rules: ResolvedLeagueRules | undefined,
): number {
  return blessingRule(rules, "adrenaline-junkie")?.adrenalineGenerationMultiplier ?? 1;
}

export function temperedHeartAdrenalineGain(
  rules: ResolvedLeagueRules | undefined,
  fromTick: number,
  toTickInclusive: number,
): number {
  const passive = blessingRule(rules, "tempered-heart")?.passiveAdrenaline;
  if (!passive || passive.intervalTicks <= 0 || toTickInclusive <= fromTick) return 0;
  // The clock transition is (fromTick, toTickInclusive]; the first pulse is at intervalTicks.
  const pulses =
    Math.floor(toTickInclusive / passive.intervalTicks) -
    Math.floor(fromTick / passive.intervalTicks);
  return Math.max(0, pulses) * passive.amount;
}

export function envenomedPoisonDamageMultiplier(rules: ResolvedLeagueRules | undefined): number {
  const rule = blessingRule(rules, "envenomed");
  if (!rule) return 1;
  const level = Math.min(120, Math.max(1, Math.floor(rules?.herbloreLevel ?? 1)));
  return 1 + (rule.poisonDamageBaseBonus ?? 0) + (rule.poisonDamagePerHerbloreLevel ?? 0) * level;
}

export function envenomedPoisonImmunityDisableTicks(
  rules: ResolvedLeagueRules | undefined,
): number {
  return Math.max(0, Math.floor(blessingRule(rules, "envenomed")?.poisonImmunityDisableTicks ?? 0));
}

/**
 * Sacred Fervor: floor(defaultCooldown * multiplier). Positive base floors to
 * min 1 tick; non-positive/non-finite base clamps to 0.
 */
export function effectiveCooldownTicks(
  ticks: number,
  rules: ResolvedLeagueRules | undefined,
): number {
  if (!Number.isFinite(ticks) || ticks <= 0) return 0;
  const base = Math.floor(ticks);
  const multiplier = blessingRule(rules, "sacred-fervor")?.cooldownMultiplier;
  if (multiplier === undefined) return base;
  return Math.max(1, Math.floor(base * multiplier));
}

/**
 * Resolve effective affinity percent for hit chance.
 * Demon's Mark may force the target's exact weakness affinity when applicable.
 * `weaknessAffinity` defaults to 90; presets pass the sourced weakness value.
 */
export function effectiveTargetAffinity(
  affinity: number | AffinityKind,
  hasApplicableWeakness: boolean,
  rules: ResolvedLeagueRules | undefined,
  weaknessAffinity: number = DEFAULT_AFFINITIES.weakness,
): number {
  const current = resolveAffinityPercent(affinity);
  const weakness = resolveAffinityPercent(weaknessAffinity);
  if (
    !hasApplicableWeakness ||
    blessingRule(rules, "demons-mark")?.useTargetWeakness !== true ||
    weakness <= current
  ) {
    return current;
  }
  return weakness;
}

export function leagueModifiers(rules: ResolvedLeagueRules | undefined): CombatModifier[] {
  if (rules?.ruleset !== "equilibrium") return [];
  const modifiers: CombatModifier[] = [];
  const byId = blessingsIndex(rules);
  const striking = byId.get("striking-light");
  if (striking?.combat.basicDamageMultiplier !== undefined) {
    modifiers.push({
      id: "blessing:striking-light",
      stage: "ability",
      priority: 900,
      abilityBaseMultiplier: striking.combat.basicDamageMultiplier,
      applies: (context) =>
        context.ruleset === "equilibrium" &&
        notBlessingDamage(context) &&
        isBasicAttack(context) &&
        (resolveCombatProvenance(context).kind === "player_direct" ||
          resolveCombatProvenance(context).kind === "player_auto"),
      apply: (state) => ({
        ...state,
        damage: mulFloor(state.damage, striking.combat.basicDamageMultiplier!),
      }),
      source: striking.source,
    });
  }
  const splash = byId.get("splash-zone");
  if (splash?.combat.areaDamageBonus !== undefined) {
    modifiers.push({
      id: "blessing:splash-zone",
      stage: "ability",
      priority: 910,
      applies: (context) =>
        context.ruleset === "equilibrium" &&
        notBlessingDamage(context) &&
        (context.area === "aoe" || context.area === "multi-target"),
      apply: (state, context) => ({
        ...state,
        damage: mulFloor(
          state.damage,
          1 +
            splash.combat.areaDamageBonus! +
            (splash.combat.aoePerSizeBonus ?? 0) * (context.area === "aoe" ? rules.targetSize : 0),
        ),
      }),
      source: splash.source,
    });
  }
  const havoc = byId.get("havoc-born");
  const envenomed = byId.get("envenomed");
  if (
    envenomed?.combat.poisonDamageBaseBonus !== undefined ||
    envenomed?.combat.poisonDamagePerHerbloreLevel !== undefined
  ) {
    const multiplier = envenomedPoisonDamageMultiplier(rules);
    modifiers.push({
      id: "blessing:envenomed",
      stage: "postHit",
      priority: 915,
      appliesToPlayerPoison: true,
      applies: (context) => context.ruleset === "equilibrium" && context.dotKind === "poison",
      apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
      source: envenomed.source,
    });
  }
  if (havoc?.combat.damageMultiplier !== undefined) {
    modifiers.push({
      id: "blessing:havoc-born",
      stage: "postHit",
      priority: 920,
      appliesToPlayerPoison: true,
      applies: (context) => context.ruleset === "equilibrium",
      apply: (state) => ({
        ...state,
        damage: mulFloor(state.damage, havoc.combat.damageMultiplier!),
      }),
      source: havoc.source,
    });
  }
  return modifiers;
}
