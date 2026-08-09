import {
  envenomedPoisonImmunityDisableTicks,
  hasBlessing,
  type ResolvedLeagueRules,
} from "../../league/ruleset";
import { resolvePoisonApplication, type PlayerPoisonProfile } from "../../poison/mechanics";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import { deathdealerApplicationChance } from "../../shared/equipment";

export const DEFAULT_STOCHASTIC_LANES = 128;
export const DEFAULT_STOCHASTIC_SEED = 0x6d2b79f5;

interface StatefulRngInput {
  readonly adrenaline?: {
    readonly impatientRank?: number;
    readonly relentlessRank?: number;
  };
  readonly league?: ResolvedLeagueRules;
  readonly playerPoison?: PlayerPoisonProfile;
  readonly targetPoisonImmune?: boolean;
  readonly equipmentEffects?: ActiveEquipmentEffects;
}

const STATEFUL_RNG_ABILITIES = new Set([
  "icy_tempest",
  "spectral_scythe",
  "spectral_scythe_2",
  "tsunami",
]);

export function needsStochasticLanes(
  input: StatefulRngInput,
  activeAbilityIds: Iterable<string>,
): boolean {
  if ((input.adrenaline?.impatientRank ?? 0) > 0) return true;
  if ((input.adrenaline?.relentlessRank ?? 0) > 0) return true;
  if (hasBlessing(input.league, "avernic-rampage")) return true;
  if (hasBlessing(input.league, "unholy-critual")) return true;
  if (hasBlessing(input.league, "abyssal-cinders")) return true;
  if (
    input.playerPoison !== undefined &&
    resolvePoisonApplication(input.playerPoison, 0) !== null &&
    (input.targetPoisonImmune !== true || envenomedPoisonImmunityDisableTicks(input.league) > 0)
  ) {
    return true;
  }
  if (deathdealerApplicationChance(input.equipmentEffects) > 0) return true;
  for (const abilityId of activeAbilityIds) {
    if (STATEFUL_RNG_ABILITIES.has(abilityId)) return true;
  }
  return false;
}

export function stochasticLaneCount(
  input: StatefulRngInput,
  activeAbilityIds: Iterable<string>,
  requested?: number,
): number {
  const lanes =
    requested ?? (needsStochasticLanes(input, activeAbilityIds) ? DEFAULT_STOCHASTIC_LANES : 1);
  if (!Number.isInteger(lanes) || lanes < 1) {
    throw new RangeError(`stochasticLanes must be a positive integer: ${lanes}`);
  }
  return lanes;
}

export interface StochasticOracleConfig {
  readonly laneIndex: number;
  readonly laneCount: number;
  readonly seed?: number;
}

export interface StochasticOracle {
  readonly laneIndex: number;
  readonly laneCount: number;
  readonly seed: number;
  uniform(stream: string): number;
  bernoulli(stream: string, probability: number): boolean;
  weightedIndex(stream: string, weights: readonly number[]): number;
  binomial(stream: string, trials: number, probability: number): number;
  geometricSuccesses(stream: string, continuationProbability: number): number;
  clone(): StochasticOracle;
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function hashString(value: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return mix32(hash);
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function coprimeStride(hash: number, laneCount: number): number {
  if (laneCount <= 1) return 1;
  let stride = hash % laneCount || 1;
  while (gcd(stride, laneCount) !== 1) {
    stride = (stride + 1) % laneCount || 1;
  }
  return stride;
}

function unitProbability(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} outside 0-1: ${value}`);
  }
  return value;
}

class CounterBasedStochasticOracle implements StochasticOracle {
  readonly laneIndex: number;
  readonly laneCount: number;
  readonly seed: number;
  private readonly counters: Map<string, number>;

  constructor(config: StochasticOracleConfig, counters?: ReadonlyMap<string, number>) {
    if (!Number.isInteger(config.laneCount) || config.laneCount < 1) {
      throw new RangeError(`laneCount must be a positive integer: ${config.laneCount}`);
    }
    if (
      !Number.isInteger(config.laneIndex) ||
      config.laneIndex < 0 ||
      config.laneIndex >= config.laneCount
    ) {
      throw new RangeError(`laneIndex outside 0-${config.laneCount - 1}: ${config.laneIndex}`);
    }
    this.laneIndex = config.laneIndex;
    this.laneCount = config.laneCount;
    this.seed = (config.seed ?? DEFAULT_STOCHASTIC_SEED) >>> 0;
    this.counters = new Map(counters);
  }

  uniform(stream: string): number {
    const ordinal = this.counters.get(stream) ?? 0;
    this.counters.set(stream, ordinal + 1);
    const key = `${stream}\x1f${ordinal}`;
    const offset = hashString(`${key}\x1foffset`, this.seed) % this.laneCount;
    const stride = coprimeStride(hashString(`${key}\x1fstride`, this.seed), this.laneCount);
    const stratum = (offset + this.laneIndex * stride) % this.laneCount;
    return (stratum + 0.5) / this.laneCount;
  }

  bernoulli(stream: string, probability: number): boolean {
    const p = unitProbability(probability, "probability");
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.uniform(stream) < p;
  }

  weightedIndex(stream: string, weights: readonly number[]): number {
    if (weights.length === 0) throw new RangeError("weightedIndex requires at least one weight");
    let total = 0;
    for (const weight of weights) {
      if (!Number.isFinite(weight) || weight < 0) {
        throw new RangeError(`invalid weight: ${weight}`);
      }
      total += weight;
    }
    if (!(total > 0)) throw new RangeError("weightedIndex requires positive total weight");
    const target = this.uniform(stream) * total;
    let cumulative = 0;
    for (let index = 0; index < weights.length; index++) {
      cumulative += weights[index]!;
      if (target < cumulative) return index;
    }
    return weights.length - 1;
  }

  binomial(stream: string, trials: number, probability: number): number {
    if (!Number.isInteger(trials) || trials < 0) {
      throw new RangeError(`trials must be a non-negative integer: ${trials}`);
    }
    const p = unitProbability(probability, "probability");
    if (trials === 0 || p <= 0) return 0;
    if (p >= 1) return trials;
    const target = this.uniform(stream);
    const failure = 1 - p;
    let probabilityMass = failure ** trials;
    let cumulative = probabilityMass;
    if (target < cumulative) return 0;
    for (let successes = 1; successes <= trials; successes++) {
      probabilityMass *= ((trials - successes + 1) / successes) * (p / failure);
      cumulative += probabilityMass;
      if (target < cumulative || successes === trials) return successes;
    }
    return trials;
  }

  geometricSuccesses(stream: string, continuationProbability: number): number {
    const p = unitProbability(continuationProbability, "continuationProbability");
    if (p <= 0) return 0;
    if (p >= 1) throw new RangeError("continuationProbability must be less than 1");
    const u = this.uniform(stream);
    return Math.floor(Math.log1p(-u) / Math.log(p));
  }

  clone(): StochasticOracle {
    return new CounterBasedStochasticOracle(
      { laneIndex: this.laneIndex, laneCount: this.laneCount, seed: this.seed },
      this.counters,
    );
  }
}

export function createStochasticOracle(config: StochasticOracleConfig): StochasticOracle {
  return new CounterBasedStochasticOracle(config);
}
