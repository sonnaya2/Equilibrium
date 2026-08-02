import type { HitCapRule } from "../core/hitCaps";
import type { CritLayers } from "../core/critical";
import {
  calculateAbility,
  type AbilityResult,
  type AbilitySpec,
} from "../pipeline/calculateAbility";
import { calculateHit, calculateRawHitBand, type HitResult } from "../pipeline/calculateHit";
import type { CombatContext, CombatModifier } from "../types";
import { blessingRule, resolveMaximumLife, type ResolvedLeagueRules } from "./ruleset";
import type { BlessingId } from "../../league/blessings";
import { packageCritical, type ResolvedDamage } from "../engine/resolution/types";

/** Tag for blessing-generated damage instances shown in analysis. */
export type BlessingDamageTag = "bonus-damage";

export interface LeagueDamageComponent {
  effectId: string;
  blessingId: BlessingId;
  attached: boolean;
  /** Analysis tag (e.g. bonus-damage riders shown in the Bonus damage column). */
  damageTag?: BlessingDamageTag;
  /** Legacy application weight; kept for older consumers and EV packing. */
  expectedOccurrences: number;
  /** Probability rolls this component represents (Inferno 5% = 1). */
  triggerRolls: number;
  /** Expected activations (0.05 for one 5% roll; 1 for a deterministic rider). */
  expectedActivations: number;
  /** Expected separate hits; 0 when attached. */
  expectedSeparateHits: number;
  damage: ResolvedDamage;
  hitDetail?: HitResult;
}

/**
 * Where one damage instance came from, as the blessings see it. This is the only
 * vocabulary blessing eligibility is expressed in, so the Quick calculator and
 * the simulator cannot drift apart on which damage qualifies.
 */
export type BlessingDamageSource =
  /** An ordinary hit of a player attack — including channel hits and extra hits of a multi-hit. */
  | "direct"
  /** A bleed or other damage-over-time tick from a player attack. */
  | "dot"
  /** A conjure command hit: the player cast it, the spirit delivered it. */
  | "command"
  /** An autonomous conjure auto or its poison — no player cast behind this tick. */
  | "conjure"
  /** Equipment or Invention perk proc damage (Crackling, Aftershock, Abyssal parasite). */
  | "proc"
  /** Damage a blessing itself generated. */
  | "blessing";

export interface BlessingHitEligibility {
  /**
   * Riders that read as bonus damage on damage already being dealt: Abyssal
   * Cinders' 15% ("your attacks deal 15% of ability damage as bonus damage")
   * and Big Boned's 5% of maximum life ("all damage you deal gains…").
   */
  rider: boolean;
  /**
   * Rolls and cooldown-gated triggers that the cards prefix with "on hit":
   * Inferno of Zamorak's 5% and Light of Saradomin. These follow the engine's
   * hit-count integrity rule — one real proc-eligible hit is one roll.
   */
  onHit: boolean;
}

const NO_BLESSING_DAMAGE: BlessingHitEligibility = { rider: false, onHit: false };

/**
 * The single eligibility policy for blessing-generated damage.
 *
 * Sourced: the reveal text prefixes both Abyssal Cinders clauses with "On hit",
 * so each qualifying landed hit rolls — a seven-hit Greater Ricochet gets seven
 * 5% rolls, not one. Big Boned's "all damage you deal" is deliberately wider
 * than the Cinders wording and covers damage-over-time too.
 *
 * Provisional, and flagged as such in the blessing records:
 *   - a damage-over-time tick carries the riders but does not roll an on-hit
 *     proc: it is the tail of an attack whose landing already rolled;
 *   - autonomous conjure damage is not "your attacks" and is excluded entirely,
 *     while a commanded hit — a player cast — keeps the riders;
 *   - equipment and perk procs are neither attacks nor damage the player dealt
 *     directly, so they are excluded;
 *   - attached components are never separate hits, so per the hit-count
 *     integrity rule they can neither carry a rider nor roll a proc;
 *   - blessing damage never feeds any blessing, so nothing can recurse.
 * Damage Potential replaces hit/miss rolls against NPCs, so there is no "missed
 * hit" case; a zero-damage event is excluded by its caller.
 */
export function blessingHitEligibility(
  source: BlessingDamageSource,
  attached: boolean,
): BlessingHitEligibility {
  if (attached || source === "blessing" || source === "proc" || source === "conjure") {
    return NO_BLESSING_DAMAGE;
  }
  return { rider: true, onHit: source === "direct" };
}

export interface LeagueDamageInput {
  rules: ResolvedLeagueRules;
  ability: AbilitySpec;
  hitIndex: number;
  /** Provenance of the damage instance these components hang off. */
  source: BlessingDamageSource;
  /** True when the instance is an attached component rather than its own hit. */
  attached?: boolean;
  /**
   * Sim land tick for timed max-life effects (Powerburst). Defaults to 0 so
   * single-cast views use the freeze-at-request window.
   */
  landTick?: number;
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  modifiers: readonly CombatModifier[];
  context: CombatContext;
  cap?: HitCapRule;
  strikingLightReady?: boolean;
}

export type LeagueAbilityInput = Parameters<typeof calculateAbility>[1] & {
  rules: ResolvedLeagueRules;
  /** Light of Saradomin's cooldown state entering the cast; ready by default. */
  strikingLightReady?: boolean;
};

export interface LeagueAbilityResult extends AbilityResult {
  leagueContributions: readonly LeagueDamageComponent[];
}

function damageOf(hit: HitResult): ResolvedDamage {
  return {
    min: hit.min,
    max: hit.max,
    expected: hit.expected,
    critExpected: hit.critExpected,
    capLoss: hit.capLoss,
    critical: packageCritical(hit.critChance, hit.critExpected, hit.nonCritExpected),
  };
}

function expectedProc(hit: HitResult, chance: number): ResolvedDamage {
  const damage = damageOf(hit);
  return {
    ...damage,
    min: 0,
    expected: damage.expected * chance,
    critExpected: damage.critExpected === undefined ? undefined : damage.critExpected * chance,
    capLoss: (damage.capLoss ?? 0) * chance,
    critical: damage.critical
      ? { ...damage.critical, contribution: damage.critical.contribution * chance }
      : undefined,
  };
}

/** Damage generated by one original hit; returned as explicit analysis/event components. */
export function leagueDamageComponents(input: LeagueDamageInput): LeagueDamageComponent[] {
  if (input.rules.ruleset !== "equilibrium") return [];
  const eligible = blessingHitEligibility(input.source, input.attached === true);
  if (!eligible.rider && !eligible.onHit) return [];
  const targetModifiers = input.modifiers.filter(
    (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
  );
  const shared = {
    level: input.level,
    accuracy: input.accuracy,
    modifiers: targetModifiers,
    context: { ...input.context, blessingGenerated: true },
    cap: input.cap,
  };
  const noCrit: CritLayers = { chance: 0, eligible: false };
  const components: LeagueDamageComponent[] = [];

  // Per unique hit (Mod Sponge): flat 5% of land-time max life, attached,
  // crit-eligible bonus damage (product model — live crit eligibility unverified).
  const bigBoned = blessingRule(input.rules, "big-boned");
  if (eligible.rider && bigBoned?.maxLifeDamagePercent !== undefined) {
    const hit = calculateHit({
      ...shared,
      base: resolveMaximumLife(input.rules, input.landTick ?? 0),
      band: {
        minPct: bigBoned.maxLifeDamagePercent * 100,
        maxPct: bigBoned.maxLifeDamagePercent * 100,
      },
      crit: { ...input.crit, eligible: true },
    });
    components.push({
      effectId: "big-boned",
      blessingId: "big-boned",
      attached: true,
      damageTag: "bonus-damage",
      expectedOccurrences: 1,
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 0,
      damage: damageOf(hit),
      hitDetail: hit,
    });
  }

  const cinders = blessingRule(input.rules, "abyssal-cinders");
  if (eligible.rider && cinders?.perHitAbilityDamagePercent !== undefined) {
    const hit = calculateHit({
      ...shared,
      base: input.base,
      band: {
        minPct: cinders.perHitAbilityDamagePercent * 100,
        maxPct: cinders.perHitAbilityDamagePercent * 100,
      },
      crit: noCrit,
    });
    components.push({
      effectId: "abyssal-cinders",
      blessingId: "abyssal-cinders",
      attached: true,
      expectedOccurrences: 1,
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 0,
      damage: damageOf(hit),
      hitDetail: hit,
    });
  }
  if (eligible.onHit && cinders?.inferno) {
    const chance = cinders.inferno.chance;
    const hit = calculateHit({
      ...shared,
      base: input.base,
      band: {
        minPct: cinders.inferno.abilityDamageBand[0],
        maxPct: cinders.inferno.abilityDamageBand[1],
      },
      crit: { ...input.crit, eligible: true },
    });
    components.push({
      effectId: "inferno-of-zamorak",
      blessingId: "abyssal-cinders",
      attached: false,
      expectedOccurrences: chance,
      triggerRolls: 1,
      expectedActivations: chance,
      expectedSeparateHits: chance,
      damage: expectedProc(hit, chance),
    });
  }

  const light = blessingRule(input.rules, "striking-light")?.light;
  if (
    eligible.onHit &&
    input.strikingLightReady &&
    light &&
    (input.ability.category === "basic" || input.ability.autoAttack)
  ) {
    const armour = Math.floor(input.rules.totalArmour * light.armourPercent);
    const hit = calculateRawHitBand({
      ...shared,
      min: Math.floor(input.base * (light.abilityDamageBand[0] / 100)) + armour,
      max: Math.floor(input.base * (light.abilityDamageBand[1] / 100)) + armour,
      crit: { ...input.crit, eligible: true },
    });
    components.push({
      effectId: "light-of-saradomin",
      blessingId: "striking-light",
      attached: false,
      expectedOccurrences: 1,
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      damage: damageOf(hit),
      hitDetail: hit,
    });
  }

  return components;
}

export interface GraspOfGuthixInput {
  rules: ResolvedLeagueRules;
  /** Grasp triggers over the measured window, from the Barkscales scenario. */
  triggers: number;
  /** Tiles of the 3x3 holding a target; 0 when the target is poison-immune. */
  targetsStruck: number;
  base: number;
  level: number;
  accuracy: number;
  modifiers: readonly CombatModifier[];
  context: CombatContext;
  cap?: HitCapRule;
}

/**
 * Grasp of Guthix, resolved through the same hit pipeline as every other
 * blessing component so the poison band, target modifiers and hit cap are not
 * re-derived here. Poison damage is not critical-eligible, and like every other
 * blessing-generated hit it carries `blessingGenerated` so it cannot feed
 * Abyssal Cinders, Splash Zone, Striking Light, or itself.
 */
export function graspOfGuthixComponent(
  input: GraspOfGuthixInput,
): LeagueDamageComponent | undefined {
  const barkscales = blessingRule(input.rules, "barkscales")?.barkscales;
  if (!barkscales || input.triggers <= 0 || input.targetsStruck <= 0) return undefined;
  const applications = input.triggers * input.targetsStruck;
  const hit = calculateHit({
    base: input.base,
    band: {
      minPct: barkscales.graspAbilityDamageBand[0],
      maxPct: barkscales.graspAbilityDamageBand[1],
    },
    level: input.level,
    accuracy: input.accuracy,
    crit: { chance: 0, eligible: false },
    modifiers: input.modifiers.filter(
      (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
    ),
    context: { ...input.context, blessingGenerated: true, dotKind: "poison" },
    cap: input.cap,
  });
  const damage = damageOf(hit);
  return {
    effectId: "grasp-of-guthix",
    blessingId: "barkscales",
    attached: false,
    expectedOccurrences: applications,
    triggerRolls: 0,
    expectedActivations: applications,
    expectedSeparateHits: applications,
    damage: {
      ...damage,
      min: damage.min * applications,
      max: damage.max * applications,
      expected: damage.expected * applications,
      capLoss: (damage.capLoss ?? 0) * applications,
    },
    hitDetail: hit,
  };
}

/** Single-cast view using the same component resolver as scheduled simulation events. */
export function calculateLeagueAbility(
  ability: AbilitySpec,
  input: LeagueAbilityInput,
): LeagueAbilityResult {
  const { rules, strikingLightReady, ...baseInput } = input;
  const ordinary = calculateAbility(ability, baseInput);
  // Light of Saradomin's 9-second cooldown outlives any single cast, so at most
  // the first direct hit of this cast can trigger it.
  let lightAvailable = strikingLightReady ?? true;
  const contributions = ability.hits.flatMap((hit, hitIndex) => {
    const source: BlessingDamageSource = hit.dot ? "dot" : "direct";
    const components = leagueDamageComponents({
      rules,
      ability,
      hitIndex,
      source,
      base: input.base,
      level: input.level,
      accuracy: input.accuracy,
      crit: input.crit,
      modifiers: input.modifiers ?? [],
      context: {
        ...input.context,
        style: ability.style,
        abilityCategory: ability.category,
        autoAttack: ability.autoAttack,
        area: ability.area,
      },
      cap: input.cap,
      strikingLightReady: lightAvailable,
    });
    if (components.some((component) => component.effectId === "light-of-saradomin")) {
      lightAvailable = false;
    }
    return components;
  });
  return {
    ...ordinary,
    hits: [
      ...ordinary.hits,
      ...contributions.flatMap((component) =>
        !component.attached && component.expectedOccurrences === 1 && component.hitDetail
          ? [component.hitDetail]
          : [],
      ),
    ],
    min: ordinary.min + contributions.reduce((sum, component) => sum + component.damage.min, 0),
    max: ordinary.max + contributions.reduce((sum, component) => sum + component.damage.max, 0),
    expected:
      ordinary.expected +
      contributions.reduce((sum, component) => sum + component.damage.expected, 0),
    adrenalineDelta:
      (ability.adrenaline?.gain ?? 0) *
        (blessingRule(rules, "adrenaline-junkie")?.adrenalineGenerationMultiplier ?? 1) -
      (ability.adrenaline?.cost ?? 0),
    leagueContributions: contributions,
  };
}
