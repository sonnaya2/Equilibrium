import {
  activeBlessings,
  type BlessingChoice,
  type BlessingId,
  type BlessingPath,
} from "../../league/blessings";
import { mulFloor } from "../core/rounding";
import { AFFINITY, type AffinityKind } from "../target/genericTarget";
import type { CombatModifier } from "../types";

export interface LeagueLoadout {
  ruleset?: "base" | "equilibrium";
  blessingPicks?: readonly BlessingPath[];
  relics?: readonly string[];
  regions?: readonly string[];
}

/**
 * Default calculator / solver policy: Big Boned's +50% maximum life always
 * applies, but the 5% max-life outgoing rider is excluded until live mechanics
 * are verified. Opt in via `includeBigBonedOutgoingDamage` for characterization.
 */
export const BIG_BONED_OUTGOING_EXCLUDED_ASSUMPTION =
  "Outgoing Big Boned damage excluded pending live verification";

/** Provisional model used only when `includeBigBonedOutgoingDamage` is true. */
export const BIG_BONED_OUTGOING_EXPERIMENTAL_ASSUMPTIONS = [
  "Experimental Big Boned outgoing damage enabled (not default scoring)",
  "Per-hit rider (not once per cast); attached to the parent hit, not a separate hit",
  "5% of maximum life including Big Boned's own +50% max-life boost",
  "Rides DoT ticks; does not recurse into blessing-generated damage",
] as const;

export interface ResolvedLeagueRules {
  ruleset: "base" | "equilibrium";
  blessings: readonly BlessingChoice[];
  blessingIds: ReadonlySet<BlessingId>;
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
  /**
   * When false (default), Big Boned still multiplies maximum life but does not
   * emit the 5% max-life bonus damage rider. Solver rankings and default
   * totals must stay on this path until live verification.
   */
  includeBigBonedOutgoingDamage: boolean;
}

export interface ResolveLeagueRulesDerived {
  totalArmour?: number;
  maximumLife?: number;
  powerburstUntilTick?: number;
  targetTiles?: number;
  /** Default false — experimental opt-in only. */
  includeBigBonedOutgoingDamage?: boolean;
}

export function resolveLeagueRules(
  loadout: LeagueLoadout,
  derived: ResolveLeagueRulesDerived = {},
): ResolvedLeagueRules {
  const ruleset = loadout.ruleset === "equilibrium" ? "equilibrium" : "base";
  const blessings = ruleset === "equilibrium" ? activeBlessings(loadout.blessingPicks ?? []) : [];
  return {
    ruleset,
    blessings,
    blessingIds: new Set(blessings.map((choice) => choice.id)),
    totalArmour: Math.max(0, derived.totalArmour ?? 0),
    maximumLife: Math.max(0, derived.maximumLife ?? 0),
    powerburstUntilTick: Math.max(0, Math.floor(derived.powerburstUntilTick ?? 0)),
    targetTiles: Math.max(1, Math.floor(derived.targetTiles ?? 1)),
    includeBigBonedOutgoingDamage: derived.includeBigBonedOutgoingDamage === true,
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

export function blessingRule(
  rules: ResolvedLeagueRules | undefined,
  id: BlessingId,
): BlessingChoice["combat"] | undefined {
  return rules?.blessings.find((choice) => choice.id === id)?.combat;
}

export interface AegisArmourBonus {
  /** The total Armour stat the blessing reads — equipment Armour, never the block rating. */
  qualifyingArmour: number;
  /** Level-derived Armour that exists only inside the block calculation, excluded here. */
  excludedBlockArmour: number;
  offhand: "shield" | "defender" | "none";
  /** The resolved share of armour: 25%, 50% wielding a defender, 75% wielding a shield. */
  armourPercent: number;
  /** Flat addition to base ability damage, before the ability's own damage band. */
  baseAbilityDamageBonus: number;
}

/**
 * Teragard's Aegis: "Your base ability damage is increased by 25% of your total
 * armour value. If you are wielding a defender, it is increased by 50%. If you
 * are wielding a shield, it is increased by 75%."
 *
 * The card states three flat shares rather than a 25% term that is later
 * multiplied, so the percentage resolves first and the result rounds once —
 * floor(armour × 0.75), not floor(armour × 0.25) × 3. The two agree on every
 * multiple of four and differ by at most two damage elsewhere; the reading is
 * provisional until the live values can be read off a character.
 *
 * `armour` must supply the player's total Armour stat separately from the block
 * armour rating: Fortitude, prayer/curse Defence levels and the Defence level
 * itself raise the rating without granting any real armour to convert.
 */
export function aegisArmourBonus(
  rule: BlessingChoice["combat"] | undefined,
  armour: { totalArmour: number; blockArmourRating: number },
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
    qualifyingArmour: armour.totalArmour,
    excludedBlockArmour: armour.blockArmourRating - armour.totalArmour,
    offhand: offhand ?? "none",
    armourPercent,
    baseAbilityDamageBonus: Math.floor(armour.totalArmour * armourPercent),
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

export function effectiveCooldownTicks(
  ticks: number,
  rules: ResolvedLeagueRules | undefined,
): number {
  const multiplier = blessingRule(rules, "sacred-fervor")?.cooldownMultiplier;
  return multiplier === undefined ? ticks : Math.floor(ticks * multiplier);
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
  const striking = rules.blessings.find((choice) => choice.id === "striking-light");
  if (striking?.combat.basicDamageMultiplier !== undefined) {
    modifiers.push({
      id: "blessing:striking-light",
      stage: "ability",
      priority: 900,
      applies: (context) =>
        context.ruleset === "equilibrium" &&
        context.blessingGenerated !== true &&
        (context.abilityCategory === "basic" || context.autoAttack === true),
      apply: (state) => ({
        ...state,
        damage: mulFloor(state.damage, striking.combat.basicDamageMultiplier!),
      }),
      source: striking.source,
    });
  }
  const splash = rules.blessings.find((choice) => choice.id === "splash-zone");
  if (splash?.combat.areaDamageBonus !== undefined) {
    modifiers.push({
      id: "blessing:splash-zone",
      stage: "ability",
      priority: 910,
      applies: (context) =>
        context.ruleset === "equilibrium" &&
        context.blessingGenerated !== true &&
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
