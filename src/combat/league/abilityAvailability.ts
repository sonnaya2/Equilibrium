import type { AbilitySpec, AppliedEffectId, StateEffectId } from "../pipeline/calculateAbility";
import type { BlessingId } from "../../league/blessings";
import { hasBlessing, type ResolvedLeagueRules } from "./ruleset";

type LeagueRestriction = {
  blessingId: BlessingId;
  stateEffects?: readonly StateEffectId[];
  appliedEffects?: readonly AppliedEffectId[];
  message: string;
};

const HIGHER_POWER_RESTRICTION: LeagueRestriction = {
  blessingId: "higher-power",
  stateEffects: ["berserk", "deaths_swiftness", "greater_deaths_swiftness", "living_death"],
  appliedEffects: ["sunshine", "greater_sunshine"],
  message: "Higher Power removes Berserk, Death's Swiftness, Living Death, and Sunshine",
};

const LEAGUE_RESTRICTIONS: readonly LeagueRestriction[] = [HIGHER_POWER_RESTRICTION];

export type LeagueAbilityAvailability = { available: true } | { available: false; message: string };

export function resolveLeagueAbilityAvailability(
  ability: AbilitySpec,
  league: ResolvedLeagueRules | undefined,
): LeagueAbilityAvailability {
  if (league?.ruleset !== "equilibrium") return { available: true };
  for (const restriction of LEAGUE_RESTRICTIONS) {
    if (!hasBlessing(league, restriction.blessingId)) continue;
    if (restriction.stateEffects?.includes(ability.stateEffect as StateEffectId)) {
      return { available: false, message: restriction.message };
    }
    if (restriction.appliedEffects?.includes(ability.appliesEffect as AppliedEffectId)) {
      return { available: false, message: restriction.message };
    }
  }
  return { available: true };
}
