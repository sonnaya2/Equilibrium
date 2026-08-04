import { PRIMORDIAL_ICE_CAP } from "./effects";
import {
  type CompiledLengLandTable,
  type LengLandOutcome,
  FROSTBLADES_DURATION_TICKS,
  materializeLengLandOutcomes,
  normalizeLengFrostUntil,
} from "./lengRng";

/**
 * Coarse Leng future class for mass / hybrid search:
 * stacks 0..PRIMORDIAL_ICE_CAP + frost active bit (expired frost ≡ inactive).
 * Absolute frostUntil is not tracked; chill opens or keeps active, miss keeps prior.
 */
export interface LengKey {
  stacks: number;
  frostActive: boolean;
}

/** Packed key: stacks * 2 + (frostActive ? 1 : 0). Range 0..(CAP*2+1). */
export type LengPackedKey = number;

/** Probability mass over packed Leng keys. */
export type LengMassMap = Map<LengPackedKey, number>;

export const LENG_STACK_COUNT = PRIMORDIAL_ICE_CAP + 1;
export const LENG_KEY_COUNT = LENG_STACK_COUNT * 2;

function clampStacks(stacks: number): number {
  return Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(stacks)));
}

export function packLengKey(stacks: number, frostActive: boolean): LengPackedKey {
  return clampStacks(stacks) * 2 + (frostActive ? 1 : 0);
}

export function unpackLengKey(key: LengPackedKey): LengKey {
  const k = Math.max(0, Math.min(LENG_KEY_COUNT - 1, Math.floor(key)));
  return { stacks: (k / 2) | 0, frostActive: (k & 1) === 1 };
}

/** Encode stacks + absolute frostUntil at `tick` into a coarse key. */
export function lengKeyFromFrostUntil(
  stacks: number,
  frostUntil: number,
  tick: number,
): LengPackedKey {
  return packLengKey(stacks, normalizeLengFrostUntil(frostUntil, tick) > 0);
}

export function unitLengMass(stacks: number, frostActive: boolean): LengMassMap {
  return new Map([[packLengKey(stacks, frostActive), 1]]);
}

export function cloneLengMass(mass: LengMassMap): LengMassMap {
  return new Map(mass);
}

export function massTotal(mass: LengMassMap): number {
  let s = 0;
  for (const w of mass.values()) s += w;
  return s;
}

function addMass(dest: LengMassMap, key: LengPackedKey, weight: number): void {
  if (weight <= 0) return;
  dest.set(key, (dest.get(key) ?? 0) + weight);
}

/**
 * Fold active frost to inactive (window expired between lands).
 * Exact merge on stacks; conserves mass.
 */
export function foldExpiredFrost(mass: LengMassMap): LengMassMap {
  const out: LengMassMap = new Map();
  for (const [key, w] of mass) {
    const { stacks } = unpackLengKey(key);
    addMass(out, packLengKey(stacks, false), w);
  }
  return out;
}

/**
 * One Leng land on a mass map via compiled EF×BC table.
 * frostActive' = frostActive || opensFrostblades; stacks from table rows.
 * Conserves total mass (up to float error).
 */
export function applyLengLandToMass(
  mass: LengMassMap,
  table: CompiledLengLandTable,
): LengMassMap {
  const out: LengMassMap = new Map();
  for (const [key, w] of mass) {
    if (w <= 0) continue;
    const { stacks, frostActive } = unpackLengKey(key);
    const rows = table.byStartStacks[stacks]!;
    for (const row of rows) {
      const nextFrost = frostActive || row.opensFrostblades;
      addMass(out, packLengKey(row.stacks, nextFrost), w * row.weight);
    }
  }
  return out;
}

/** Unit mass at start, one land. */
export function singleLandMass(
  stacks: number,
  frostActive: boolean,
  table: CompiledLengLandTable,
): LengMassMap {
  return applyLengLandToMass(unitLengMass(stacks, frostActive), table);
}

export interface EvolveLengMassOptions {
  /**
   * When true, fold frost inactive between successive lands
   * (models chill window expired before the next land).
   * Default false: frost carries across lands in the boolean model.
   */
  expireFrostBetweenLands?: boolean;
}

/**
 * Apply `lands` successive Leng lands. Start may be a key or an existing mass map.
 * Mass conserved; optional frost expiry between lands.
 */
export function evolveLengMass(
  start: LengKey | LengMassMap,
  table: CompiledLengLandTable,
  lands: number,
  opts: EvolveLengMassOptions = {},
): LengMassMap {
  const n = Math.max(0, Math.floor(lands));
  let mass: LengMassMap =
    start instanceof Map
      ? cloneLengMass(start)
      : unitLengMass(start.stacks, start.frostActive);
  for (let i = 0; i < n; i++) {
    if (i > 0 && opts.expireFrostBetweenLands) {
      mass = foldExpiredFrost(mass);
    }
    mass = applyLengLandToMass(mass, table);
  }
  return mass;
}

/** Collapse absolute frost outcomes into coarse (stacks, frostActive) mass. */
export function massFromOutcomes(
  outcomes: readonly LengLandOutcome[],
  tick: number,
): LengMassMap {
  const out: LengMassMap = new Map();
  for (const o of outcomes) {
    const key = lengKeyFromFrostUntil(o.stacks, o.frostUntil, tick);
    addMass(out, key, o.weight);
  }
  return out;
}

/**
 * Coarse mass after one land from absolute state, via materialize (parity oracle).
 */
export function materializeSingleLandMass(
  table: CompiledLengLandTable,
  stacks: number,
  frostUntil: number,
  tick: number,
): LengMassMap {
  return massFromOutcomes(
    materializeLengLandOutcomes(table, stacks, frostUntil, tick),
    tick,
  );
}

export function expectedStacks(mass: LengMassMap): number {
  let e = 0;
  for (const [key, w] of mass) {
    e += unpackLengKey(key).stacks * w;
  }
  return e;
}

export function frostActiveMass(mass: LengMassMap): number {
  let s = 0;
  for (const [key, w] of mass) {
    if (unpackLengKey(key).frostActive) s += w;
  }
  return s;
}

/**
 * Score-only search collapse: one land → E[stacks] + E[active frostUntil].
 *
 * Continuous stacks allowed (Icy Tempest floors at spend/bands). FrostUntil is the
 * weight-mixed absolute end tick (closed ≡ 0); not exact multi-arm physics.
 * Use only when expandLengOnLand skips forks for detailLevel score-only.
 *
 * Accepts fractional prior stacks so EV accumulates across lands without
 * floor(E) wiping mass each step.
 */
export function expectedLengLandState(
  table: CompiledLengLandTable,
  stacks: number,
  frostUntil: number,
  tick: number,
): { stacks: number; frostUntil: number } {
  const start = Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, stacks));
  const baseFrost = normalizeLengFrostUntil(frostUntil, tick);
  const frostOpen = tick + FROSTBLADES_DURATION_TICKS;
  let eS = 0;
  let eF = 0;
  let w = 0;
  for (const arm of table.arms) {
    const nextS = Math.min(PRIMORDIAL_ICE_CAP, start + arm.stackAdd);
    const nextF = arm.opensFrostblades ? frostOpen : baseFrost;
    eS += arm.weight * nextS;
    eF += arm.weight * normalizeLengFrostUntil(nextF, tick);
    w += arm.weight;
  }
  if (!(w > 0)) {
    return { stacks: start, frostUntil: baseFrost };
  }
  return {
    stacks: eS / w,
    frostUntil: eF / w,
  };
}

/**
 * E[stacks] / E[frost open] over discrete future-state outcomes (oracle parity).
 * Integer start stacks only — matches materialize + fold path.
 */
export function expectedLengFromOutcomes(
  outcomes: readonly LengLandOutcome[],
  tick: number,
): { stacks: number; frostUntil: number; pFrostOpen: number } {
  let w = 0;
  let eS = 0;
  let eF = 0;
  let pOpen = 0;
  for (const o of outcomes) {
    w += o.weight;
    eS += o.weight * o.stacks;
    const f = normalizeLengFrostUntil(o.frostUntil, tick);
    eF += o.weight * f;
    if (f > tick) pOpen += o.weight;
  }
  if (!(w > 0)) {
    return { stacks: 0, frostUntil: 0, pFrostOpen: 0 };
  }
  return {
    stacks: eS / w,
    frostUntil: eF / w,
    pFrostOpen: pOpen / w,
  };
}


/** Heaviest packed key (ties: lowest packed key wins for stability). */
export function heaviestLengKey(mass: LengMassMap): LengKey {
  let bestPacked = 0;
  let bestW = -1;
  for (const [packed, w] of mass) {
    if (w > bestW || (w === bestW && packed < bestPacked)) {
      bestW = w;
      bestPacked = packed;
    }
  }
  return unpackLengKey(bestPacked);
}

/**
 * Absolute frostUntil for a mode key at land tick.
 * Inactive -> 0. Active with live spine carries; else open a full frost window.
 */
export function spineFrostUntilFromMode(
  mode: LengKey,
  spineFrost: number,
  tick: number,
): number {
  if (!mode.frostActive) return 0;
  const carry = normalizeLengFrostUntil(spineFrost, tick);
  if (carry > tick) return carry;
  return tick + FROSTBLADES_DURATION_TICKS;
}

/** Icy Tempest spend: all stack mass collapses to 0; frost bit preserved. */
export function massAfterConsumeStacks(mass: LengMassMap): LengMassMap {
  const out: LengMassMap = new Map();
  for (const [key, w] of mass) {
    if (w <= 0) continue;
    const { frostActive } = unpackLengKey(key);
    addMass(out, packLengKey(0, frostActive), w);
  }
  return out;
}

/**
 * Weight-mix two mass maps (branch merge). Null mass treated as empty.
 * Result weights sum to 1 when both inputs were probability maps.
 */
export function mixLengMass(
  a: LengMassMap | null | undefined,
  b: LengMassMap | null | undefined,
  weightA: number,
  weightB: number,
): LengMassMap | null {
  if (!a && !b) return null;
  const wa = weightA > 0 ? weightA : 0;
  const wb = weightB > 0 ? weightB : 0;
  const total = wa + wb;
  if (!(total > 0)) return a ? cloneLengMass(a) : b ? cloneLengMass(b) : null;
  const out: LengMassMap = new Map();
  if (a) {
    for (const [k, w] of a) addMass(out, k, (w * wa) / total);
  }
  if (b) {
    for (const [k, w] of b) addMass(out, k, (w * wb) / total);
  }
  return out;
}
export function massEntries(
  mass: LengMassMap,
): Array<{ key: LengKey; packed: LengPackedKey; weight: number }> {
  const entries: Array<{ key: LengKey; packed: LengPackedKey; weight: number }> = [];
  for (const [packed, weight] of mass) {
    entries.push({ key: unpackLengKey(packed), packed, weight });
  }
  entries.sort((a, b) => a.packed - b.packed);
  return entries;
}

/** True when two mass maps agree within abs tol on every key (missing ≡ 0). */
export function massMapsClose(
  a: LengMassMap,
  b: LengMassMap,
  absTol = 1e-12,
): boolean {
  const keys = new Set<number>([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    const wa = a.get(k) ?? 0;
    const wb = b.get(k) ?? 0;
    if (Math.abs(wa - wb) > absTol) return false;
  }
  return true;
}
