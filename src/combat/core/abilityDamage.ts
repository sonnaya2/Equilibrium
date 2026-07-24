import { percentFloor } from "./rounding";

/**
 * Ability damage as percent-of-base bands. The engine consumes bands; the base ability
 * damage itself (weapon + level composition) is supplied by the caller, because the
 * weapon-side formula is not yet in the verified corpus and is never invented.
 */
export interface DamageBand {
  minPct: number;
  maxPct: number;
}

export interface BandResult {
  min: number;
  max: number;
  /** Uniform-band mean, pending RS Analysis fixture validation of the in-band shape. */
  expected: number;
}

export function bandOf(base: number, band: DamageBand): BandResult {
  if (base < 0 || !Number.isFinite(base)) throw new RangeError(`bandOf: bad base ${base}`);
  if (band.minPct > band.maxPct) throw new RangeError(`bandOf: inverted band ${band.minPct}-${band.maxPct}`);
  const min = percentFloor(base, band.minPct);
  const max = percentFloor(base, band.maxPct);
  return { min, max, expected: (min + max) / 2 };
}
