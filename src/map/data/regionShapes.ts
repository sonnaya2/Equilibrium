import type { RegionId } from "@/league";
import { MAP_WORLD } from "./regionAnchors";

/**
 * The board, as original low-poly geometry.
 *
 * Jagex's map has no region borders in it — it draws a coastline and colours
 * whichever regions you have unlocked, so the interior lines here are ours.
 * They follow real Gielinor adjacency (Wilderness walled across the north,
 * Morytania east of Misthalin over the Salve, Tirannwn behind the elf wall,
 * Karamja and Anachronia and Havenhythe as islands) rather than tracing art.
 *
 * Regions index into BORDER_NODES instead of carrying their own coordinates.
 * That is the load-bearing part: an interior seam is literally the same two
 * nodes in both neighbours, so slabs cannot drift apart or z-fight along a
 * shared edge no matter how the board is extruded. Moving one node moves both
 * regions. regionShapes.test.ts holds that invariant.
 *
 * Coordinates are map-uv: 0..1, x east, y south.
 */
export const BORDER_NODES = {
  // Outer coastline, mainland, clockwise from the north-west. Coast nodes
  // belong to one region; the seam nodes below are shared.
  c_nw: [0.152, 0.075],
  c_n_frem_w: [0.196, 0.046],
  c_n_frem: [0.25, 0.03],
  c_n_frem_e: [0.306, 0.026],
  c_n_fw: [0.36, 0.024],
  c_n_wild_w: [0.418, 0.018],
  c_n_wild: [0.5, 0.02],
  c_n_wild_e: [0.578, 0.034],
  c_ne_wild: [0.648, 0.07],
  c_e_wild_n: [0.668, 0.14],
  c_e_wild: [0.664, 0.25],
  c_e_mory_n: [0.742, 0.372],
  c_e_mory_ne: [0.764, 0.436],
  c_e_mory: [0.766, 0.52],
  c_e_mory_se: [0.742, 0.606],
  c_e_mory_s: [0.706, 0.686],
  c_e_des_n: [0.64, 0.78],
  c_e_des: [0.648, 0.812],
  c_e_des_s: [0.634, 0.89],
  c_se_des: [0.612, 0.958],
  c_s_des: [0.548, 0.976],
  c_sw_des: [0.478, 0.958],
  c_w_des: [0.446, 0.82],
  c_s_asg_e: [0.406, 0.68],
  c_s_asg: [0.386, 0.664],
  c_s_kand_e: [0.33, 0.712],
  c_s_kand: [0.262, 0.766],
  c_s_tir_e: [0.204, 0.784],
  c_s_tir: [0.156, 0.782],
  c_w_tir_s: [0.104, 0.716],
  c_w_tir: [0.078, 0.606],
  c_w_tir_n: [0.092, 0.508],
  c_nw_tir: [0.128, 0.436],
  c_w_kand: [0.17, 0.404],
  c_w_frem_s: [0.158, 0.33],
  c_w_frem: [0.146, 0.212],

  // Interior triple points. Every one of these is shared by 2+ regions.
  t_fw_asg: [0.36, 0.348], // Fremennik | Wilderness | Asgarnia
  t_f_asg_k: [0.318, 0.392], // Fremennik | Asgarnia | Kandarin
  t_w_asg_m: [0.47, 0.344], // Wilderness | Asgarnia | Misthalin
  t_w_m_mory: [0.6, 0.34], // Wilderness | Misthalin | Morytania
  t_wild_mory: [0.658, 0.336], // Wilderness | Morytania, on the east coast
  t_asg_mist_s: [0.424, 0.702], // Asgarnia | Misthalin, meeting the south coast
  t_m_y_d: [0.596, 0.726], // Misthalin | Morytania | Desert
  t_mist_des_w: [0.47, 0.762], // Misthalin | Desert
  t_tir_k_n: [0.206, 0.452], // Tirannwn | Kandarin, north
  t_tir_k_s: [0.222, 0.7], // Tirannwn | Kandarin, south

  // Seam interiors. Both neighbours walk these, in opposite directions, so a
  // border bends instead of running as a dead-straight chord.
  s_fw_1: [0.368, 0.13], // Fremennik | Wilderness
  s_fw_2: [0.356, 0.24],
  s_fk_1: [0.244, 0.4], // Fremennik | Kandarin
  s_wa_1: [0.412, 0.344], // Wilderness | Asgarnia
  s_wm_1: [0.536, 0.338], // Wilderness | Misthalin
  s_ak_1: [0.34, 0.5], // Asgarnia | Kandarin
  s_ak_2: [0.362, 0.59],
  s_am_1: [0.456, 0.47], // Asgarnia | Misthalin
  s_am_2: [0.44, 0.59],
  s_my_1: [0.604, 0.47], // Misthalin | Morytania, the Salve
  s_my_2: [0.6, 0.6],
  s_md_1: [0.534, 0.746], // Misthalin | Desert
  s_kt_1: [0.216, 0.576], // Kandarin | Tirannwn, the elf wall

  // Karamja — island, no shared nodes.
  k_n: [0.3, 0.612],
  k_ne: [0.36, 0.626],
  k_e_n: [0.412, 0.664],
  k_e: [0.436, 0.76],
  k_se: [0.404, 0.858],
  k_s_e: [0.352, 0.9],
  k_s: [0.3, 0.912],
  k_sw: [0.226, 0.874],
  k_w_s: [0.184, 0.796],
  k_w: [0.176, 0.716],
  k_nw: [0.222, 0.644],

  // Anachronia — island.
  a_nw: [0.7, 0.108],
  a_n_w: [0.74, 0.074],
  a_n: [0.79, 0.062],
  a_ne: [0.85, 0.084],
  a_e_n: [0.88, 0.15],
  a_e: [0.888, 0.244],
  a_se: [0.836, 0.318],
  a_s: [0.756, 0.336],
  a_s_w: [0.706, 0.29],
  a_w: [0.678, 0.196],

  // Havenhythe — island.
  h_n: [0.842, 0.412],
  h_ne: [0.892, 0.428],
  h_e_n: [0.92, 0.492],
  h_e: [0.928, 0.61],
  h_se: [0.898, 0.716],
  h_s_e: [0.852, 0.766],
  h_s: [0.812, 0.752],
  h_w_s: [0.788, 0.664],
  h_w: [0.792, 0.56],
  h_nw: [0.812, 0.462],
} as const satisfies Record<string, readonly [number, number]>;

export type BorderNode = keyof typeof BORDER_NODES;

export interface RegionShape {
  id: RegionId;
  /** Closed ring, clockwise in uv. Shared keys guarantee shared edges. */
  ring: readonly BorderNode[];
  /** Crest and count chip position, inside the ring. */
  markerUv: readonly [number, number];
  /** Slab thickness in world units. Core regions sit thicker than islands. */
  depth: number;
  /** Authored camera shot for this region. Never derived from the centroid:
   *  edge regions get pulled inward so they are not shot from off the board. */
  framing: Framing;
}

/** Camera position in board-spherical coords around the framing target. */
export interface Framing {
  /** Radians, 0 = due south of target. */
  azimuth: number;
  /** Radians above the board plane. */
  elevation: number;
  radius: number;
  target: readonly [number, number, number];
  fov: number;
}

/** The default 3/4 war-table shot. */
export const TABLE_FRAMING: Framing = {
  azimuth: 0,
  elevation: 0.82,
  radius: 1.62,
  target: [0, 0, 0.06],
  fov: 38,
};

/** markerUv -> world target, so shots track the authored marker points.
 *  targetPull scales the target back toward board centre for edge regions. */
function frame(
  markerUv: readonly [number, number],
  azimuth: number,
  elevation: number,
  radius: number,
  fov = 38,
  targetPull = 0,
): Framing {
  const keep = 1 - targetPull;
  return {
    azimuth,
    elevation,
    radius,
    target: [
      (markerUv[0] - 0.5) * MAP_WORLD.width * keep,
      0,
      (markerUv[1] - 0.5) * MAP_WORLD.height * keep,
    ],
    fov,
  };
}

export const REGION_SHAPES: readonly RegionShape[] = [
  {
    id: "misthalin",
    ring: [
      "t_w_asg_m",
      "s_wm_1",
      "t_w_m_mory",
      "s_my_1",
      "s_my_2",
      "t_m_y_d",
      "s_md_1",
      "t_mist_des_w",
      "t_asg_mist_s",
      "s_am_2",
      "s_am_1",
    ],
    markerUv: [0.512, 0.545],
    depth: 0.09,
    framing: frame([0.512, 0.545], 0, 0.8, 1.05),
  },
  {
    id: "havenhythe",
    ring: ["h_n", "h_ne", "h_e_n", "h_e", "h_se", "h_s_e", "h_s", "h_w_s", "h_w", "h_nw"],
    markerUv: [0.858, 0.585],
    depth: 0.075,
    framing: frame([0.858, 0.585], 0.48, 0.76, 1.12, 38, 0.2),
  },
  {
    id: "karamja",
    ring: ["k_n", "k_ne", "k_e_n", "k_e", "k_se", "k_s_e", "k_s", "k_sw", "k_w_s", "k_w", "k_nw"],
    markerUv: [0.305, 0.762],
    depth: 0.07,
    framing: frame([0.305, 0.762], -0.3, 0.82, 1.1, 38, 0.14),
  },
  {
    id: "asgarnia",
    ring: [
      "t_fw_asg",
      "s_wa_1",
      "t_w_asg_m",
      "s_am_1",
      "s_am_2",
      "t_asg_mist_s",
      "c_s_asg_e",
      "c_s_asg",
      "s_ak_2",
      "s_ak_1",
      "t_f_asg_k",
    ],
    markerUv: [0.396, 0.492],
    depth: 0.085,
    framing: frame([0.396, 0.492], -0.18, 0.8, 1.05),
  },
  {
    id: "kandarin",
    ring: [
      "c_w_kand",
      "s_fk_1",
      "t_f_asg_k",
      "s_ak_1",
      "s_ak_2",
      "c_s_asg",
      "c_s_kand_e",
      "c_s_kand",
      "t_tir_k_s",
      "s_kt_1",
      "t_tir_k_n",
      "c_nw_tir",
    ],
    markerUv: [0.252, 0.535],
    depth: 0.08,
    framing: frame([0.252, 0.535], -0.34, 0.78, 1.15, 38, 0.1),
  },
  {
    id: "fremennik",
    ring: [
      "c_nw",
      "c_n_frem_w",
      "c_n_frem",
      "c_n_frem_e",
      "c_n_fw",
      "s_fw_1",
      "s_fw_2",
      "t_fw_asg",
      "t_f_asg_k",
      "s_fk_1",
      "c_w_kand",
      "c_w_frem_s",
      "c_w_frem",
    ],
    markerUv: [0.268, 0.215],
    depth: 0.075,
    framing: frame([0.268, 0.215], -0.28, 0.72, 1.2, 38, 0.12),
  },
  {
    id: "forinthry",
    ring: [
      "c_n_fw",
      "c_n_wild_w",
      "c_n_wild",
      "c_n_wild_e",
      "c_ne_wild",
      "c_e_wild_n",
      "c_e_wild",
      "t_wild_mory",
      "t_w_m_mory",
      "s_wm_1",
      "t_w_asg_m",
      "s_wa_1",
      "t_fw_asg",
      "s_fw_2",
      "s_fw_1",
    ],
    markerUv: [0.518, 0.19],
    depth: 0.065,
    // Lower and wider: the northern slabs need to stack in frame.
    framing: frame([0.518, 0.19], 0, 0.66, 1.3, 40, 0.1),
  },
  {
    id: "desert",
    ring: [
      "t_mist_des_w",
      "s_md_1",
      "t_m_y_d",
      "c_e_des_n",
      "c_e_des",
      "c_e_des_s",
      "c_se_des",
      "c_s_des",
      "c_sw_des",
      "c_w_des",
    ],
    markerUv: [0.542, 0.85],
    depth: 0.07,
    framing: frame([0.542, 0.85], 0, 0.84, 1.12, 38, 0.12),
  },
  {
    id: "morytania",
    ring: [
      "t_w_m_mory",
      "t_wild_mory",
      "c_e_mory_n",
      "c_e_mory_ne",
      "c_e_mory",
      "c_e_mory_se",
      "c_e_mory_s",
      "t_m_y_d",
      "s_my_2",
      "s_my_1",
    ],
    markerUv: [0.676, 0.5],
    depth: 0.075,
    framing: frame([0.676, 0.5], 0.3, 0.8, 1.08, 38, 0.06),
  },
  {
    id: "tirannwn",
    ring: [
      "c_nw_tir",
      "t_tir_k_n",
      "s_kt_1",
      "t_tir_k_s",
      "c_s_tir_e",
      "c_s_tir",
      "c_w_tir_s",
      "c_w_tir",
      "c_w_tir_n",
    ],
    markerUv: [0.156, 0.592],
    depth: 0.07,
    framing: frame([0.156, 0.592], -0.46, 0.76, 1.18, 38, 0.18),
  },
  {
    id: "anachronia",
    ring: ["a_nw", "a_n_w", "a_n", "a_ne", "a_e_n", "a_e", "a_se", "a_s", "a_s_w", "a_w"],
    markerUv: [0.781, 0.2],
    depth: 0.065,
    framing: frame([0.781, 0.2], 0.4, 0.74, 1.15, 38, 0.18),
  },
];

export const SHAPE_BY_ID = new Map(REGION_SHAPES.map((s) => [s.id, s]));

/** Ring resolved to uv points. */
export function ringPoints(shape: RegionShape): [number, number][] {
  return shape.ring.map((k) => [...BORDER_NODES[k]] as [number, number]);
}

/** Signed area in uv (y down), so clockwise-on-screen is positive. */
export function signedArea(points: readonly (readonly [number, number])[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Directed edges of a ring, as node-key pairs. */
export function ringEdges(shape: RegionShape): [BorderNode, BorderNode][] {
  return shape.ring.map((k, i) => [k, shape.ring[(i + 1) % shape.ring.length]]);
}
