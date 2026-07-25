/**
 * Region anchors for the war-table board. The official Regions-tab screenshot
 * that used to back these lives out of the served bundle at
 * assets/leagues/equilibrium/official/regions-tab.jpg; the board itself is now
 * original geometry (src/map/data/regionShapes.ts) in the same coordinate
 * frame.
 *
 * The anchors are our own measured overlay data: normalized coordinates
 * (0..1, x east, y south) for each region's marker. Gameplay facts (unlock
 * costs, content lists) stay in data/league/regions.json and join by id.
 */

import type { RegionId } from "@/league";

export const MAP_IMAGE = {
  width: 865,
  height: 404,
  // The plate is gone: the board is original geometry whose layout follows
  // Jagex's map, and the credit says exactly that.
  credit: "Region layout follows Jagex's Leagues II: Equilibrium map.",
} as const;

/** World plane the map texture lies on: x east, z south, origin at centre. */
export const MAP_WORLD = {
  width: 2,
  height: (2 * MAP_IMAGE.height) / MAP_IMAGE.width,
} as const;

export interface RegionAnchor {
  id: RegionId;
  name: string;
  /** Normalized position on the map texture, 0..1. */
  uv: [number, number];
  /** Relative landmass size — scales the marker. */
  size: number;
}

export const REGION_ANCHORS: RegionAnchor[] = [
  { id: "misthalin", name: "Misthalin", uv: [0.516, 0.51], size: 0.85 },
  { id: "havenhythe", name: "Havenhythe", uv: [0.872, 0.631], size: 0.9 },
  { id: "karamja", name: "Karamja", uv: [0.408, 0.735], size: 0.8 },
  { id: "asgarnia", name: "Asgarnia", uv: [0.437, 0.465], size: 0.85 },
  { id: "kandarin", name: "Kandarin", uv: [0.311, 0.54], size: 0.95 },
  { id: "fremennik", name: "Fremennik Province", uv: [0.295, 0.218], size: 0.95 },
  { id: "forinthry", name: "Wilderness", uv: [0.511, 0.218], size: 1.1 },
  { id: "desert", name: "Kharidian Desert", uv: [0.553, 0.809], size: 1 },
  { id: "morytania", name: "Morytania", uv: [0.638, 0.488], size: 0.8 },
  { id: "tirannwn", name: "Tirannwn", uv: [0.217, 0.562], size: 0.85 },
  { id: "anachronia", name: "Anachronia", uv: [0.78, 0.218], size: 1 },
];

export const REGION_ANCHOR_BY_ID = new Map(REGION_ANCHORS.map((a) => [a.id, a]));

/** Texture uv → world position on the map plane (x, z). */
export function anchorWorld(uv: [number, number]): [number, number] {
  return [(uv[0] - 0.5) * MAP_WORLD.width, (uv[1] - 0.5) * MAP_WORLD.height];
}

/** Default view: the whole map, tilted like a war table. */
export const MAP_FRAME = {
  position: [0, 1.05, 0.85] as [number, number, number],
  target: [0, 0, 0.05] as [number, number, number],
};
