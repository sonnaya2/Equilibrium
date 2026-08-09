import { bandOf } from "../../core/abilityDamage";
import type { CritLayers, DiscreteUniformCritDamageLayer } from "../../core/critical";
import type { HitCapRule } from "../../core/hitCaps";
import {
  applyAbilityBaseModifiers,
  compileActiveModifiers,
  runOrderedPipeline,
} from "../../pipeline/modifierPipeline";
import {
  calculateRawHitBand,
  MAX_EXACT_BAND_POINTS,
  type HitResult,
} from "../../pipeline/calculateHit";
import type { CombatContext, CombatModifier, CombatStyle, ModifierStage } from "../../types";
import { capabilitiesOf, type DamageProvenance } from "../../shared/damageProvenance";
import { balanceByForceActive, type RangedRotationState } from "./effects";

export const BOTLG_PERFECT_EQUILIBRIUM_PASSIVE_ID = "perfect-equilibrium" as const;
export const PERFECT_EQUILIBRIUM_STACK_CAP = 8;
export const PERFECT_EQUILIBRIUM_BALANCE_STACK_CAP = 4;
export const PERFECT_EQUILIBRIUM_PRECAST_TRIGGER_STACKS = 3;
export const PERFECT_EQUILIBRIUM_ABILITY_DAMAGE_BAND = { minPct: 12, maxPct: 16 } as const;
export const PERFECT_EQUILIBRIUM_TRIGGER_DAMAGE_BAND = { minPct: 33, maxPct: 37 } as const;

const MAX_EXACT_TERM_CONVOLUTION_PAIRS = 10_000_000;

export function perfectEquilibriumStackThreshold(
  state: Pick<RangedRotationState, "balanceByForce">,
  tick: number,
): number {
  return balanceByForceActive(state.balanceByForce, tick)
    ? PERFECT_EQUILIBRIUM_BALANCE_STACK_CAP
    : PERFECT_EQUILIBRIUM_STACK_CAP;
}

export function perfectEquilibriumHitEligible(args: {
  style: CombatStyle;
  provenance: DamageProvenance;
}): boolean {
  const capabilities = capabilitiesOf(args.provenance);
  return (
    args.style === "ranged" &&
    capabilities.playerAttack &&
    capabilities.directHit &&
    capabilities.canGeneratePerfectEquilibrium === true
  );
}

export interface PerfectEquilibriumStackResult {
  stacks: number;
  triggered: boolean;
}

export function recordPerfectEquilibriumHit(
  state: Pick<RangedRotationState, "balanceByForce" | "perfectEquilibriumStacks">,
  args: { style: CombatStyle; provenance: DamageProvenance; tick: number },
): PerfectEquilibriumStackResult {
  if (!perfectEquilibriumHitEligible(args)) {
    return { stacks: state.perfectEquilibriumStacks, triggered: false };
  }
  const next = state.perfectEquilibriumStacks + 1;
  const triggered = next >= perfectEquilibriumStackThreshold(state, args.tick);
  return {
    stacks: triggered ? 0 : Math.min(next, PERFECT_EQUILIBRIUM_STACK_CAP),
    triggered,
  };
}

export function balanceByForceTriggersPerfectEquilibrium(args: { stacks: number }): boolean {
  return args.stacks >= PERFECT_EQUILIBRIUM_PRECAST_TRIGGER_STACKS;
}

export interface BalanceByForcePrecastResult {
  stacks: number;
  perfectEquilibriumTriggered: boolean;
}

export function resolveBalanceByForcePrecast(args: {
  stacks: number;
  physicalBow: boolean;
}): BalanceByForcePrecastResult {
  if (
    !Number.isInteger(args.stacks) ||
    args.stacks < 0 ||
    args.stacks > PERFECT_EQUILIBRIUM_STACK_CAP
  ) {
    throw new RangeError(`invalid Perfect Equilibrium stacks: ${args.stacks}`);
  }
  const perfectEquilibriumTriggered = balanceByForceTriggersPerfectEquilibrium(args);
  return {
    stacks: perfectEquilibriumTriggered
      ? 0
      : args.physicalBow
        ? Math.min(args.stacks + 1, PERFECT_EQUILIBRIUM_STACK_CAP)
        : args.stacks,
    perfectEquilibriumTriggered,
  };
}

export interface PerfectEquilibriumSourceOutcome {
  damage: number;
  weight: number;
}

export interface PerfectEquilibriumWeightedDamage {
  damage: number;
  weight: number;
}

function normalizedSourceDistribution(
  distribution: readonly PerfectEquilibriumSourceOutcome[],
): readonly PerfectEquilibriumSourceOutcome[] {
  const grouped = new Map<number, number>();
  let totalWeight = 0;
  for (const outcome of distribution) {
    if (!Number.isSafeInteger(outcome.damage) || outcome.damage < 0) {
      throw new RangeError(
        `Perfect Equilibrium source damage must be an integer: ${outcome.damage}`,
      );
    }
    if (!Number.isFinite(outcome.weight) || outcome.weight < 0) {
      throw new RangeError(`invalid Perfect Equilibrium source weight: ${outcome.weight}`);
    }
    totalWeight += outcome.weight;
    if (outcome.weight > 0) {
      grouped.set(outcome.damage, (grouped.get(outcome.damage) ?? 0) + outcome.weight);
    }
  }
  if (
    grouped.size === 0 ||
    grouped.size > MAX_EXACT_BAND_POINTS ||
    !(totalWeight > 0) ||
    !Number.isFinite(totalWeight)
  ) {
    throw new RangeError("Perfect Equilibrium source distribution must be finite and bounded");
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([damage, weight]) => ({ damage, weight: weight / totalWeight }));
}

function pointCount(min: number, max: number, label: string): number {
  const count = max - min + 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_EXACT_BAND_POINTS) {
    throw new RangeError(`${label} exact band exceeds ${MAX_EXACT_BAND_POINTS} points`);
  }
  return count;
}

function addWeight(map: Map<number, number>, damage: number, weight: number): void {
  if (!Number.isSafeInteger(damage) || damage < 0) {
    throw new RangeError(`Perfect Equilibrium term must be a non-negative integer: ${damage}`);
  }
  if (!(weight > 0)) return;
  if (!Number.isFinite(weight))
    throw new RangeError("Perfect Equilibrium term weight is not finite");
  if (!map.has(damage) && map.size >= MAX_EXACT_BAND_POINTS) {
    throw new RangeError(
      `Perfect Equilibrium grouped distribution exceeds ${MAX_EXACT_BAND_POINTS} points`,
    );
  }
  map.set(damage, (map.get(damage) ?? 0) + weight);
}

function normalizeWeights(map: Map<number, number>): readonly PerfectEquilibriumWeightedDamage[] {
  let total = 0;
  for (const weight of map.values()) total += weight;
  if (!(total > 0) || !Number.isFinite(total)) {
    throw new RangeError("Perfect Equilibrium grouped distribution has no mass");
  }
  return [...map.entries()]
    .filter(([, weight]) => weight > 0)
    .sort(([a], [b]) => a - b)
    .map(([damage, weight]) => ({ damage, weight: weight / total }));
}

const PE_PRE_STAGES = new Set<ModifierStage>(["base", "ability", "onCast", "roll"]);
const PE_POST_STAGES = new Set<ModifierStage>(["critical", "onHit", "target", "postHit"]);

function modifierProgram(
  modifiers: readonly CombatModifier[],
  stages: ReadonlySet<ModifierStage>,
  context: CombatContext,
): readonly CombatModifier[] {
  return compileActiveModifiers(
    modifiers.filter((modifier) => stages.has(modifier.stage)),
    context,
  );
}

function applyPreModifiers(
  damage: number,
  program: readonly CombatModifier[],
  context: CombatContext,
): number {
  return runOrderedPipeline({ damage }, program, context, true).damage;
}

function groupedTermDistribution(
  rawBand: { min: number; max: number },
  preDplMultiplier: number,
  label: string,
  preProgram: readonly CombatModifier[],
  context: CombatContext,
): readonly PerfectEquilibriumWeightedDamage[] {
  const count = pointCount(rawBand.min, rawBand.max, label);
  const grouped = new Map<number, number>();
  for (let rawDamage = rawBand.min; rawDamage <= rawBand.max; rawDamage++) {
    const preDamage = applyPreModifiers(rawDamage, preProgram, context);
    addWeight(grouped, Math.floor(preDamage * preDplMultiplier), 1 / count);
  }
  return normalizeWeights(grouped);
}

function addDifferenceEvent(events: Map<number, number>, rawDamage: number, weight: number): void {
  if (!Number.isSafeInteger(rawDamage) || rawDamage < 0) {
    throw new RangeError(
      `Perfect Equilibrium raw term must be a non-negative integer: ${rawDamage}`,
    );
  }
  if (!Number.isFinite(weight)) {
    throw new RangeError("Perfect Equilibrium raw term weight is not finite");
  }
  events.set(rawDamage, (events.get(rawDamage) ?? 0) + weight);
}

function mixedTriggerTermDistribution(
  sources: readonly PerfectEquilibriumSourceOutcome[],
  preDplMultiplier: number,
  preProgram: readonly CombatModifier[],
  context: CombatContext,
): readonly PerfectEquilibriumWeightedDamage[] {
  const events = new Map<number, number>();
  let minRaw = Number.POSITIVE_INFINITY;
  let maxRaw = Number.NEGATIVE_INFINITY;

  for (const source of sources) {
    const triggerBand = bandOf(source.damage, PERFECT_EQUILIBRIUM_TRIGGER_DAMAGE_BAND);
    const triggerPointCount = pointCount(triggerBand.min, triggerBand.max, "trigger");
    const perRawWeight = source.weight / triggerPointCount;
    addDifferenceEvent(events, triggerBand.min, perRawWeight);
    const end = triggerBand.max + 1;
    if (!Number.isSafeInteger(end)) {
      throw new RangeError("Perfect Equilibrium trigger exact band exceeds safe integer range");
    }
    addDifferenceEvent(events, end, -perRawWeight);
    minRaw = Math.min(minRaw, triggerBand.min);
    maxRaw = Math.max(maxRaw, triggerBand.max);
  }

  pointCount(minRaw, maxRaw, "trigger");
  const grouped = new Map<number, number>();
  let activeWeight = 0;
  for (let rawDamage = minRaw; rawDamage <= maxRaw; rawDamage++) {
    activeWeight += events.get(rawDamage) ?? 0;
    if (activeWeight < -1e-12) {
      throw new RangeError("Perfect Equilibrium trigger interval weights became negative");
    }
    if (activeWeight > 0) {
      const preDamage = applyPreModifiers(rawDamage, preProgram, context);
      addWeight(grouped, Math.floor(preDamage * preDplMultiplier), activeWeight);
    }
  }
  return normalizeWeights(grouped);
}

function weightedExpected(distribution: readonly PerfectEquilibriumWeightedDamage[]): number {
  return distribution.reduce((total, outcome) => total + outcome.damage * outcome.weight, 0);
}

function stagedTerm(
  rawBand: { min: number; max: number },
  preDplMultiplier: number,
  preProgram: readonly CombatModifier[],
  context: CombatContext,
): { min: number; max: number; expected: number } {
  const distribution = groupedTermDistribution(
    rawBand,
    preDplMultiplier,
    "ability",
    preProgram,
    context,
  );
  return {
    min: distribution[0]!.damage,
    max: distribution[distribution.length - 1]!.damage,
    expected: weightedExpected(distribution),
  };
}

export interface PerfectEquilibriumDamageOutcome {
  precritDamage: number;
  weight: number;
  hit: HitResult;
}

export interface PerfectEquilibriumDamageResult {
  ability: { min: number; max: number; expected: number };
  triggeringAttack: { min: number; max: number; expected: number };
  abilityTerms: readonly PerfectEquilibriumWeightedDamage[];
  triggeringAttackTerms: readonly PerfectEquilibriumWeightedDamage[];
  combined: { min: number; max: number; expected: number };
  nonCritExpected: number;
  critExpected: number;
  expected: number;
  uncappedExpected: number;
  capLoss: number;
  critMin: number;
  critMax: number;
  critChance: number;
  critDamageBonus?: number;
  outcomes: readonly PerfectEquilibriumDamageOutcome[];
}

export function resolvePerfectEquilibriumDamage(args: {
  abilityDamage: number;
  sourcePrecritDistribution: readonly PerfectEquilibriumSourceOutcome[];
  preDplMultiplier?: number;
  postDplMultiplier?: number;
  level: number;
  accuracy: number;
  crit: CritLayers;
  critDamageDistribution?: DiscreteUniformCritDamageLayer;
  context?: CombatContext;
  modifiers?: CombatModifier[];
  preModifiers?: CombatModifier[];
  postModifiers?: CombatModifier[];
  cap?: HitCapRule;
  abilityDamageBand?: { minPct: number; maxPct: number };
}): PerfectEquilibriumDamageResult {
  if (!Number.isFinite(args.abilityDamage) || args.abilityDamage < 0) {
    throw new RangeError("abilityDamage must be finite and non-negative");
  }
  const preDplMultiplier = args.preDplMultiplier ?? 1;
  const postDplMultiplier = args.postDplMultiplier ?? 1;
  if (!Number.isFinite(preDplMultiplier) || preDplMultiplier < 0) {
    throw new RangeError("preDplMultiplier must be finite and non-negative");
  }
  if (!Number.isFinite(postDplMultiplier) || postDplMultiplier < 0) {
    throw new RangeError("postDplMultiplier must be finite and non-negative");
  }

  const sourceDistribution = normalizedSourceDistribution(args.sourcePrecritDistribution);
  const context = args.context ?? { style: "ranged" as const };
  const configuredModifiers = args.modifiers ?? [
    ...(args.preModifiers ?? []),
    ...(args.postModifiers ?? []),
  ];
  const preparedAbility = applyAbilityBaseModifiers(
    args.abilityDamage,
    configuredModifiers,
    context,
  );
  const preProgram = modifierProgram(preparedAbility.modifiers, PE_PRE_STAGES, context);
  const postProgram = modifierProgram(preparedAbility.modifiers, PE_POST_STAGES, context);
  const abilityBand = bandOf(
    preparedAbility.base,
    args.abilityDamageBand ?? PERFECT_EQUILIBRIUM_ABILITY_DAMAGE_BAND,
  );
  pointCount(abilityBand.min, abilityBand.max, "ability");
  const abilityTerms = groupedTermDistribution(
    abilityBand,
    preDplMultiplier,
    "ability",
    preProgram,
    context,
  );
  const triggeringAttackTerms = mixedTriggerTermDistribution(
    sourceDistribution,
    preDplMultiplier,
    preProgram,
    context,
  );
  const pairCount = abilityTerms.length * triggeringAttackTerms.length;
  if (!Number.isSafeInteger(pairCount) || pairCount > MAX_EXACT_TERM_CONVOLUTION_PAIRS) {
    throw new RangeError(
      `Perfect Equilibrium exact term convolution exceeds ${MAX_EXACT_TERM_CONVOLUTION_PAIRS} pairs`,
    );
  }

  const finalWeights = new Map<number, number>();
  for (const abilityTerm of abilityTerms) {
    for (const triggerTerm of triggeringAttackTerms) {
      const postDplDamage = Math.floor(
        (abilityTerm.damage + triggerTerm.damage) * postDplMultiplier,
      );
      addWeight(finalWeights, postDplDamage, abilityTerm.weight * triggerTerm.weight);
    }
  }
  const finalTerms = normalizeWeights(finalWeights);
  const outcomes = finalTerms.map(({ damage, weight }) => ({
    precritDamage: damage,
    weight,
    hit: calculateRawHitBand({
      min: damage,
      max: damage,
      level: args.level,
      accuracy: args.accuracy,
      crit: args.crit,
      critDamageDistribution: args.critDamageDistribution,
      context,
      provenance: { kind: "botlg_perfect_equilibrium" },
      modifiers: [...postProgram],
      cap: args.cap,
    }),
  }));
  const weighted = (select: (outcome: PerfectEquilibriumDamageOutcome) => number) =>
    outcomes.reduce((total, outcome) => total + select(outcome) * outcome.weight, 0);
  const range = (select: (outcome: PerfectEquilibriumDamageOutcome) => number) => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const outcome of outcomes) {
      const value = select(outcome);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    return { min, max };
  };
  const nonCritExpected = weighted((outcome) => outcome.hit.nonCritExpected);
  const critExpected = weighted((outcome) => outcome.hit.critExpected);
  const expected = weighted((outcome) => outcome.hit.expected);
  const triggeringAttackRange = {
    min: triggeringAttackTerms[0]!.damage,
    max: triggeringAttackTerms[triggeringAttackTerms.length - 1]!.damage,
  };
  const combinedRange = range((outcome) => outcome.hit.max);
  const critRange = range((outcome) => outcome.hit.critMin);
  const critMaxRange = range((outcome) => outcome.hit.critMax);
  return {
    ability: stagedTerm(abilityBand, preDplMultiplier, preProgram, context),
    triggeringAttack: {
      ...triggeringAttackRange,
      expected: weightedExpected(triggeringAttackTerms),
    },
    abilityTerms,
    triggeringAttackTerms,
    combined: {
      min: range((outcome) => outcome.hit.min).min,
      max: combinedRange.max,
      expected,
    },
    nonCritExpected,
    critExpected,
    expected,
    uncappedExpected: weighted((outcome) => outcome.hit.uncappedExpected),
    capLoss: weighted((outcome) => outcome.hit.capLoss),
    critMin: critRange.min,
    critMax: critMaxRange.max,
    critChance: outcomes[0]!.hit.critChance,
    ...(outcomes[0]!.hit.critDamageBonus !== undefined
      ? { critDamageBonus: outcomes[0]!.hit.critDamageBonus }
      : {}),
    outcomes,
  };
}
