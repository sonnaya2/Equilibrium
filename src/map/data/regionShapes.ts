import type { RegionId } from "@/league";

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
  // Outer coastline, mainland, clockwise from the north-west.
  c_nw: [0.152, 0.075],
  c_n_frem: [0.25, 0.03],
  c_n_fw: [0.36, 0.024],
  c_n_wild: [0.5, 0.02],
  c_ne_wild: [0.648, 0.07],
  c_e_wild: [0.664, 0.25],
  c_e_mory_n: [0.742, 0.372],
  c_e_mory: [0.766, 0.52],
  c_e_mory_s: [0.706, 0.686],
  c_e_des: [0.648, 0.812],
  c_se_des: [0.612, 0.958],
  c_sw_des: [0.478, 0.958],
  c_w_des: [0.446, 0.82],
  c_s_asg: [0.386, 0.664],
  c_s_kand_e: [0.33, 0.712],
  c_s_tir: [0.156, 0.782],
  c_w_tir: [0.078, 0.606],
  c_nw_tir: [0.128, 0.436],
  c_w_kand: [0.17, 0.404],

  // Interior seams. Every one of these is shared by 2+ regions.
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

  // Karamja — island, no shared nodes.
  k_n: [0.3, 0.612],
  k_ne: [0.404, 0.64],
  k_e: [0.436, 0.76],
  k_se: [0.398, 0.876],
  k_s: [0.3, 0.912],
  k_sw: [0.212, 0.856],
  k_w: [0.176, 0.732],
  k_nw: [0.216, 0.648],

  // Anachronia — island.
  a_nw: [0.7, 0.108],
  a_n: [0.79, 0.062],
  a_ne: [0.876, 0.118],
  a_e: [0.888, 0.244],
  a_se: [0.812, 0.336],
  a_s: [0.72, 0.316],
  a_w: [0.678, 0.212],

  // Havenhythe — island.
  h_n: [0.842, 0.412],
  h_ne: [0.916, 0.452],
  h_e: [0.928, 0.61],
  h_se: [0.884, 0.744],
  h_s: [0.82, 0.766],
  h_w: [0.792, 0.612],
  h_nw: [0.806, 0.47],
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
}

export const REGION_SHAPES: readonly RegionShape[] = [
  {
    id: "misthalin",
    ring: ["t_w_asg_m", "t_w_m_mory", "t_m_y_d", "t_mist_des_w", "t_asg_mist_s"],
    markerUv: [0.512, 0.545],
    depth: 0.09,
  },
  {
    id: "havenhythe",
    ring: ["h_n", "h_ne", "h_e", "h_se", "h_s", "h_w", "h_nw"],
    markerUv: [0.858, 0.585],
    depth: 0.075,
  },
  {
    id: "karamja",
    ring: ["k_n", "k_ne", "k_e", "k_se", "k_s", "k_sw", "k_w", "k_nw"],
    markerUv: [0.305, 0.762],
    depth: 0.07,
  },
  {
    id: "asgarnia",
    ring: ["t_fw_asg", "t_w_asg_m", "t_asg_mist_s", "c_s_asg", "t_f_asg_k"],
    markerUv: [0.396, 0.492],
    depth: 0.085,
  },
  {
    id: "kandarin",
    ring: [
      "c_w_kand",
      "t_f_asg_k",
      "c_s_asg",
      "c_s_kand_e",
      "t_tir_k_s",
      "t_tir_k_n",
      "c_nw_tir",
    ],
    markerUv: [0.252, 0.535],
    depth: 0.08,
  },
  {
    id: "fremennik",
    ring: ["c_nw", "c_n_frem", "c_n_fw", "t_fw_asg", "t_f_asg_k", "c_w_kand"],
    markerUv: [0.268, 0.215],
    depth: 0.075,
  },
  {
    id: "forinthry",
    ring: [
      "c_n_fw",
      "c_n_wild",
      "c_ne_wild",
      "c_e_wild",
      "t_wild_mory",
      "t_w_m_mory",
      "t_w_asg_m",
      "t_fw_asg",
    ],
    markerUv: [0.518, 0.19],
    depth: 0.065,
  },
  {
    id: "desert",
    ring: ["t_mist_des_w", "t_m_y_d", "c_e_des", "c_se_des", "c_sw_des", "c_w_des"],
    markerUv: [0.542, 0.85],
    depth: 0.07,
  },
  {
    id: "morytania",
    ring: ["t_w_m_mory", "t_wild_mory", "c_e_mory_n", "c_e_mory", "c_e_mory_s", "t_m_y_d"],
    markerUv: [0.676, 0.5],
    depth: 0.075,
  },
  {
    id: "tirannwn",
    ring: ["c_nw_tir", "t_tir_k_n", "t_tir_k_s", "c_s_tir", "c_w_tir"],
    markerUv: [0.156, 0.592],
    depth: 0.07,
  },
  {
    id: "anachronia",
    ring: ["a_nw", "a_n", "a_ne", "a_e", "a_se", "a_s", "a_w"],
    markerUv: [0.781, 0.2],
    depth: 0.065,
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
