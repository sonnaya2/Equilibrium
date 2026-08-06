import {
  activeBlessings,
  indexActiveBlessings,
  type BlessingChoice,
  type BlessingId,
  type BlessingPath,
} from "../../league/blessings";
import { mulFloor } from "../core/rounding";
import { isBasicAttack } from "../shared/adrenalineGain";
import { resolveCombatProvenance } from "../shared/damageProvenance";
import { AFFINITY, type AffinityKind } from "../target/genericTarget";
import type { CombatContext, CombatModifier } from "../types";
import {
  ICYENIC_FAITH_RELIC,
  icyenicFaithActive,
  resolveIcyenicFaithBonuses,
  type IcyenicFaithBonuses,
} from "./icyenicFaith";
import { NARAGI_EDICT_RELIC, naragiEdictActive } from "./naragiEdict";

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
  "Per unique hit (Mod Sponge Discord): flat 5% of maximum life attached to the parent damage and inheriting its critical result",
  "Also rides Cinders and separate blessing hits (Light of Saradomin, Inferno of Zamorak); each rider inherits that parent's crit state and never rides Big Boned itself",
  "5% of maximum life including Big Boned's own +50% max-life boost; Powerburst is time-bounded",
  "Rides conjure auto/poison and invention hit splats (Crackling/Aftershock); Cinders rolls follow the shared Cinders hit gate",
  "Still unverified vs live: crit eligibility, Reflect, hit-cap treatment, exact formula stage",
] as const;

export interface ResolvedLeagueRules {
  ruleset: "base" | "equilibrium";
  /** Ordered active cards for presentation / serialization. */
  blessings: readonly BlessingChoice[];
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
  targetTiles: number;
  areaTargets: number;
  prayerBonus: number;
  herbloreLevel?: number;
}

export interface ResolveLeagueRulesDerived {
  totalArmour?: number;
  maximumLife?: number;
  powerburstUntilTick?: number;
  targetTiles?: number;
  areaTargets?: number;
  prayerBonus?: number;
  herbloreLevel?: number;
}

export function resolveLeagueRules(
  loadout: LeagueLoadout,
  derived: ResolveLeagueRulesDerived = {},
): ResolvedLeagueRules {
  const ruleset = loadout.ruleset === "equilibrium" ? "equilibrium" : "base";
  const blessings = ruleset === "equilibrium" ? activeBlessings(loadout.blessingPicks ?? []) : [];
  const blessingsById = indexActiveBlessings(blessings);
  const trueEquilibriumPrayer =
    (blessingsById.get("true-equilibrium")?.combat.prayerBonusPerUniquePath ?? 0) *
    new Set(loadout.blessingPicks ?? []).size;
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
    blessingsById,
    blessingIds: new Set(blessingsById.keys()),
    relics,
    relicNames: new Set(relics),
    totalArmour: Math.max(0, derived.totalArmour ?? 0),
    maximumLife: Math.max(0, derived.maximumLife ?? 0),
    powerburstUntilTick: Math.max(0, Math.floor(derived.powerburstUntilTick ?? 0)),
    targetTiles: Math.max(1, Math.floor(derived.targetTiles ?? 1)),
    areaTargets: Math.max(1, Math.floor(derived.areaTargets ?? 1)),
    prayerBonus: Math.max(0, derived.prayerBonus ?? 0) + trueEquilibriumPrayer,
    herbloreLevel: Math.min(120, Math.max(1, Math.floor(derived.herbloreLevel ?? 1))),
  };
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
  if (!rules) return new Map();
  return rules.blessingsById ?? indexActiveBlessings(rules.blessings);
}

export function blessingRule(
  rules: ResolvedLeagueRules | undefined,
  id: BlessingId,
): BlessingChoice["combat"] | undefined {
  return blessingsIndex(rules).get(id)?.combat;
}

export interface AegisArmourBonus {
  offhand: "shield" | "defender" | "none";
  /** The resolved share of armour: 25%, 50% wielding a defender, 75% wielding a shield. */
  armourPercent: number;
  /** Flat addition to base ability damage, before the ability's own damage band. */
  baseAbilityDamageBonus: number;
}

/**
 * Teragard's Aegis: base ability damage +25% of armour (50% with defender,
 * 75% with shield). Flat share then one floor: floor(armour * 0.75), not
 * floor(armour * 0.25) * 3 (provisional until live-verified).
 */
export function aegisArmourBonus(
  rule: BlessingChoice["combat"] | undefined,
  armour: { totalArmour: number },
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
    baseAbilityDamageBonus: Math.floor(armour.totalArmour * armourPercent),
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
): number {
  return Math.max(
    equipmentCap,
    blessingRule(rules, "adrenaline-junkie")?.maximumAdrenaline ?? equipmentCap,
  );
}

export function blessingAdrenalineGenerationMultiplier(
  rules: ResolvedLeagueRules | undefined,
): number {
  return blessingRule(rules, "adrenaline-junkie")?.adrenalineGenerationMultiplier ?? 1;
}

export function temperedHeartAdrenalineGain(
  rules: ResolvedLeagueRules | undefined,
  fromTick: number,
  toTickExclusive: number,
): number {
  const passive = blessingRule(rules, "tempered-heart")?.passiveAdrenaline;
  if (!passive || passive.intervalTicks <= 0 || toTickExclusive <= fromTick) return 0;
  const pulses =
    Math.floor(toTickExclusive / passive.intervalTicks) -
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

export function effectiveTargetAffinity(
  affinity: AffinityKind,
  hasApplicableWeakness: boolean,
  rules: ResolvedLeagueRules | undefined,
): AffinityKind {
  if (
    !hasApplicableWeakness ||
    blessingRule(rules, "demons-mark")?.useTargetWeakness !== true ||
    AFFINITY.weakness <= AFFINITY[affinity]
  ) {
    return affinity;
  }
  return "weakness";
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
      applies: (context) =>
        context.ruleset === "equilibrium" && notBlessingDamage(context) && isBasicAttack(context),
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
            (splash.combat.aoePerTileBonus ?? 0) * (context.area === "aoe" ? rules.targetTiles : 0),
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
      applies: (context) => context.ruleset === "equilibrium",
      apply: (state) => ({
        ...state,
        damage:
          state.damage +
          Math.floor(
            state.damage * (havoc.combat.damageMultiplier! - 1) +
              Number.EPSILON * Math.max(1, Math.abs(state.damage)),
          ),
      }),
      source: havoc.source,
    });
  }
  return modifiers;
}
