/**
 * Concept skins for the shared WebGPU remaster board.
 * Geometry is always production REGION_SHAPES — light, lift, palette, and
 * per-skin TSL shade params change.
 */

import type { MapRemasterTeamId } from "../teams";
import {
  GEM_200,
  GEM_300,
  GEM_400,
  GEM_600,
  LIGHT_FILL,
  LIGHT_KEY,
  LIGHT_RIM,
  OCEAN_DEEP,
  OCEAN_FOAM,
  OCEAN_SHALLOW,
  SURFACE_VOID,
} from "@/map/palette";

/** Tunables consumed by remasterCap / remasterOcean / remasterVine TSL graphs. */
export type RemasterShade = {
  /** Extra albedo gain on top of production 1.95 * skin.exposure */
  albedoBoost: number;
  /** Soft micro-noise grain on caps (0 = off) */
  microDetail: number;
  /** Fake top-light N·L term strength on caps */
  topLight: number;
  /** 0..1 warm cream mix into top-light (daylit high) */
  topLightWarm: number;
  /** Pull tile toward parchment luminance (cartographer 0.12–0.22) */
  parchmentMix: number;
  /** Contrast / value separation on terrain (boardsky grade) */
  gradeMix: number;
  /** Dual-tone lattice strength on caps (boardsky) */
  dualTone: number;
  /** Wall band noise amplitude */
  strataJitter: number;
  /** Wall strata contrast (clearer cut earth; raised high) */
  strataContrast: number;
  /** Warm umber bias on wall topsoil */
  wallWarmth: number;
  capRoughness: number;
  wallRoughness: number;
  /** Focus rim power (higher = thinner gem edge scatter; crystal ~3.8) */
  focusRimPow: number;
  /** Unlocked sun-warm bias on caps (crystal) */
  warmUnlocked: number;
  /** Extra cool dusk desat when locked (crystal) */
  coolLock: number;
  /** Wall grazing ink darken — chart coast (cartographer) */
  coastDarken: number;
  /** Focus subject albedo pop under low fill (raised) */
  subjectBoost: number;
  /** Ocean foam ridge mix amount */
  foamAmount: number;
  /** smoothstep low for foam ridge */
  foamEdge0: number;
  /** smoothstep high for foam ridge */
  foamEdge1: number;
  /** Cheap sin-product caustic scroll (0 = off; crystal high) */
  caustic: number;
  /** Chart hatch lattice on foam (cartographer) */
  foamHatch: number;
  /** Base ocean roughness (lower = sharper specular / raised mirror) */
  oceanRough: number;
  /** Ocean metalness (raised reflective) */
  oceanMetal: number;
  /** Foam / caustic emissive lift */
  ridgeEmit: number;
  /** Leaf tip emissive when growth is high */
  vineTipEmissive: number;
  vineRoughness: number;
  /** Stem metalness (crystal shard stem slightly higher) */
  vineStemMetal: number;
  /** Leaf metalness */
  vineLeafMetal: number;
};

export type RemasterSkin = {
  id: MapRemasterTeamId;
  /** Canvas clear / fog void */
  voidColor: number;
  ambient: { intensity: number; color: number };
  key: { intensity: number; color: number; position: [number, number, number] };
  fill: { intensity: number; color: number; position: [number, number, number] };
  rim: { intensity: number; color: number; position: [number, number, number] };
  /** Extra local lift when region is framed */
  focusLift: number;
  unfocusedDrop: number;
  /** Cap exposure multiplier on top of production ALBEDO_GAIN path (shader uniform) */
  exposure: number;
  lockDrain: number;
  dimAmount: number;
  focusEmissive: number;
  ocean: { deep: number; shallow: number; foam: number; swell: number };
  vine: { stem: number; leaf: number; tip: number; halfWidth: number; tubeRadius: number };
  shade: RemasterShade;
  /** Shell chrome class on the DOM wrapper */
  shellClass: string;
  title: string;
  blurb: string;
};

const SHADE_DAYLIT: RemasterShade = {
  albedoBoost: 1.1,
  microDetail: 0.038,
  topLight: 0.2,
  topLightWarm: 0.9,
  parchmentMix: 0.08,
  gradeMix: 0.1,
  dualTone: 0,
  strataJitter: 0.042,
  strataContrast: 0.18,
  wallWarmth: 0.48,
  capRoughness: 0.8,
  wallRoughness: 0.9,
  focusRimPow: 2.0,
  warmUnlocked: 0.06,
  coolLock: 0,
  coastDarken: 0,
  subjectBoost: 0,
  foamAmount: 0.36,
  foamEdge0: 0.72,
  foamEdge1: 0.96,
  caustic: 0.1,
  foamHatch: 0,
  oceanRough: 0.11,
  oceanMetal: 0.08,
  ridgeEmit: 0.08,
  vineTipEmissive: 0.38,
  vineRoughness: 0.6,
  vineStemMetal: 0.06,
  vineLeafMetal: 0.04,
};

const SHADE_BOARDSKY: RemasterShade = {
  albedoBoost: 1.02,
  microDetail: 0.022,
  topLight: 0.09,
  topLightWarm: 0.22,
  parchmentMix: 0,
  gradeMix: 0.38,
  dualTone: 0.24,
  strataJitter: 0.052,
  strataContrast: 0.4,
  wallWarmth: 0.1,
  capRoughness: 0.88,
  wallRoughness: 0.94,
  focusRimPow: 2.55,
  warmUnlocked: 0,
  coolLock: 0,
  coastDarken: 0,
  subjectBoost: 0,
  foamAmount: 0.28,
  foamEdge0: 0.76,
  foamEdge1: 0.98,
  caustic: 0.2,
  foamHatch: 0,
  oceanRough: 0.16,
  oceanMetal: 0.08,
  ridgeEmit: 0.08,
  vineTipEmissive: 0.24,
  vineRoughness: 0.66,
  vineStemMetal: 0.06,
  vineLeafMetal: 0.04,
};

/** Crystal Frontier — sun-warm open stone, cool lock, thin gem rim, caustic abyss */
const SHADE_CRYSTAL: RemasterShade = {
  albedoBoost: 1.0,
  microDetail: 0.014,
  topLight: 0.12,
  topLightWarm: 0.55,
  parchmentMix: 0,
  gradeMix: 0.12,
  dualTone: 0.04,
  strataJitter: 0.048,
  strataContrast: 0.3,
  wallWarmth: 0.06,
  capRoughness: 0.84,
  wallRoughness: 0.92,
  focusRimPow: 3.8,
  warmUnlocked: 0.18,
  coolLock: 0.24,
  coastDarken: 0,
  subjectBoost: 0.05,
  foamAmount: 0.14,
  foamEdge0: 0.78,
  foamEdge1: 0.98,
  caustic: 0.55,
  foamHatch: 0,
  oceanRough: 0.18,
  oceanMetal: 0.1,
  ridgeEmit: 0.14,
  vineTipEmissive: 0.22,
  vineRoughness: 0.48,
  vineStemMetal: 0.16,
  vineLeafMetal: 0.1,
};

/** Cartographer's Desk — parchment lift, ink coast, hatch foam, rope ivy */
const SHADE_CARTO: RemasterShade = {
  albedoBoost: 1.06,
  microDetail: 0.045,
  topLight: 0.12,
  topLightWarm: 0.55,
  parchmentMix: 0.18,
  gradeMix: 0.06,
  dualTone: 0,
  strataJitter: 0.038,
  strataContrast: 0.16,
  wallWarmth: 0.28,
  capRoughness: 0.78,
  wallRoughness: 0.9,
  focusRimPow: 2.4,
  warmUnlocked: 0,
  coolLock: 0,
  coastDarken: 0.3,
  subjectBoost: 0,
  foamAmount: 0.22,
  foamEdge0: 0.8,
  foamEdge1: 0.98,
  caustic: 0,
  foamHatch: 0.55,
  oceanRough: 0.36,
  oceanMetal: 0.04,
  ridgeEmit: 0.04,
  vineTipEmissive: 0.08,
  vineRoughness: 0.8,
  vineStemMetal: 0.02,
  vineLeafMetal: 0.02,
};

/** Raised Court — subject exposure, lock crush, strata cut, dark mirror sea */
const SHADE_RAISED: RemasterShade = {
  albedoBoost: 1.08,
  microDetail: 0.018,
  topLight: 0.16,
  topLightWarm: 0.45,
  parchmentMix: 0.02,
  gradeMix: 0.16,
  dualTone: 0.04,
  strataJitter: 0.058,
  strataContrast: 0.55,
  wallWarmth: 0.18,
  capRoughness: 0.9,
  wallRoughness: 0.96,
  focusRimPow: 2.6,
  warmUnlocked: 0.04,
  coolLock: 0.14,
  coastDarken: 0.1,
  subjectBoost: 0.22,
  foamAmount: 0.12,
  foamEdge0: 0.84,
  foamEdge1: 0.99,
  caustic: 0.04,
  foamHatch: 0,
  oceanRough: 0.08,
  oceanMetal: 0.22,
  ridgeEmit: 0.05,
  vineTipEmissive: 0.06,
  vineRoughness: 0.88,
  vineStemMetal: 0.03,
  vineLeafMetal: 0.02,
};

export const REMASTER_SKINS: Record<MapRemasterTeamId, RemasterSkin> = {
  daylit: {
    id: "daylit",
    voidColor: 0x12100c,
    // Noon clerestory: warm key, stronger fill so terrain midtones read.
    ambient: { intensity: 0.62, color: 0xd4c4a8 },
    key: { intensity: 2.45, color: 0xffefd4, position: [1.7, 2.9, 1.05] },
    fill: { intensity: 0.62, color: 0xa89878, position: [-1.5, 1.5, -1.1] },
    rim: { intensity: 0.42, color: 0x8ad4b8, position: [-1.7, 1.1, -1.7] },
    focusLift: 0.062,
    unfocusedDrop: 0.016,
    exposure: 1.18,
    lockDrain: 0.48,
    dimAmount: 0.36,
    focusEmissive: 1.9,
    ocean: { deep: 0x0a242c, shallow: 0x1a5a52, foam: 0x6ab8a0, swell: 0.26 },
    // Olive plant palette (daylit vine materials use their own constants)
    vine: { stem: 0x3d4a28, leaf: 0x4a6a38, tip: 0xc8e090, halfWidth: 0.024, tubeRadius: 0.0075 },
    shade: SHADE_DAYLIT,
    shellClass: "remaster-shell remaster-shell--daylit",
    title: "Daylit Reliquary",
    blurb: "Quality champion · living seam vines · noon materials · Board Sky dossier",
  },
  crystal: {
    id: "crystal",
    voidColor: 0x0a0c10,
    ambient: { intensity: 0.42, color: 0x6a7a88 },
    key: { intensity: 2.1, color: 0xf0e8d8, position: [1.4, 2.6, 0.8] },
    fill: { intensity: 0.35, color: 0x3a4a58, position: [-1.6, 1.0, -1.0] },
    rim: { intensity: 0.85, color: GEM_300, position: [-2.0, 1.4, -1.4] },
    focusLift: 0.06,
    unfocusedDrop: 0.02,
    exposure: 1.12,
    lockDrain: 0.62,
    dimAmount: 0.48,
    focusEmissive: 2.8,
    ocean: { deep: 0x040c14, shallow: 0x0a2838, foam: 0x4ab0c4, swell: 0.2 },
    // Brighter crystal stem + shard leaf (MeshStandard, not neon crypto)
    vine: { stem: GEM_300, leaf: 0xb8ffe8, tip: 0xe8fff8, halfWidth: 0.02, tubeRadius: 0.0055 },
    shade: SHADE_CRYSTAL,
    shellClass: "remaster-shell remaster-shell--crystal",
    title: "Crystal Frontier",
    blurb: "Dusk field · gem ivy on seams · caustic sea · facet dossier tray",
  },
  cartographer: {
    id: "cartographer",
    voidColor: 0x1a1610,
    ambient: { intensity: 0.72, color: 0xe0d4b8 },
    key: { intensity: 1.85, color: 0xfff2dc, position: [1.2, 3.0, 0.6] },
    fill: { intensity: 0.65, color: 0xc4b59a, position: [-1.2, 1.6, -0.8] },
    rim: { intensity: 0.35, color: 0x8a7a60, position: [-1.4, 0.8, -1.6] },
    focusLift: 0.042,
    unfocusedDrop: 0.01,
    exposure: 1.35,
    lockDrain: 0.4,
    dimAmount: 0.28,
    focusEmissive: 1.4,
    ocean: { deep: 0x1a3a44, shallow: 0x2a5a5a, foam: 0x8ab0a0, swell: 0.14 },
    // Brown rope stem + olive leaves (not gem green)
    vine: { stem: 0x4a3a28, leaf: 0x4a6a38, tip: 0x7a9a50, halfWidth: 0.024, tubeRadius: 0.007 },
    shade: SHADE_CARTO,
    shellClass: "remaster-shell remaster-shell--carto",
    title: "Cartographer's Desk",
    blurb: "Parchment lift · ink selection · rope-ivy · three-band desk",
  },
  boardsky: {
    id: "boardsky",
    voidColor: SURFACE_VOID,
    ambient: { intensity: 0.52, color: LIGHT_FILL },
    key: { intensity: 2.15, color: LIGHT_KEY, position: [1.6, 2.5, 0.95] },
    fill: { intensity: 0.5, color: LIGHT_FILL, position: [-1.6, 1.2, -1.4] },
    rim: { intensity: 0.5, color: LIGHT_RIM, position: [-1.8, 1.2, -1.6] },
    focusLift: 0.05,
    unfocusedDrop: 0.012,
    exposure: 1.18,
    lockDrain: 0.58,
    dimAmount: 0.35,
    focusEmissive: 2.1,
    ocean: { deep: OCEAN_DEEP, shallow: OCEAN_SHALLOW, foam: OCEAN_FOAM, swell: 0.26 },
    vine: { stem: GEM_600, leaf: GEM_400, tip: GEM_200, halfWidth: 0.024, tubeRadius: 0.006 },
    shade: SHADE_BOARDSKY,
    shellClass: "remaster-shell remaster-shell--boardsky",
    title: "Deep Board Sky",
    blurb: "Hybrid DNA · quality materials · pure Board Sky stack",
  },
  raised: {
    id: "raised",
    voidColor: 0x060504,
    ambient: { intensity: 0.28, color: 0x4a3d2c },
    key: { intensity: 2.7, color: 0xffe0a8, position: [0.4, 3.2, 1.6] },
    fill: { intensity: 0.22, color: 0x2a2318, position: [-2.0, 0.8, -1.2] },
    rim: { intensity: 0.4, color: GEM_400, position: [-1.8, 1.5, -1.8] },
    focusLift: 0.095,
    unfocusedDrop: 0.028,
    exposure: 1.28,
    lockDrain: 0.78,
    dimAmount: 0.58,
    focusEmissive: 3.0,
    ocean: { deep: 0x030a0e, shallow: 0x0a1e24, foam: 0x1e4848, swell: 0.16 },
    // Thicker / darker hedge mass
    vine: { stem: 0x142818, leaf: 0x1e4830, tip: 0x2a5a3a, halfWidth: 0.034, tubeRadius: 0.012 },
    shade: SHADE_RAISED,
    shellClass: "remaster-shell remaster-shell--raised",
    title: "Raised Court",
    blurb: "Stage plinth · dark sea · volume hedges · floating dossier",
  },
};
