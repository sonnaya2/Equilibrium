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
  "Per unique hit (Mod Sponge Discord): flat 5% of maximum life as crit-eligible bonus damage attached to the parent hit",
  // Rider recursion: Light/Inferno unique hits take BB only (not Cinders 15% - those are not abilities).
  "Also rides separate blessing hits (Light of Saradomin, Inferno of Zamorak); never rides attached riders (no BB-on-BB); no on-hit re-roll on those hits",
  "5% of maximum life including Big Boned's own +50% max-life boost; Powerburst is time-bounded",
  // BB shares host gate with Cinders except Light/Inferno (BB only). Cinders 15% is AD base, not hit+BB.
  "Rides conjure auto/poison and invention hit splats (Crackling/Aftershock); Inferno/Light on-hit rolls stay direct-only",
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
}

export interface ResolveLeagueRulesDerived {
  totalArmour?: number;
  maximumLife?: number;
  powerburstUntilTick?: number;
  targetTiles?: number;
}

export function resolveLeagueRules(
  loadout: LeagueLoadout,
  derived: ResolveLeagueRulesDerived = {},
): ResolvedLeagueRules {
  const ruleset = loadout.ruleset === "equilibrium" ? "equilibrium" : "base";
  const blessings = ruleset === "equilibrium" ? activeBlessings(loadout.blessingPicks ?? []) : [];
  const blessingsById = indexActiveBlessings(blessings);
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
  equipmentPrayer: number,
  tomeWorn: boolean,
): IcyenicFaithBonuses {
  return resolveIcyenicFaithBonuses(equipmentPrayer, {
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

/** Which armour figure Teragard's Aegis reads (wiki "total armour" is ambiguous). */
export type AegisArmourBasis = "equipment" | "total-rating";

export interface AegisArmourBonus {
  /** Armour figure the blessing multiplies (equipment or block rating per basis). */
  qualifyingArmour: number;
  /** Block rating minus equipment Armour (0 when basis is total-rating). */
  excludedBlockArmour: number;
  /** Which figure was used. */
  basis: AegisArmourBasis;
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
 *
 * basis "total-rating" (default): block armour rating (equipment + Defence/prayer/Fortitude).
 * basis "equipment": equipment Armour only (excludes level-derived block share).
 */
export function aegisArmourBonus(
  rule: BlessingChoice["combat"] | undefined,
  armour: { totalArmour: number; blockArmourRating: number },
  offhand: "shield" | "defender" | null,
  opts?: { basis?: AegisArmourBasis },
): AegisArmourBonus {
  const basis: AegisArmourBasis = opts?.basis === "equipment" ? "equipment" : "total-rating";
  const qualifyingArmour = basis === "total-rating" ? armour.blockArmourRating : armour.totalArmour;
  const multiplier =
    offhand === "shield"
      ? (rule?.shieldArmourMultiplier ?? 1)
      : offhand === "defender"
        ? (rule?.defenderArmourMultiplier ?? 1)
        : 1;
  const armourPercent = (rule?.baseAbilityDamageArmourPercent ?? 0) * multiplier;
  return {
    qualifyingArmour,
    excludedBlockArmour: basis === "equipment" ? armour.blockArmourRating - armour.totalArmour : 0,
    basis,
    offhand: offhand ?? "none",
    armourPercent,
    baseAbilityDamageBonus: Math.floor(qualifyingArmour * armourPercent),
  };
}

export function blessingLifeMultiplier(loadout: LeagueLoadout): number {
  return (
    activeBlessings(loadout.ruleset === "equilibrium" ? (loadout.blessingPicks ?? []) : []).find(
      (choice) => choice.id === "big-boned",
    )?.combat.maximumLifeMultiplier ?? 1
  );
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
  return modifiers;
}
