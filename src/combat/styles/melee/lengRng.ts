import { secondsToTicks } from "../../core/ticks";
import {
  FROSTBLADES_DURATION_SECONDS,
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
} from "./effects";

export interface LengLandArm {
  readonly weight: number;
  readonly stackAdd: number;
  readonly opensFrostblades: boolean;
}

export interface CompiledLengLandTable {
  readonly hasEndlessFrost: boolean;
  readonly hasBoundlessChill: boolean;
  readonly arms: readonly LengLandArm[];
}

export const FROSTBLADES_DURATION_TICKS = secondsToTicks(FROSTBLADES_DURATION_SECONDS);

export function compileLengLandArms(hasEF: boolean, hasBC: boolean): readonly LengLandArm[] {
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

  const arms: LengLandArm[] = [];
  for (const ef of efArms) {
    for (const bc of bcArms) {
      const weight = ef.p * bc.p;
      if (weight <= 0) continue;
      arms.push({
        weight,
        stackAdd: ef.add + bc.add,
        opensFrostblades: bc.frost,
      });
    }
  }
  return arms;
}

const TABLE_CACHE: (CompiledLengLandTable | null | undefined)[] = [
  undefined,
  undefined,
  undefined,
  undefined,
];

export function compileLengLandTable(
  hasEF: boolean,
  hasBC: boolean,
): CompiledLengLandTable | null {
  if (!hasEF && !hasBC) return null;
  return {
    hasEndlessFrost: hasEF,
    hasBoundlessChill: hasBC,
    arms: compileLengLandArms(hasEF, hasBC),
  };
}

export function lengLandTableFor(
  hasEF: boolean,
  hasBC: boolean,
): CompiledLengLandTable | null {
  const i = (hasEF ? 2 : 0) + (hasBC ? 1 : 0);
  if (i === 0) return null;
  const hit = TABLE_CACHE[i];
  if (hit !== undefined) return hit;
  const compiled = compileLengLandTable(hasEF, hasBC);
  TABLE_CACHE[i] = compiled;
  return compiled;
}
