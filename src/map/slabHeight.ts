/**
 * Where a slab's top surface sits, in world y.
 *
 * Shared because two things now need the same answer: the slab itself, and the
 * vines growing along its borders. A seam ribbon that used its own copy of
 * these numbers would drift off the cap the moment either constant changed.
 */

import { isRegionUnlocked, type RegionId } from "@/league";
import type { BuildState } from "@/league";

export const RAISED_Y = 0.02;
export const SUNKEN_Y = -0.024;
/** How much further the subject rises, and how far every other slab drops. */
/** Daylit plinth: subject rises enough to read as framed without leaving the board. */
export const FOCUS_LIFT = 0.058;
export const UNFOCUSED_DROP = 0.012;
/**
 * ExtrudeGeometry adds its bevel *outside* the requested depth, so a cap's real
 * top is `depth + bevelThickness`. Anything laid on a cap has to clear it.
 */
export const BEVEL = 0.004;

/** Resting y of a slab's base, before its own depth. */
export function slabBaseY(unlocked: boolean, subject: boolean, sidelined: boolean): number {
  return (
    (unlocked ? RAISED_Y : SUNKEN_Y) + (subject ? FOCUS_LIFT : sidelined ? -UNFOCUSED_DROP : 0)
  );
}

/** Resting y of a region's cap surface, bevel included. */
export function slabTopY(
  build: BuildState,
  focus: { region: RegionId; framed: boolean },
  id: RegionId,
  depth: number,
): number {
  const subject = focus.framed && focus.region === id;
  const sidelined = focus.framed && focus.region !== id;
  return slabBaseY(isRegionUnlocked(build, id), subject, sidelined) + depth + BEVEL;
}
