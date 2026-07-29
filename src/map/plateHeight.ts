/**
 * Shared plate and marker height. Rest clearance exceeds ocean swell; framing
 * lifts one plate while all other shorelines remain fixed.
 */

import { isRegionUnlocked, type BuildState, type RegionId } from "@/league";

/** How far a resting cap clears the water. Must exceed the ocean's SWELL. */
export const REST_CLEARANCE = 0.009;
/** How far the framed region rises out of the sea. */
export const FOCUS_LIFT = 0.02;
/** A sealed region settles just below the waterline. */
export const LOCKED_DROP = 0.0015;
/** ExtrudeGeometry adds its bevel outside the requested depth. */
export const BEVEL = 0.0035;

/** Plate thickness, reduced for small islands to preserve relief-map proportions. */
export const PLATE_DEPTH: Record<RegionId, number> = {
  misthalin: 0.031,
  asgarnia: 0.031,
  kandarin: 0.032,
  fremennik: 0.026,
  forinthry: 0.029,
  morytania: 0.03,
  desert: 0.031,
  tirannwn: 0.028,
  karamja: 0.025,
  anachronia: 0.025,
  havenhythe: 0.025,
};

/** Base of the extrusion, so that the cap lands where the rules above say. */
export function plateBaseY(id: RegionId, unlocked: boolean, subject: boolean): number {
  return (
    REST_CLEARANCE -
    PLATE_DEPTH[id] -
    BEVEL +
    (unlocked ? 0 : -LOCKED_DROP) +
    (subject ? FOCUS_LIFT : 0)
  );
}

/** Cap surface of a region at rest, bevel included. */
export function plateTopY(
  build: BuildState,
  focus: { region: RegionId; framed: boolean },
  id: RegionId,
): number {
  const subject = focus.framed && focus.region === id;
  return plateBaseY(id, isRegionUnlocked(build, id), subject) + PLATE_DEPTH[id] + BEVEL;
}
