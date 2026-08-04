/**
 * Compact Primordial Ice mass (11 bins + shared expiry) for Leng lands.
 * Carry full stack distribution so Icy Tempest spend/bands never floor E[stacks].
 */
import { secondsToTicks } from "../../core/ticks";
import {
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  PRIMORDIAL_ICE_CAP,
} from "./effects";
import {
  type CompiledLengLandTable,
  FROSTBLADES_DURATION_TICKS,
} from "./lengRng";

/** Wiki: 2 minutes from gaining a stack (or until Icy Tempest consumes). */
export const PRIMORDIAL_ICE_DURATION_SECONDS = 120;
export const PRIMORDIAL_ICE_DURATION_TICKS = secondsToTicks(PRIMORDIAL_ICE_DURATION_SECONDS);
export const PRIMORDIAL_ICE_BINS = PRIMORDIAL_ICE_CAP + 1;

export interface PrimordialIceDistribution {
  /** Probability mass on stacks 0..PRIMORDIAL_ICE_CAP (length 11). */
  readonly stackMass: readonly number[];
  /** Exclusive end tick of the shared stack timer; 0 = empty / inactive. */
  readonly expiresAtTick: number;
}

const ZERO_MASS: readonly number[] = Object.freeze(
  Array.from({ length: PRIMORDIAL_ICE_BINS }, (_, i) => (i === 0 ? 1 : 0)),
);

export function emptyPrimordialIce(): PrimordialIceDistribution {
  return { stackMass: ZERO_MASS, expiresAtTick: 0 };
}

export function unitPrimordialIce(
  stacks: number,
  expiresAtTick = 0,
): PrimordialIceDistribution {
  const s = Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(stacks)));
  const mass = new Array<number>(PRIMORDIAL_ICE_BINS).fill(0);
  mass[s] = 1;
  return { stackMass: mass, expiresAtTick };
}

export function massSum(mass: readonly number[]): number {
  let s = 0;
  for (const w of mass) s += w;
  return s;
}

export function expectedStacksFromMass(mass: readonly number[]): number {
  let e = 0;
  for (let i = 0; i < mass.length; i++) e += i * (mass[i] ?? 0);
  return e;
}

/** Independent EF / BC product mass on +0 / +1 / +2 stack adds (from 0). */
export function lengProcChances(
  hasEF: boolean,
  hasBC: boolean,
): { p0: number; p1: number; p2: number } {
  const pEf = hasEF ? LENG_ENDLESS_FROST_CHANCE : 0;
  const pBc = hasBC ? LENG_BOUNDLESS_CHILL_CHANCE : 0;
  const p0 = (1 - pEf) * (1 - pBc);
  const p1 = pEf * (1 - pBc) + (1 - pEf) * pBc;
  const p2 = pEf * pBc;
  return { p0, p1, p2 };
}

/**
 * Zero stack mass when the shared timer has closed at `tick`.
 * `expiresAtTick <= tick` (and > 0) -> empty unit mass at 0.
 */
export function expirePrimordialIce(
  dist: PrimordialIceDistribution,
  tick: number,
): PrimordialIceDistribution {
  if (dist.expiresAtTick > 0 && dist.expiresAtTick <= tick) {
    return emptyPrimordialIce();
  }
  return dist;
}

/**
 * One Leng land on compact stack mass via compiled EF x BC table.
 * Refreshes shared expiry only when some start mass can actually gain stacks.
 */
export function applyLengLandToDistribution(
  dist: PrimordialIceDistribution,
  table: CompiledLengLandTable,
  tick: number,
): PrimordialIceDistribution {
  const live = expirePrimordialIce(dist, tick);
  const out = new Array<number>(PRIMORDIAL_ICE_BINS).fill(0);
  let canGain = false;
  for (let s = 0; s <= PRIMORDIAL_ICE_CAP; s++) {
    const w = live.stackMass[s] ?? 0;
    if (!(w > 0)) continue;
    const rows = table.byStartStacks[s]!;
    for (const row of rows) {
      out[row.stacks]! += w * row.weight;
      if (row.stacks > s) canGain = true;
    }
  }
  return {
    stackMass: out,
    expiresAtTick: canGain ? tick + PRIMORDIAL_ICE_DURATION_TICKS : live.expiresAtTick,
  };
}

/**
 * Compact Frostblades update on Leng land.
 * openMass = P(window active); until is the spine end tick (chill refreshes full duration).
 */
export function applyFrostbladesOnLand(
  frostbladesUntilTick: number,
  frostbladesOpenMass: number,
  table: CompiledLengLandTable,
  tick: number,
): { frostbladesUntilTick: number; frostbladesOpenMass: number } {
  const priorActive = frostbladesUntilTick > tick;
  const priorOpen = priorActive
    ? Math.min(1, Math.max(0, frostbladesOpenMass > 0 ? frostbladesOpenMass : 1))
    : 0;
  let pChill = 0;
  for (const arm of table.arms) {
    if (arm.opensFrostblades) pChill += arm.weight;
  }
  const nextOpen = priorOpen + (1 - priorOpen) * pChill;
  let nextUntil = 0;
  if (nextOpen > 0) {
    if (pChill > 0) nextUntil = tick + FROSTBLADES_DURATION_TICKS;
    else nextUntil = frostbladesUntilTick;
  }
  return {
    frostbladesUntilTick: nextUntil,
    frostbladesOpenMass: nextOpen > 0 ? nextOpen : 0,
  };
}
