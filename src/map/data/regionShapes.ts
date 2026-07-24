/**
 * Authored region shapes — our own coarse polygons following real Gielinor
 * geography (relative position, adjacency, island vs mainland are facts;
 * the geometry itself is simplified and original, not traced art).
 * Gameplay facts (unlock costs, content lists) stay in data/league/regions.json
 * and join by id.
 *
 * Coordinates: world plane, x east, z south, origin at map centre.
 */

import type { RegionId } from "@/league";

export type Biome =
  | "lowland"
  | "port"
  | "jungle"
  | "mountain"
  | "coast"
  | "snow"
  | "wastes"
  | "dunes"
  | "swamp"
  | "canopy"
  | "prehistoric";

export interface RegionShape {
  id: RegionId;
  name: string;
  biome: Biome;
  /** Footprint polygon on the world plane, wound either way. */
  polygon: [number, number][];
  /** Visual centre for the gem marker and label. */
  centroid: [number, number];
  /** Approximate size — noise falloff and gem scale. */
  radius: number;
  /** Camera position when this region is focused. */
  camera: [number, number, number];
  /** Terrain profile: base height and relief roughness, 0..1. */
  height: number;
  relief: number;
}

export const REGION_SHAPES: RegionShape[] = [
  {
    id: "misthalin", name: "Misthalin", biome: "lowland",
    polygon: [[-0.01, -0.06], [0.05, -0.09], [0.11, -0.07], [0.15, -0.02], [0.15, 0.06], [0.12, 0.13], [0.06, 0.17], [0.0, 0.15], [-0.03, 0.08]],
    centroid: [0.06, 0.04], radius: 0.09, camera: [0.06, 0.5, 0.42], height: 0.3, relief: 0.25,
  },
  {
    id: "havenhythe", name: "Havenhythe", biome: "port",
    polygon: [[0.59, 0.02], [0.65, -0.02], [0.73, -0.01], [0.77, 0.04], [0.76, 0.11], [0.7, 0.15], [0.63, 0.13], [0.59, 0.07]],
    centroid: [0.68, 0.06], radius: 0.08, camera: [0.68, 0.45, 0.42], height: 0.22, relief: 0.2,
  },
  {
    id: "karamja", name: "Karamja", biome: "jungle",
    polygon: [[-0.24, 0.09], [-0.18, 0.06], [-0.11, 0.08], [-0.08, 0.13], [-0.1, 0.19], [-0.16, 0.22], [-0.22, 0.2], [-0.25, 0.14]],
    centroid: [-0.17, 0.14], radius: 0.08, camera: [-0.17, 0.45, 0.5], height: 0.45, relief: 0.5,
  },
  {
    id: "asgarnia", name: "Asgarnia", biome: "mountain",
    polygon: [[-0.22, -0.07], [-0.16, -0.11], [-0.08, -0.11], [-0.02, -0.07], [-0.01, -0.01], [-0.03, 0.05], [-0.08, 0.09], [-0.15, 0.08], [-0.21, 0.04]],
    centroid: [-0.12, -0.01], radius: 0.09, camera: [-0.12, 0.5, 0.37], height: 0.6, relief: 0.7,
  },
  {
    id: "kandarin", name: "Kandarin", biome: "coast",
    polygon: [[-0.43, -0.03], [-0.36, -0.06], [-0.28, -0.05], [-0.24, 0.0], [-0.25, 0.08], [-0.28, 0.15], [-0.35, 0.19], [-0.41, 0.16], [-0.44, 0.08]],
    centroid: [-0.34, 0.06], radius: 0.09, camera: [-0.34, 0.5, 0.42], height: 0.35, relief: 0.4,
  },
  {
    id: "fremennik", name: "Fremennik Province", biome: "snow",
    polygon: [[-0.5, -0.28], [-0.46, -0.33], [-0.36, -0.34], [-0.28, -0.31], [-0.25, -0.26], [-0.28, -0.2], [-0.3, -0.15], [-0.38, -0.14], [-0.45, -0.17], [-0.51, -0.22]],
    centroid: [-0.38, -0.24], radius: 0.1, camera: [-0.38, 0.5, 0.12], height: 0.5, relief: 0.55,
  },
  {
    id: "forinthry", name: "Wilderness", biome: "wastes",
    polygon: [[-0.13, -0.3], [-0.05, -0.34], [0.08, -0.34], [0.16, -0.3], [0.18, -0.24], [0.15, -0.17], [0.1, -0.12], [0.0, -0.11], [-0.08, -0.13], [-0.14, -0.19], [-0.15, -0.25]],
    centroid: [0.02, -0.23], radius: 0.11, camera: [0.02, 0.5, 0.13], height: 0.35, relief: 0.6,
  },
  {
    id: "desert", name: "Kharidian Desert", biome: "dunes",
    polygon: [[0.01, 0.14], [0.08, 0.12], [0.16, 0.12], [0.21, 0.16], [0.22, 0.23], [0.17, 0.28], [0.09, 0.29], [0.02, 0.26], [-0.01, 0.19]],
    centroid: [0.11, 0.2], radius: 0.1, camera: [0.11, 0.5, 0.55], height: 0.25, relief: 0.35,
  },
  {
    id: "morytania", name: "Morytania", biome: "swamp",
    polygon: [[0.18, -0.02], [0.24, -0.05], [0.3, -0.03], [0.33, 0.02], [0.32, 0.09], [0.27, 0.13], [0.21, 0.12], [0.17, 0.06]],
    centroid: [0.25, 0.04], radius: 0.07, camera: [0.25, 0.45, 0.4], height: 0.2, relief: 0.3,
  },
  {
    id: "tirannwn", name: "Tirannwn", biome: "canopy",
    polygon: [[-0.62, 0.02], [-0.58, -0.03], [-0.49, -0.04], [-0.44, 0.0], [-0.45, 0.07], [-0.47, 0.13], [-0.52, 0.18], [-0.58, 0.17], [-0.62, 0.11]],
    centroid: [-0.53, 0.07], radius: 0.08, camera: [-0.53, 0.45, 0.43], height: 0.4, relief: 0.45,
  },
  {
    id: "anachronia", name: "Anachronia", biome: "prehistoric",
    polygon: [[0.4, -0.28], [0.45, -0.33], [0.54, -0.33], [0.6, -0.29], [0.61, -0.22], [0.58, -0.16], [0.51, -0.13], [0.44, -0.15], [0.4, -0.2]],
    centroid: [0.5, -0.23], radius: 0.09, camera: [0.5, 0.5, 0.13], height: 0.45, relief: 0.6,
  },
];

export const REGION_SHAPE_BY_ID = new Map(REGION_SHAPES.map((s) => [s.id, s]));

/** Default view: whole continent, tilted top-down like the in-game map. */
export const MAP_FRAME = {
  position: [0.07, 1.35, 1.05] as [number, number, number],
  target: [0.07, 0, 0.0] as [number, number, number],
};
