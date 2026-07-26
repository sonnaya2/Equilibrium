/**
 * Region anchors on the *real* RuneScape world map.
 *
 * Deliberately a separate table from src/map/data/regionAnchors.ts. That one is
 * authored in the war table's own stylised uv frame, which is a hand-arranged
 * board rather than a georeferenced trace — its coordinates mean nothing on a
 * photograph of Gielinor, and reusing them here would put every label in the
 * wrong sea.
 *
 * These are normalised (0..1) positions on RuneScape_Worldmap.png, placed
 * against the region names the map itself prints. Points, not polygons: an
 * outline traced by eye at this scale would be a guess dressed up as data, and
 * the label is the part that carries the information anyway.
 */

import type { RegionId } from "@/league";

export interface AtlasRegion {
  id: RegionId;
  name: string;
  /** Normalised position on the world map image, x east, y south. */
  uv: readonly [number, number];
}

export const ATLAS_REGIONS: readonly AtlasRegion[] = [
  { id: "fremennik", name: "Fremennik Province", uv: [0.318, 0.459] },
  { id: "forinthry", name: "Wilderness", uv: [0.486, 0.394] },
  { id: "kandarin", name: "Kandarin", uv: [0.276, 0.549] },
  { id: "asgarnia", name: "Asgarnia", uv: [0.427, 0.554] },
  { id: "misthalin", name: "Misthalin", uv: [0.516, 0.606] },
  { id: "morytania", name: "Morytania", uv: [0.615, 0.548] },
  { id: "tirannwn", name: "Tirannwn", uv: [0.151, 0.654] },
  { id: "karamja", name: "Karamja", uv: [0.38, 0.731] },
  { id: "desert", name: "Kharidian Desert", uv: [0.531, 0.761] },
  { id: "anachronia", name: "Anachronia", uv: [0.833, 0.114] },
  { id: "havenhythe", name: "Havenhythe", uv: [0.932, 0.612] },
];

/**
 * The map art is the RuneScape Wiki's, under CC BY-NC-SA 3.0. This tool is free
 * and non-commercial, so the licence is satisfied by crediting it and keeping
 * derived work under the same terms — which is what this string is for. It is
 * rendered, not decorative.
 */
export const ATLAS_CREDIT = {
  text: "World map by the RuneScape Wiki, CC BY-NC-SA 3.0",
  href: "https://runescape.wiki/w/File:RuneScape_Worldmap.png",
  licence: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
} as const;

/** Source: 4028x3128 original, resampled to these widths at build-prep time. */
export const ATLAS_IMAGE = {
  small: "/map/world-1600.webp",
  large: "/map/world-3200.webp",
  aspect: 4028 / 3128,
} as const;
