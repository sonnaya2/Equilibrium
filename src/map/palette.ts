/**
 * Numeric mirrors of the @theme tokens in app/globals.css, for the 3D scene.
 * The CSS custom properties stay canonical; this module exists because TSL
 * uniforms and light colors want numbers, not custom property strings.
 * Inline hex anywhere else in src/map/ is a defect (equilibrium-ui).
 *
 * SURFACE/PARCH/EDGE match tournament R4 ship ladder (readable ink + slight stage lift).
 */

export const SURFACE_VOID = 0x0d0a07;
export const SURFACE_DEEP = 0x12100c;
export const SURFACE_PANEL = 0x1c1711;
export const SURFACE_RAISED = 0x231c14;
export const SURFACE_ROW = 0x2a2218;
export const EDGE_LINE = 0x463a29;
export const EDGE_CARVE = 0x5c4a34;

export const PARCH_50 = 0xf0e9d7;
export const PARCH_100 = 0xe0d4ba;
export const PARCH_300 = 0xc8b89c;
export const PARCH_400 = 0xb5a68c;
export const PARCH_500 = 0xa3967e;

export const GEM_200 = 0x8ff0cd;
export const GEM_300 = 0x57e0ae;
export const GEM_400 = 0x2ecb8f;
export const GEM_500 = 0x1fa372;
export const GEM_600 = 0x157a55;

export const GOLD_300 = 0xf3c97b;
export const GOLD_400 = 0xe0b264;
export const GOLD_500 = 0xa87c3c;

export const CHAOS_400 = 0xb5402f;
export const ORDER_400 = 0x4a7ec2;
export const BALANCE_400 = 0x6fae45;
export const EMBER_400 = 0xe2622a;

/**
 * Lit-surface albedo. Kept separate from the SURFACE_* chrome tokens above for
 * a reason worth spelling out, because it has already been got wrong once:
 * chrome tokens are the value a flat DOM panel should *end up* being on screen.
 * Feed one to a lit PBR material and the light multiplies it down — SURFACE_RAISED
 * decodes very dark under a key light. Albedo has to start brighter than the
 * value you want back.
 *
 * Terrain caps sample a texture; these are the fallbacks and the tints under it.
 */
export const TERRAIN_CAP = 0x7d7059;
export const TERRAIN_CAP_LOCKED = 0x3a3226;
export const TERRAIN_WALL_TOPSOIL = 0x8a6f4a;
export const TERRAIN_WALL_SUBSOIL = 0x6b5437;
export const TERRAIN_WALL_ROCK = 0x4a3f30;
export const TERRAIN_WALL_DEEP = 0x332b21;
/** The board the slabs sit in. Distinct from a locked cap so sockets read. */
export const TERRAIN_TABLE = 0x241d14;

/**
 * Ocean. Deep teal, sampled from the water on the in-game Regions tab, kept
 * dark enough that the slabs stay the brightest thing on the board.
 */
export const OCEAN_DEEP = 0x0b1f22;
export const OCEAN_SHALLOW = 0x16403a;
export const OCEAN_FOAM = 0x2c6a5c;

/** The unifier: every slab cap grades 14% toward this mean (wartable plan §5). */
export const BOARD_MEAN = 0x2a2318;

/** Light rig. The key is sunlit parchment, warmer than any ink token. */
export const LIGHT_KEY = 0xf0dcb4;
export const LIGHT_FILL = EDGE_CARVE;
export const LIGHT_RIM = GEM_400;
