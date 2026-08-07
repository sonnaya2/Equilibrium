import type { HitCapRule } from "../core/hitCaps";
import type { CritLayers } from "../core/critical";
import {
  calculateAbility,
  type AbilityResult,
  type AbilitySpec,
} from "../pipeline/calculateAbility";
import {
  calculateHitWithAttached,
  calculateRawHitBandWithAttached,
  type HitInput,
  type HitResult,
  type RawHitBandInput,
} from "../pipeline/calculateHit";
import type { CombatContext, CombatModifier } from "../types";
import {
  netAdrenalineDeltaFromTransaction,
  previewAdrenalineTransaction,
} from "../shared/adrenalineTransaction";
import {
  capabilitiesOf,
  outgoingSourceOf,
  provenanceFromLegacy,
  type DamageProvenance,
} from "../shared/damageProvenance";
import { COMMAND_REQUIRES_CONJURE } from "../styles/necromancy/conjures";
import { blessingRule, resolveMaximumLife, type ResolvedLeagueRules } from "./ruleset";
import type { BlessingId } from "../../league/blessings";
import {
  packageCritical,
  type AttachedDamageComponent,
  type ResolvedDamage,
} from "../engine/resolution/types";
import { isBasicAttack } from "../shared/adrenalineGain";
import { mulFloor } from "../core/rounding";
import type { StatefulOccurrenceModel } from "../engine/runtime/events";

/** Tag for blessing-generated damage instances shown in analysis. */
export type BlessingDamageTag = "bonus-damage";

export interface LeagueDamageComponent {
  effectId: string;
  blessingId: BlessingId;
  attached: boolean;
  /** Analysis tag (e.g. bonus-damage riders shown in the Bonus damage column). */
  damageTag?: BlessingDamageTag;
  /** Effect row that receives this bonus instead of the scheduling parent. */
  bonusTargetId?: string;
  /** Legacy application weight; kept for older consumers and EV packing. */
  expectedOccurrences: number;
  /** Expected proc rolls this component represents (Inferno 5% = 1). */
  expectedTriggerRolls: number;
  /** Expected activations (0.05 for one 5% roll; 1 for a deterministic rider). */
  expectedActivations: number;
  /** Expected separate hits; 0 when attached. */
  expectedSeparateHits: number;
  occurrenceModel?: StatefulOccurrenceModel;
  damage: ResolvedDamage;
  hitDetail?: HitResult;
  components?: readonly AttachedDamageComponent[];
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
  /** Big Boned 5% max-life attached rider (not a unique hit). */
  rider: boolean;
  /** Cinders rider and Inferno roll; direct player attacks and direct derived bounces qualify. */
  cinders: boolean;
  /** Direct on-hit effects such as Light of Saradomin. */
  onHit: boolean;
}

const NO_BLESSING_DAMAGE: BlessingHitEligibility = {
  rider: false,
  cinders: false,
  onHit: false,
};

/**
 * Blessing eligibility from DamageCapabilities.
 * Big Boned, Cinders, and direct on-hit effects use separate capability gates.
 * Attached always ineligible.
 */
export function blessingHitEligibility(
  source: BlessingDamageSource | DamageProvenance,
  attached: boolean,
): BlessingHitEligibility {
  if (attached) return NO_BLESSING_DAMAGE;
  const p: DamageProvenance =
    typeof source === "string" ? provenanceFromLegacy({ damageSource: source }) : source;
  if (p.kind === "blessing" && (p.detail === "big-boned" || p.detail === "abyssal-cinders")) {
    return NO_BLESSING_DAMAGE;
  }
  const caps = capabilitiesOf(p);
  return {
    rider: caps.blessingRider,
    cinders: caps.cindersOnHit,
    onHit: caps.blessingOnHit,
  };
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
  /** Big Boned inherits this parent's crit eligibility and outcome. */
  parentCrit?: CritLayers;
  modifiers: readonly CombatModifier[];
  context: CombatContext;
  cap?: HitCapRule;
  preciseRank?: number;
  strikingLightReady?: boolean;
  lordOfLightReady?: boolean;
}

export type LeagueAbilityInput = Parameters<typeof calculateAbility>[1] & {
  rules: ResolvedLeagueRules;
  /** Light of Saradomin's cooldown state entering the cast; ready by default. */
  strikingLightReady?: boolean;
  /** Lord of Light's independent cooldown state entering the cast. */
  lordOfLightReady?: boolean;
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

function weightedDamage(
  hit: HitResult,
  expectedActivations: number,
  minActivations: number,
  maxActivations: number,
  inheritedCrit = false,
): ResolvedDamage {
  const damage = damageOf(hit);
  return {
    ...damage,
    min: damage.min * minActivations,
    max: damage.max * maxActivations,
    expected: damage.expected * expectedActivations,
    critExpected:
      damage.critExpected === undefined ? undefined : damage.critExpected * expectedActivations,
    capLoss: (damage.capLoss ?? 0) * expectedActivations,
    critical: damage.critical
      ? {
          ...damage.critical,
          contribution: damage.critical.contribution * expectedActivations,
          ...(inheritedCrit ? { inherited: true } : {}),
        }
      : undefined,
  };
}

export interface LeagueAttachedHostInput extends HitInput {
  rules?: ResolvedLeagueRules;
  source: BlessingDamageSource | DamageProvenance;
  context: CombatContext;
  attached?: boolean;
  landTick?: number;
  bonusTargetId?: string;
}

export interface LeagueAttachedHostResult {
  hit: HitResult;
  baseHit: HitResult;
  components: readonly LeagueDamageComponent[];
}

type LeagueAttachedTerm = {
  id: "big-boned" | "abyssal-cinders";
  blessingId: "big-boned" | "abyssal-cinders";
  amount: number;
};

function leagueAttachedTerms(input: {
  rules: ResolvedLeagueRules;
  source: BlessingDamageSource | DamageProvenance;
  attached?: boolean;
  landTick?: number;
  abilityBase: number;
}): LeagueAttachedTerm[] {
  const provenance =
    typeof input.source === "string"
      ? provenanceFromLegacy({ damageSource: input.source })
      : input.source;
  const eligible = blessingHitEligibility(provenance, input.attached === true);
  const terms: LeagueAttachedTerm[] = [];
  const bigBoned = blessingRule(input.rules, "big-boned");
  if (eligible.rider && bigBoned?.maxLifeDamagePercent !== undefined) {
    terms.push({
      id: "big-boned",
      blessingId: "big-boned",
      amount: Math.floor(
        resolveMaximumLife(input.rules, input.landTick ?? 0) * bigBoned.maxLifeDamagePercent,
      ),
    });
  }
  const cinders = blessingRule(input.rules, "abyssal-cinders");
  if (eligible.cinders && cinders?.perHitAbilityDamagePercent !== undefined) {
    terms.push({
      id: "abyssal-cinders",
      blessingId: "abyssal-cinders",
      amount: Math.floor(input.abilityBase * cinders.perHitAbilityDamagePercent),
    });
  }
  return terms;
}

function leagueAttachedComponents(
  deltas: readonly { id: string; hit: HitResult }[],
  terms: readonly LeagueAttachedTerm[],
  bonusTargetId?: string,
): LeagueDamageComponent[] {
  return deltas.map((delta, index) => {
    const term = terms[index]!;
    return {
      effectId: term.id,
      blessingId: term.blessingId,
      attached: true,
      damageTag: "bonus-damage",
      ...(bonusTargetId ? { bonusTargetId } : {}),
      expectedOccurrences: 1,
      expectedTriggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 0,
      damage: damageOf(delta.hit),
      hitDetail: delta.hit,
    };
  });
}

/** Resolve Big Boned and Cinders inside the host hit's own pipeline and cap. */
export function resolveLeagueAttachedHost(
  input: LeagueAttachedHostInput,
): LeagueAttachedHostResult {
  const provenance =
    typeof input.source === "string"
      ? provenanceFromLegacy({ damageSource: input.source })
      : input.source;
  const context = {
    ...input.context,
    damageSource: outgoingSourceOf(provenance),
    provenance,
  };
  if (!input.rules) {
    const composed = calculateHitWithAttached({ ...input, provenance, context }, []);
    return {
      hit: composed.hit,
      baseHit: composed.baseHit,
      components: [],
    };
  }
  const terms = leagueAttachedTerms({ ...input, rules: input.rules, abilityBase: input.base });
  const composed = calculateHitWithAttached(
    { ...input, provenance, context },
    terms.map(({ id, amount }) => ({ id, amount })),
  );
  const components = leagueAttachedComponents(composed.attached, terms, input.bonusTargetId);
  return { hit: composed.hit, baseHit: composed.baseHit, components };
}

export interface LeagueAttachedRawHostInput extends RawHitBandInput {
  rules?: ResolvedLeagueRules;
  source: BlessingDamageSource | DamageProvenance;
  context: CombatContext;
  abilityBase: number;
  attached?: boolean;
  landTick?: number;
  bonusTargetId?: string;
}

export function resolveLeagueAttachedRawHost(
  input: LeagueAttachedRawHostInput,
): LeagueAttachedHostResult {
  const provenance =
    typeof input.source === "string"
      ? provenanceFromLegacy({ damageSource: input.source })
      : input.source;
  const context = {
    ...input.context,
    damageSource: outgoingSourceOf(provenance),
    provenance,
  };
  if (!input.rules) {
    const composed = calculateRawHitBandWithAttached({ ...input, provenance, context }, []);
    return {
      hit: composed.hit,
      baseHit: composed.baseHit,
      components: [],
    };
  }
  const terms = leagueAttachedTerms({ ...input, rules: input.rules });
  const composed = calculateRawHitBandWithAttached(
    { ...input, provenance, context },
    terms.map(({ id, amount }) => ({ id, amount })),
  );
  return {
    hit: composed.hit,
    baseHit: composed.baseHit,
    components: leagueAttachedComponents(composed.attached, terms, input.bonusTargetId),
  };
}

export function attachedResolutionComponent(
  component: LeagueDamageComponent,
  expectedActivations = component.expectedActivations,
  minActivations = expectedActivations,
  maxActivations = expectedActivations,
): AttachedDamageComponent {
  const damage = component.hitDetail
    ? weightedDamage(component.hitDetail, expectedActivations, minActivations, maxActivations, true)
    : component.damage;
  return {
    id: component.effectId,
    damage,
    ...(component.hitDetail ? { hitDetail: component.hitDetail } : {}),
    attached: true,
    hitCapPolicy: "shared",
    analysis: {
      kind: "league-blessing",
      blessingId: component.blessingId,
      ...(component.bonusTargetId ? { bonusTargetId: component.bonusTargetId } : {}),
      expectedActivations,
    },
  };
}

/** Damage generated by one original hit; returned as explicit analysis/event components. */
export function leagueDamageComponents(input: LeagueDamageInput): LeagueDamageComponent[] {
  if (input.rules.ruleset !== "equilibrium") return [];
  const eligible = blessingHitEligibility(input.source, input.attached === true);
  if (!eligible.rider && !eligible.cinders && !eligible.onHit) return [];
  const targetModifiers = input.modifiers.filter(
    (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
  );
  const blessingProv = (detail: string): DamageProvenance => ({
    kind: "blessing",
    detail,
  });
  const separateShared = {
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
  const components: LeagueDamageComponent[] = [];

  const cinders = blessingRule(input.rules, "abyssal-cinders");
  const infernoChance = eligible.cinders ? (cinders?.inferno?.chance ?? 0) : 0;
  if (infernoChance < 0 || infernoChance > 1) {
    throw new RangeError(`Abyssal Cinders chance ${infernoChance} must be in [0, 1]`);
  }
  const parentProvenance =
    typeof input.source === "string"
      ? provenanceFromLegacy({ damageSource: input.source })
      : input.source;
  const parentCrit = input.parentCrit ?? {
    ...input.crit,
    eligible:
      capabilitiesOf(parentProvenance).canCrit &&
      (input.ability.hits[input.hitIndex]?.critEligible ?? true),
  };
  const infernoCrit: CritLayers = { ...input.crit, eligible: true };

  const hitSpec = input.ability.hits[input.hitIndex];
  if (hitSpec && (eligible.rider || eligible.cinders)) {
    const attachedHost = resolveLeagueAttachedHost({
      rules: input.rules,
      source: parentProvenance,
      attached: input.attached,
      landTick: input.landTick,
      base: input.base,
      band: hitSpec.band,
      level: input.level,
      accuracy: input.accuracy,
      crit: parentCrit,
      modifiers: [...input.modifiers],
      context: input.context,
      cap: input.cap,
      preciseRank: input.preciseRank,
    });
    components.push(...attachedHost.components);
  } else if (eligible.rider || eligible.cinders) {
    const attachedHost = resolveLeagueAttachedRawHost({
      rules: input.rules,
      source: parentProvenance,
      attached: input.attached,
      landTick: input.landTick,
      abilityBase: input.base,
      min: 0,
      max: 0,
      level: input.level,
      accuracy: input.accuracy,
      crit: parentCrit,
      modifiers: [...input.modifiers],
      context: input.context,
      cap: input.cap,
    });
    components.push(...attachedHost.components);
  }
  if (eligible.cinders && cinders?.inferno) {
    const prov = blessingProv("inferno-of-zamorak");
    const inferno = resolveLeagueAttachedHost({
      ...separateShared,
      rules: input.rules,
      source: prov,
      bonusTargetId: "inferno-of-zamorak",
      base: input.base,
      band: {
        minPct: cinders.inferno.abilityDamageBand[0],
        maxPct: cinders.inferno.abilityDamageBand[1],
      },
      crit: infernoCrit,
    });
    components.push({
      effectId: "inferno-of-zamorak",
      blessingId: "abyssal-cinders",
      attached: false,
      expectedOccurrences: infernoChance,
      expectedTriggerRolls: 1,
      expectedActivations: infernoChance,
      expectedSeparateHits: infernoChance,
      occurrenceModel: {
        kind: "bernoulli",
        probability: infernoChance,
      },
      damage: weightedDamage(inferno.hit, infernoChance, 0, 1),
      hitDetail: inferno.hit,
      components: inferno.components.map((component) =>
        attachedResolutionComponent(component, infernoChance, 0, 1),
      ),
    });
  }

  const strikingLight = blessingRule(input.rules, "striking-light")?.light;
  const lordLight = blessingRule(input.rules, "lord-of-light")?.light;
  if (eligible.onHit && isBasicAttack(input.ability)) {
    const prayerMultiplier = 1 + input.rules.prayerBonus * (lordLight?.prayerDamagePerBonus ?? 0);
    const prayerSource = input.rules.blessings.find(
      (choice) => choice.id === "lord-of-light",
    )?.source;
    const pushLights = (
      light: NonNullable<typeof strikingLight>,
      blessingId: "striking-light" | "lord-of-light",
      count: number,
    ) => {
      const armour = Math.floor(input.rules.totalArmour * light.armourPercent);
      const rawMin = Math.floor(input.base * (light.abilityDamageBand[0] / 100)) + armour;
      const rawMax = Math.floor(input.base * (light.abilityDamageBand[1] / 100)) + armour;
      const prov = blessingProv("light-of-saradomin");
      const prayerModifier: CombatModifier | null =
        prayerMultiplier === 1 || !prayerSource
          ? null
          : {
              id: "blessing:lord-of-light-prayer",
              stage: "ability",
              priority: 0,
              applies: () => true,
              apply: (state) => ({ ...state, damage: mulFloor(state.damage, prayerMultiplier) }),
              source: prayerSource,
            };
      const resolved = resolveLeagueAttachedRawHost({
        ...separateShared,
        rules: input.rules,
        source: prov,
        abilityBase: input.base,
        bonusTargetId: "light-of-saradomin",
        min: rawMin,
        max: rawMax,
        crit: { ...input.crit, eligible: true },
        modifiers: prayerModifier ? [prayerModifier, ...targetModifiers] : targetModifiers,
      });
      for (let i = 0; i < count; i++) {
        components.push({
          effectId: "light-of-saradomin",
          blessingId,
          attached: false,
          expectedOccurrences: 1,
          expectedTriggerRolls: 0,
          expectedActivations: 1,
          expectedSeparateHits: 1,
          damage: damageOf(resolved.hit),
          hitDetail: resolved.hit,
          components: resolved.components.map((component) =>
            attachedResolutionComponent(component),
          ),
        });
      }
    };
    if (input.strikingLightReady && strikingLight) {
      pushLights(strikingLight, "striking-light", 1);
    }
    if (input.lordOfLightReady && lordLight) {
      const targets = Math.min(
        lordLight.maxTargetsPerStrike ?? 1,
        Math.max(1, input.rules.areaTargets),
      );
      pushLights(lordLight, "lord-of-light", (lordLight.strikes ?? 1) * targets);
    }
  }

  return components;
}

export interface GraspOfGuthixInput {
  rules: ResolvedLeagueRules;
  /** Grasp triggers over the measured window, from the Barkscales scenario. */
  triggers: number;
  /** Distinct targets struck in the 3x3; 0 when no target can be poisoned. */
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
  const resolved = resolveLeagueAttachedHost({
    rules: input.rules,
    source: provenance,
    bonusTargetId: "grasp-of-guthix",
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
  return {
    effectId: "grasp-of-guthix",
    blessingId: "barkscales",
    attached: false,
    expectedOccurrences: applications,
    expectedTriggerRolls: 0,
    expectedActivations: applications,
    expectedSeparateHits: applications,
    damage: weightedDamage(resolved.hit, applications, applications, applications),
    hitDetail: resolved.hit,
    components: resolved.components.map((component) =>
      attachedResolutionComponent(component, applications, applications, applications),
    ),
  };
}

/** Single-cast view using the same component resolver as scheduled simulation events. */
export function calculateLeagueAbility(
  ability: AbilitySpec,
  input: LeagueAbilityInput,
): LeagueAbilityResult {
  const { rules, strikingLightReady, lordOfLightReady, ...baseInput } = input;
  const ordinary = calculateAbility(ability, baseInput);
  // Light of Saradomin 9s CD: at most first direct hit of this cast can trigger.
  let strikingLightAvailable = strikingLightReady ?? true;
  let lordOfLightAvailable = lordOfLightReady ?? true;
  const contributions = ability.hits.flatMap((hit, hitIndex) => {
    const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
    const source: BlessingDamageSource = hit.dot ? "dot" : isCommand ? "command" : "direct";
    const provenance: DamageProvenance = hit.dot
      ? { kind: "player_dot", detail: hit.dotKind }
      : isCommand
        ? { kind: "conjure_command" }
        : { kind: "player_direct" };
    const crit = input.critByHit?.[hitIndex] ?? input.crit;
    const sharedInput = {
      rules,
      ability,
      hitIndex,
      base: input.base,
      level: input.level,
      accuracy: input.accuracy,
      crit,
      parentCrit: { ...crit, eligible: hit.critEligible ?? true },
      modifiers: input.modifiers ?? [],
      context: {
        ...input.context,
        style: ability.style,
        abilityCategory: ability.category,
        basicAttack: isBasicAttack(ability),
        area: ability.area,
        damageSource: source,
        provenance,
      },
      cap: input.cap,
      preciseRank: input.preciseRank,
    };
    const components = leagueDamageComponents({
      ...sharedInput,
      source,
      strikingLightReady: strikingLightAvailable,
      lordOfLightReady: lordOfLightAvailable,
    });
    if (components.some((component) => component.blessingId === "striking-light")) {
      strikingLightAvailable = false;
    }
    if (components.some((component) => component.blessingId === "lord-of-light")) {
      lordOfLightAvailable = false;
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
