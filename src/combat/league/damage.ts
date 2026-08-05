import type { HitCapRule } from "../core/hitCaps";
import type { CritLayers } from "../core/critical";
import {
  calculateAbility,
  type AbilityResult,
  type AbilitySpec,
} from "../pipeline/calculateAbility";
import { calculateHit, calculateRawHitBand, type HitResult } from "../pipeline/calculateHit";
import type { CombatContext, CombatModifier } from "../types";
import {
  netAdrenalineDeltaFromTransaction,
  previewAdrenalineTransaction,
} from "../shared/adrenalineTransaction";
import {
  capabilitiesOf,
  provenanceFromLegacy,
  type DamageProvenance,
} from "../shared/damageProvenance";
import { COMMAND_REQUIRES_CONJURE } from "../styles/necromancy/conjures";
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
 * Damage provenance for blessing eligibility (shared by Quick calc + simulator).
 */
export type BlessingDamageSource =
  /** Player attack hit (incl. channel / multi-hit extras). */
  | "direct"
  /** Bleed or other DoT tick from a player attack. */
  | "dot"
  /** Conjure command hit (player cast, spirit delivered). */
  | "command"
  /** Autonomous conjure auto or its poison (no player cast). */
  | "conjure"
  /** Equipment/perk proc (Crackling, Aftershock, Abyssal parasite). */
  | "proc"
  /** Damage a blessing itself generated. */
  | "blessing";

export interface BlessingHitEligibility {
  /** Bonus riders: Cinders 15% ability dmg + Big Boned 5% max life. */
  rider: boolean;
  /** On-hit rolls: Inferno 5%, Light of Saradomin; one roll per proc-eligible hit. */
  onHit: boolean;
}

const NO_BLESSING_DAMAGE: BlessingHitEligibility = { rider: false, onHit: false };

/**
 * Blessing eligibility from DamageCapabilities.
 * Rider (Cinders/Big Boned) on direct+DoT+command+conjure; onHit on direct only.
 * Attached always ineligible. No recursion on blessing damage.
 */
export function blessingHitEligibility(
  source: BlessingDamageSource | DamageProvenance,
  attached: boolean,
): BlessingHitEligibility {
  if (attached) return NO_BLESSING_DAMAGE;
  const p: DamageProvenance =
    typeof source === "string"
      ? provenanceFromLegacy({ damageSource: source })
      : source;
  const caps = capabilitiesOf(p);
  return { rider: caps.blessingRider, onHit: caps.blessingOnHit };
}

export interface LeagueDamageInput {
  rules: ResolvedLeagueRules;
  ability: AbilitySpec;
  hitIndex: number;
  /** Provenance of the damage instance these components hang off. */
  source: BlessingDamageSource | DamageProvenance;
  /** True when the instance is an attached component rather than its own hit. */
  attached?: boolean;
  /** Land tick for timed max-life (Powerburst); default 0 = freeze-at-request for single-cast. */
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
  /**
   * Loadout adren rules (FotS, Invigorating, AJ mult, CoE/RoV).
   * Analysis path: no Impatient/Relentless RNG (procs forced false).
   * When omitted, AJ blessing alone multiplies listed generation (legacy callers).
   */
  adrenaline?: {
    basicAdrenalineFlatBonus?: number;
    basicGainMultiplier?: number;
    abilityGainMultiplier?: number;
    conservationOfEnergyRefund?: number;
    ringOfVigour?: boolean;
  };
};

/** Analysis / preview net adren: shared pure transaction (no RNG). */
function analysisAdrenalineDelta(
  ability: AbilitySpec,
  adren: NonNullable<LeagueAbilityInput["adrenaline"]>,
): number {
  return netAdrenalineDeltaFromTransaction(previewAdrenalineTransaction(ability, adren));
}

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
  // Provenance kind "blessing" is canonical for recursion gates; ruleset uses resolveCombatProvenance.
  const blessingProv = (detail: string): DamageProvenance => ({
    kind: "blessing",
    detail,
  });
  const shared = {
    level: input.level,
    accuracy: input.accuracy,
    modifiers: targetModifiers,
    context: {
      ...input.context,
      damageSource: "blessing" as const,
      provenance: blessingProv("pending"),
    },
    cap: input.cap,
  };
  const noCrit: CritLayers = { chance: 0, eligible: false };
  const components: LeagueDamageComponent[] = [];

  // Big Boned: flat 5% land-time max life, attached, crit-eligible (live crit unconfirmed).
  const bigBoned = blessingRule(input.rules, "big-boned");
  if (eligible.rider && bigBoned?.maxLifeDamagePercent !== undefined) {
    const prov = blessingProv("big-boned");
    const hit = calculateHit({
      ...shared,
      provenance: prov,
      context: { ...shared.context, provenance: prov },
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
    const prov = blessingProv("abyssal-cinders");
    const hit = calculateHit({
      ...shared,
      provenance: prov,
      context: { ...shared.context, provenance: prov },
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
    const prov = blessingProv("inferno-of-zamorak");
    const hit = calculateHit({
      ...shared,
      provenance: prov,
      context: { ...shared.context, provenance: prov },
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
    const prov = blessingProv("light-of-saradomin");
    const hit = calculateRawHitBand({
      ...shared,
      provenance: prov,
      context: { ...shared.context, provenance: prov },
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
 * Grasp of Guthix poison via hit pipeline; non-crit, provenance kind blessing (no feed-back).
 */
export function graspOfGuthixComponent(
  input: GraspOfGuthixInput,
): LeagueDamageComponent | undefined {
  const barkscales = blessingRule(input.rules, "barkscales")?.barkscales;
  if (!barkscales || input.triggers <= 0 || input.targetsStruck <= 0) return undefined;
  const applications = input.triggers * input.targetsStruck;
  const provenance: DamageProvenance = { kind: "blessing", detail: "grasp-of-guthix" };
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
    provenance,
    context: {
      ...input.context,
      damageSource: "blessing",
      dotKind: "poison",
      provenance,
    },
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
  // Light of Saradomin 9s CD: at most first direct hit of this cast can trigger.
  let lightAvailable = strikingLightReady ?? true;
  const contributions = ability.hits.flatMap((hit, hitIndex) => {
    const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
    const source: BlessingDamageSource = hit.dot
      ? "dot"
      : isCommand
        ? "command"
        : "direct";
    const provenance: DamageProvenance = hit.dot
      ? { kind: "player_dot", detail: hit.dotKind }
      : isCommand
        ? { kind: "conjure_command" }
        : ability.autoAttack
          ? { kind: "player_auto" }
          : { kind: "player_direct" };
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
        damageSource: source,
        provenance,
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
    adrenalineDelta: (() => {
      if (input.adrenaline) {
        return analysisAdrenalineDelta(ability, input.adrenaline);
      }
      // Legacy: AJ blessing mult on listed generation only.
      const cost = ability.adrenaline?.cost ?? 0;
      const listed = ability.adrenaline?.gain ?? 0;
      const aj = blessingRule(rules, "adrenaline-junkie")?.adrenalineGenerationMultiplier ?? 1;
      return listed * aj - cost;
    })(),
    leagueContributions: contributions,
  };
}
