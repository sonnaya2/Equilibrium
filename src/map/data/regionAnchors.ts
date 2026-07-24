/**
 * Region anchors on the official Leagues II: Equilibrium region map
 * (public/map/league-map.jpg — cropped from the in-game Regions tab shown in
 * Jagex's "Countdown to Leagues II: Equilibrium" news post).
 *
 * The anchors are our own measured overlay data: normalized texture
 * coordinates (0..1, x east, y south) placed on each region's map icon.
 * Gameplay facts (unlock costs, content lists) stay in data/league/regions.json
 * and join by id.
 */

import type { RegionId } from "@/league";

export const MAP_IMAGE = {
  src: "/map/league-map.jpg",
  width: 865,
  height: 404,
  credit: "Map image: Jagex, from the Leagues II: Equilibrium reveal post.",
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
