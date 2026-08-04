import { secondsToTicks } from "../../core/ticks";
import {
  FROSTBLADES_DURATION_SECONDS,
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  PRIMORDIAL_ICE_CAP,
} from "./effects";

/** One probability-weighted Leng land outcome (Primordial Ice + Frostblades). */
export interface LengLandOutcome {
  weight: number;
  stacks: number;
  frostUntil: number;
}

/**
 * Enumerate independent Endless Frost (0.1) and Boundless Chill (0.02) arms.
 * Both can fire on the same hit; stacks cap at PRIMORDIAL_ICE_CAP; Chill opens
 * Frostblades for FROSTBLADES_DURATION_SECONDS from `tick`. Identical states merge.
 */
export function lengLandOutcomes(
  hasEF: boolean,
  hasBC: boolean,
  stacks: number,
  frostUntil: number,
  tick: number,
): LengLandOutcome[] {
  const baseStacks = Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(stacks)));
  const frostOpen = tick + secondsToTicks(FROSTBLADES_DURATION_SECONDS);

  const efArms = hasEF
    ? [
        { p: LENG_ENDLESS_FROST_CHANCE, add: 1 },
        { p: 1 - LENG_ENDLESS_FROST_CHANCE, add: 0 },
      ]
    : [{ p: 1, add: 0 }];
  const bcArms = hasBC
    ? [
        { p: LENG_BOUNDLESS_CHILL_CHANCE, add: 1, frost: true },
        { p: 1 - LENG_BOUNDLESS_CHILL_CHANCE, add: 0, frost: false },
      ]
    : [{ p: 1, add: 0, frost: false }];

  const merged = new Map<string, LengLandOutcome>();
  for (const ef of efArms) {
    for (const bc of bcArms) {
      const weight = ef.p * bc.p;
      if (weight <= 0) continue;
      const nextStacks = Math.min(PRIMORDIAL_ICE_CAP, baseStacks + ef.add + bc.add);
      const nextFrost = bc.frost ? frostOpen : frostUntil;
      const key = `${nextStacks}|${nextFrost}`;
      const existing = merged.get(key);
      if (existing) existing.weight += weight;
      else merged.set(key, { weight, stacks: nextStacks, frostUntil: nextFrost });
    }
  }
  return [...merged.values()];
}
