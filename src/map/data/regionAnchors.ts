import type { RegionId } from "@/league";

/**
 * The Wiki's RuneScape Surface (map id 28), cropped to Gielinor plus the two
 * League islands. Coordinates are the same x-east/y-north game-map space used
 * by Kartographer tiles and every overlay below.
 */
export const MAP_BOUNDS = {
  minX: 1792,
  minY: 2560,
  maxX: 4864,
  maxY: 4608,
} as const;

export const MAP_IMAGE = {
  width: MAP_BOUNDS.maxX - MAP_BOUNDS.minX,
  height: MAP_BOUNDS.maxY - MAP_BOUNDS.minY,
  src: "/map/world-surface-wiki.webp",
  fallbackSrc: "/map/world-surface-wiki.webp",
  credit:
    "RuneScape map cache © Jagex Ltd. · tiles via the RuneScape Wiki (CC BY-NC-SA 3.0).",
} as const;

export const MAP_WORLD = {
  width: 2,
  height: (2 * MAP_IMAGE.height) / MAP_IMAGE.width,
} as const;

export type MapXY = readonly [number, number];

export interface RegionAnchor {
  id: RegionId;
  name: string;
  /** RuneScape Surface map coordinate, after the Wiki's island transforms. */
  map: MapXY;
  uv: readonly [number, number];
  size: number;
}

export function mapToUv([x, y]: MapXY): readonly [number, number] {
  return [
    (x - MAP_BOUNDS.minX) / MAP_IMAGE.width,
    (MAP_BOUNDS.maxY - y) / MAP_IMAGE.height,
  ];
}

export function uvToMap([u, v]: readonly [number, number]): MapXY {
  return [
    MAP_BOUNDS.minX + u * MAP_IMAGE.width,
    MAP_BOUNDS.maxY - v * MAP_IMAGE.height,
  ];
}

const region = (
  id: RegionId,
  name: string,
  map: MapXY,
  size: number,
): RegionAnchor => ({ id, name, map, uv: mapToUv(map), size });

export const REGION_ANCHORS: readonly RegionAnchor[] = [
  region("misthalin", "Misthalin", [3220, 3350], 0.95),
  region("havenhythe", "Havenhythe", [4270, 3340], 1),
  region("karamja", "Karamja", [2850, 3000], 0.9),
  region("asgarnia", "Asgarnia", [2960, 3440], 0.95),
  region("kandarin", "Kandarin", [2600, 3370], 1),
  region("fremennik", "Fremennik Province", [2600, 3750], 0.9),
  region("forinthry", "Wilderness", [3200, 3820], 1.05),
  region("desert", "Kharidian Desert", [3300, 2880], 1),
  region("morytania", "Morytania", [3600, 3420], 0.9),
  region("tirannwn", "Tirannwn", [2250, 3250], 0.9),
  region("anachronia", "Anachronia", [3900, 4270], 1.05),
];

export const REGION_ANCHOR_BY_ID = new Map(REGION_ANCHORS.map((anchor) => [anchor.id, anchor]));

export function anchorWorld(position: readonly [number, number]): [number, number] {
  return [
    (position[0] - 0.5) * MAP_WORLD.width,
    (position[1] - 0.5) * MAP_WORLD.height,
  ];
}
