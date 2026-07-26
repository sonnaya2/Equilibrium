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
  c_nw: [0.196, 0.1],
  c_n_frem_w: [0.226, 0.08],
  c_n_frem: [0.262, 0.07],
  c_n_frem_e: [0.3, 0.067],
  c_n_fw: [0.359, 0.049],
  c_n_wild_w: [0.431, 0.026],
  c_n_wild: [0.501, 0.028],
  c_n_wild_e: [0.567, 0.04],
  c_ne_wild: [0.626, 0.07],
  c_e_wild_n: [0.643, 0.13],
  c_e_wild: [0.64, 0.223],
  c_e_mory_n: [0.72, 0.375],
  c_e_mory_ne: [0.738, 0.425],
  c_e_mory: [0.739, 0.49],
  c_e_mory_se: [0.72, 0.557],
  c_e_mory_s: [0.692, 0.619],
  c_e_des_n: [0.668, 0.718],
  c_e_des: [0.678, 0.76],
  c_e_des_s: [0.66, 0.863],
  c_se_des: [0.631, 0.952],
  c_s_des: [0.547, 0.976],
  c_sw_des: [0.454, 0.952],
  c_w_des: [0.412, 0.771],
  c_s_asg_e: [0.41, 0.68],
  c_s_asg: [0.416, 0.671],
  // Kandarin's south coast stays shallow: it used to dip to v 0.836, which put
  // it straight over Karamja's northern lobe. The two rings overlapped, which
  // the 3D board hid behind slab heights and the flat board did not.
  c_s_kand_e: [0.352, 0.686],
  c_s_kand: [0.256, 0.7],
  c_s_tir_e: [0.219, 0.764],
  c_s_tir: [0.168, 0.762],
  c_w_tir_s: [0.112, 0.692],
  c_w_tir: [0.085, 0.575],
  c_w_tir_n: [0.1, 0.471],
  c_nw_tir: [0.102, 0.369],
  c_w_kand: [0.174, 0.309],
  c_w_frem_s: [0.2, 0.273],
  c_w_frem: [0.192, 0.193],

  // Interior triple points. Every one of these is shared by 2+ regions.
  t_fw_asg: [0.358, 0.297], // Fremennik | Wilderness | Asgarnia
  t_f_asg_k: [0.319, 0.314], // Fremennik | Asgarnia | Kandarin
  t_w_asg_m: [0.483, 0.332], // Wilderness | Asgarnia | Misthalin
  t_w_m_mory: [0.589, 0.346], // Wilderness | Misthalin | Morytania
  t_wild_mory: [0.645, 0.322], // Wilderness | Morytania, on the east coast
  t_asg_mist_s: [0.447, 0.655], // Asgarnia | Misthalin, meeting the south coast
  t_m_y_d: [0.594, 0.643], // Misthalin | Morytania | Desert
  t_mist_des_w: [0.47, 0.673], // Misthalin | Desert
  t_tir_k_n: [0.201, 0.389], // Tirannwn | Kandarin, north
  t_tir_k_s: [0.221, 0.703], // Tirannwn | Kandarin, south

  // Seam interiors. Both neighbours walk these, in opposite directions, so a
  // border bends instead of running as a dead-straight chord.
  s_fw_1: [0.365, 0.13], // Fremennik | Wilderness
  s_fw_2: [0.355, 0.213],
  s_fk_1: [0.249, 0.305], // Fremennik | Kandarin
  s_wa_1: [0.422, 0.301], // Wilderness | Asgarnia
  s_wm_1: [0.532, 0.342], // Wilderness | Misthalin
  s_ak_1: [0.356, 0.457], // Asgarnia | Kandarin
  s_ak_2: [0.384, 0.574],
  s_am_1: [0.474, 0.456], // Asgarnia | Misthalin
  s_am_2: [0.46, 0.559],
  s_my_1: [0.594, 0.459], // Misthalin | Morytania, the Salve
  s_my_2: [0.591, 0.551],
  s_md_1: [0.53, 0.658], // Misthalin | Desert
  s_kt_1: [0.214, 0.546], // Kandarin | Tirannwn, the elf wall

  // Karamja — island, no shared nodes. Sits clear of Kandarin's south coast
  // and west of the Desert's, which regionCurve.test.ts holds.
  k_n: [0.308, 0.712],
  k_ne: [0.35, 0.722],
  k_e_n: [0.385, 0.748],
  k_e: [0.402, 0.814],
  k_se: [0.38, 0.881],
  k_s_e: [0.344, 0.91],
  k_s: [0.308, 0.918],
  k_sw: [0.258, 0.892],
  k_w_s: [0.229, 0.838],
  k_w: [0.223, 0.783],
  k_nw: [0.255, 0.734],

  // Anachronia — island.
  a_nw: [0.676, 0.073],
  a_n_w: [0.723, 0.032],
  a_n: [0.783, 0.018],
  a_ne: [0.854, 0.044],
  a_e_n: [0.89, 0.123],
  a_e: [0.899, 0.234],
  a_se: [0.837, 0.322],
  a_s: [0.742, 0.344],
  a_s_w: [0.683, 0.289],
  a_w: [0.649, 0.177],

  // Havenhythe — island.
  h_n: [0.83, 0.371],
  h_ne: [0.883, 0.388],
  h_e_n: [0.913, 0.456],
  h_e: [0.921, 0.58],
  h_se: [0.889, 0.692],
  h_s_e: [0.841, 0.745],
  h_s: [0.799, 0.73],
  h_w_s: [0.773, 0.637],
  h_w: [0.777, 0.528],
  h_nw: [0.799, 0.424],
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
  elevation: 0.8,
  radius: 1.42,
  target: [0, 0, 0.03],
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
      // Aimed at the slab surface, not the ground plane: at y=0 the board rides
      // the top of the frame and the lower half is all water.
      0.055,
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
    markerUv: [0.523, 0.588],
    depth: 0.09,
    framing: frame([0.523, 0.588], 0, 0.8, 1.05),
  },
  {
    id: "havenhythe",
    ring: ["h_n", "h_ne", "h_e_n", "h_e", "h_se", "h_s_e", "h_s", "h_w_s", "h_w", "h_nw"],
    markerUv: [0.847, 0.574],
    depth: 0.075,
    framing: frame([0.847, 0.574], 0.48, 0.76, 1.12, 38, 0.2),
  },
  {
    id: "karamja",
    ring: ["k_n", "k_ne", "k_e_n", "k_e", "k_se", "k_s_e", "k_s", "k_sw", "k_w_s", "k_w", "k_nw"],
    markerUv: [0.313, 0.822],
    depth: 0.07,
    framing: frame([0.313, 0.822], -0.3, 0.82, 1.1, 38, 0.14),
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
    markerUv: [0.408, 0.377],
    depth: 0.085,
    framing: frame([0.408, 0.377], -0.18, 0.8, 1.05),
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
    // Pulled north off Karamja: at the old [0.311, 0.647] the two markers sat
    // 0.08 world units apart and their crest-and-count stacks overlapped on
    // screen, which made both counts unreadable.
    markerUv: [0.285, 0.48],
    depth: 0.08,
    framing: frame([0.285, 0.48], -0.34, 0.78, 1.15, 38, 0.1),
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
    markerUv: [0.277, 0.16],
    depth: 0.075,
    framing: frame([0.277, 0.16], -0.28, 0.72, 1.2, 38, 0.12),
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
    markerUv: [0.5, 0.179],
    depth: 0.065,
    // Lower and wider: the northern slabs need to stack in frame.
    framing: frame([0.5, 0.179], 0, 0.66, 1.3, 40, 0.1),
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
    markerUv: [0.545, 0.796],
    depth: 0.07,
    // Barely pulled toward centre: at 0.12 the Menaphos end of the region sat
    // below the frame, so half its markers were off screen when focused.
    framing: frame([0.545, 0.796], 0, 0.84, 1.12, 38, 0.03),
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
    markerUv: [0.667, 0.476],
    depth: 0.075,
    framing: frame([0.667, 0.476], 0.3, 0.8, 1.08, 38, 0.06),
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
    markerUv: [0.15, 0.575],
    depth: 0.07,
    framing: frame([0.15, 0.575], -0.46, 0.76, 1.18, 38, 0.18),
  },
  {
    id: "anachronia",
    ring: ["a_nw", "a_n_w", "a_n", "a_ne", "a_e_n", "a_e", "a_se", "a_s", "a_s_w", "a_w"],
    markerUv: [0.774, 0.174],
    depth: 0.065,
    framing: frame([0.774, 0.174], 0.4, 0.74, 1.15, 38, 0.18),
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
