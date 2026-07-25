/**
 * Numeric mirrors of the @theme tokens in app/globals.css, for the 3D scene.
 * The CSS custom properties stay canonical; this module exists because TSL
 * uniforms and light colors want numbers, not custom property strings.
 * Inline hex anywhere else in src/map/ is a defect (equilibrium-ui).
 */

export const SURFACE_VOID = 0x0d0a07;
export const SURFACE_DEEP = 0x14100b;
export const SURFACE_PANEL = 0x1b1610;
export const SURFACE_RAISED = 0x231d15;
export const EDGE_LINE = 0x332a1e;
export const EDGE_CARVE = 0x463a29;

export const PARCH_50 = 0xefe7d5;
export const PARCH_100 = 0xd3c8b0;
export const PARCH_300 = 0xa99f88;
export const PARCH_400 = 0x948a73;
export const PARCH_500 = 0x8b7f68;

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

/** The unifier: every slab cap grades 14% toward this mean (wartable plan §5). */
export const BOARD_MEAN = 0x2a2318;

/** Light rig. The key is sunlit parchment, warmer than any ink token. */
export const LIGHT_KEY = 0xf0dcb4;
export const LIGHT_FILL = EDGE_CARVE;
export const LIGHT_RIM = GEM_400;
