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

export interface ResolvedLeagueRules {
  ruleset: "base" | "equilibrium";
  blessings: readonly BlessingChoice[];
  blessingIds: ReadonlySet<BlessingId>;
  totalArmour: number;
  maximumLife: number;
  targetTiles: number;
}

export function resolveLeagueRules(
  loadout: LeagueLoadout,
  derived: { totalArmour?: number; maximumLife?: number; targetTiles?: number } = {},
): ResolvedLeagueRules {
  const ruleset = loadout.ruleset === "equilibrium" ? "equilibrium" : "base";
  const blessings = ruleset === "equilibrium" ? activeBlessings(loadout.blessingPicks ?? []) : [];
  return {
    ruleset,
    blessings,
    blessingIds: new Set(blessings.map((choice) => choice.id)),
    totalArmour: Math.max(0, derived.totalArmour ?? 0),
    maximumLife: Math.max(0, derived.maximumLife ?? 0),
    targetTiles: Math.max(1, Math.floor(derived.targetTiles ?? 1)),
  };
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
