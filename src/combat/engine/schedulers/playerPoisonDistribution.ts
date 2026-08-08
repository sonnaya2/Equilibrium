import { PLAYER_POISON_ZERO_DAMAGE_DECAY_INDEX } from "../../poison/mechanics";
import type { TargetWeaponPoisonHitMultiplicity } from "../runtime/state";

export const DECAY_OVERFLOW = PLAYER_POISON_ZERO_DAMAGE_DECAY_INDEX;
const ZERO_DECAY_MASS = Array.from({ length: DECAY_OVERFLOW + 1 }, (_, index) =>
  index === 0 ? 1 : 0,
);
const SINGLE_COUNT_MASS = [0, 1];
const MAX_DISTRIBUTION_CACHE = 512;
const trailingDecayMassCache = new Map<string, number[]>();
const finiteCountMassCache = new Map<string, number[]>();
const geometricZeroDecayMassCache = new Map<number, number[]>();

function rememberDistributionCache<K, V>(cache: Map<K, V>, key: K, value: V): void {
  cache.set(key, value);
  if (cache.size <= MAX_DISTRIBUTION_CACHE) return;
  const oldest = cache.keys().next().value;
  if (oldest !== undefined) cache.delete(oldest);
}

export function normalizedDecayMass(mass: readonly number[]): number[] {
  if (mass.length === DECAY_OVERFLOW + 1) return mass as number[];
  const normalized = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  for (let index = 0; index < mass.length; index++) {
    normalized[Math.min(index, DECAY_OVERFLOW)]! += mass[index] ?? 0;
  }
  return normalized;
}

export function pointDecayMass(index = 0): number[] {
  if (index === 0) return ZERO_DECAY_MASS;
  const mass = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  mass[Math.min(Math.max(0, Math.floor(index)), DECAY_OVERFLOW)] = 1;
  return mass;
}

export function decayMean(mass: readonly number[]): number {
  return mass.reduce((sum, probability, index) => sum + probability * index, 0);
}

export function mixDecayMass(
  left: readonly number[],
  right: readonly number[],
  leftWeight: number,
  rightWeight: number,
): number[] {
  const total = leftWeight + rightWeight;
  const a = normalizedDecayMass(left);
  const b = normalizedDecayMass(right);
  return a.map((value, index) => (leftWeight * value + rightWeight * b[index]!) / total);
}

export function shiftDecayMass(mass: readonly number[], steps: number): number[] {
  const source = normalizedDecayMass(mass);
  const shifted = new Array<number>(DECAY_OVERFLOW + 1).fill(0);
  const overflowStart = Math.max(0, DECAY_OVERFLOW - steps);
  for (let index = 0; index < overflowStart; index++) {
    shifted[index + steps] = source[index]!;
  }
  for (let index = overflowStart; index <= DECAY_OVERFLOW; index++) {
    shifted[DECAY_OVERFLOW]! += source[index]!;
  }
  return shifted;
}

export function geometricZeroDecayMass(continuation: number): number[] {
  const cached = geometricZeroDecayMassCache.get(continuation);
  if (cached) return cached;
  const mass = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  for (let index = 0; index < DECAY_OVERFLOW; index++) {
    mass[index] = (1 - continuation) * continuation ** index;
  }
  mass[DECAY_OVERFLOW] = continuation ** DECAY_OVERFLOW;
  rememberDistributionCache(geometricZeroDecayMassCache, continuation, mass);
  return mass;
}

export function geometricShiftDecayMass(
  initial: readonly number[],
  continuation: number,
): number[] {
  const shifted = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  const source = normalizedDecayMass(initial);
  for (let start = 0; start <= DECAY_OVERFLOW; start++) {
    const sourceMass = source[start]!;
    if (!(sourceMass > 0)) continue;
    const room = DECAY_OVERFLOW - start;
    for (let steps = 1; steps < room; steps++) {
      shifted[start + steps]! += sourceMass * (1 - continuation) * continuation ** (steps - 1);
    }
    shifted[DECAY_OVERFLOW]! += sourceMass * continuation ** Math.max(0, room - 1);
  }
  return shifted;
}

export function choose(n: number, k: number): number {
  const count = Math.min(k, n - k);
  let value = 1;
  for (let index = 1; index <= count; index++) {
    value = (value * (n - count + index)) / index;
  }
  return value;
}

export function trailingDecayMass(hitCount: number, successes: number): number[] {
  const key = `${hitCount}:${successes}`;
  const cached = trailingDecayMassCache.get(key);
  if (cached) return cached;
  const mass = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  const denominator = choose(hitCount, successes);
  for (let trailing = 0; trailing <= hitCount - successes; trailing++) {
    mass[Math.min(trailing, DECAY_OVERFLOW)]! +=
      choose(hitCount - trailing - 1, successes - 1) / denominator;
  }
  rememberDistributionCache(trailingDecayMassCache, key, mass);
  return mass;
}

export function finiteCountMass(
  multiplicity: TargetWeaponPoisonHitMultiplicity,
): number[] | undefined {
  if (multiplicity.kind === "positive-geometric") return undefined;
  if (multiplicity.kind === "single") return SINGLE_COUNT_MASS;
  const { trials, probability } = multiplicity;
  const key = `${trials}:${probability}`;
  const cached = finiteCountMassCache.get(key);
  if (cached) return cached;
  const positive = 1 - (1 - probability) ** trials;
  const mass = Array.from({ length: trials + 1 }, () => 0);
  for (let count = 1; count <= trials; count++) {
    mass[count] =
      (choose(trials, count) * probability ** count * (1 - probability) ** (trials - count)) /
      positive;
  }
  rememberDistributionCache(finiteCountMassCache, key, mass);
  return mass;
}

export function failedDecayMass(
  initial: readonly number[],
  multiplicity: TargetWeaponPoisonHitMultiplicity,
): number[] {
  const finite = finiteCountMass(multiplicity);
  if (!finite) {
    if (multiplicity.kind !== "positive-geometric") {
      throw new Error("unsupported poison hit multiplicity");
    }
    return geometricShiftDecayMass(initial, multiplicity.continuationProbability);
  }
  let combined = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  for (let count = 1; count < finite.length; count++) {
    const probability = finite[count]!;
    if (!(probability > 0)) continue;
    const shifted = shiftDecayMass(initial, count);
    combined = combined.map((value, index) => value + probability * shifted[index]!);
  }
  return combined;
}
