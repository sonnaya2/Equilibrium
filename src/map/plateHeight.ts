/**
 * Where a plate sits, in world y. Shared because three things need the same
 * answer — the plate, the vines sealing its borders, and the markers standing
 * on it — and a copy that drifted would float any one of them off the surface.
 *
 * Sea level is y = 0, and at rest every coast meets it. A plate's cap clears the
 * water by `REST_CLEARANCE`, which is a couple of screen pixels at the overview:
 * enough that no wave washes over Gielinor, not enough to read as anything but
 * flush. That is the point — at rest this has to be the RuneScape world map,
 * with the sea where the sea is.
 *
 * The thickness is real the whole time; it is just underwater. Framing a region
 * lifts it out, and the cut earth under it is what makes the board physical.
 * Nothing else moves in y — a sidelined region recedes through its material, not
 * by sinking, or the shoreline would come unstuck from the map everywhere at
 * once.
 */

import { isRegionUnlocked, type BuildState, type RegionId } from "@/league";

/** How far a resting cap clears the water. Must exceed the ocean's SWELL. */
export const REST_CLEARANCE = 0.004;
/** How far the framed region rises out of the sea. */
export const FOCUS_LIFT = 0.02;
/** A sealed region settles just into the waterline. Barely, on purpose. */
export const LOCKED_DROP = 0.0015;
/** ExtrudeGeometry adds its bevel outside the requested depth. */
export const BEVEL = 0.0035;

/**
 * Plate thickness — what you see when a region lifts. Islands are thinner than
 * the continent for the same reason a relief map's islands are: a thick slab
 * under a small silhouette reads as a chess piece.
 */
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
