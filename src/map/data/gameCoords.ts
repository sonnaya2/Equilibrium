/**
 * RuneScape surface game coordinates → war-table board UV.
 *
 * Source of truth for places: wiki cartography project (RuneScape:Map /
 * https://runescape.wiki/w/RuneScape:Map) and classic surface (x east, y north)
 * tiles. The war table is a stylised board, not a slippy map — we fit an affine
 * map from game coords onto the authored BORDER_NODES frame using control
 * landmarks that already sit correctly on both systems.
 *
 * uv: x east, y south (same as regionShapes). Game y north is flipped in the fit.
 */

export type GameXY = readonly [number, number];
export type BoardUV = readonly [number, number];

/** Trusted control landmarks: game (x,y north) + board uv (u, v south). */
export const GEOREF_CONTROLS: readonly {
  name: string;
  game: GameXY;
  uv: BoardUV;
}[] = [
  // Misthalin spine
  { name: "Lumbridge", game: [3222, 3218], uv: [0.527, 0.592] },
  { name: "Varrock", game: [3212, 3424], uv: [0.532, 0.42] },
  { name: "Edgeville", game: [3087, 3494], uv: [0.505, 0.4] },
  { name: "Draynor", game: [3093, 3243], uv: [0.491, 0.588] },
  // Asgarnia
  { name: "Falador", game: [2965, 3380], uv: [0.412, 0.472] },
  { name: "Port Sarim", game: [3025, 3217], uv: [0.425, 0.6] },
  { name: "Taverley", game: [2897, 3433], uv: [0.375, 0.452] },
  { name: "Burthorpe", game: [2899, 3545], uv: [0.368, 0.386] },
  { name: "GWD", game: [2910, 3745], uv: [0.42, 0.33] },
  // Kandarin
  { name: "Ardougne", game: [2662, 3305], uv: [0.3, 0.58] },
  { name: "Catherby", game: [2809, 3434], uv: [0.3, 0.42] },
  { name: "Seers", game: [2710, 3482], uv: [0.26, 0.38] },
  { name: "Tree Gnome Stronghold", game: [2460, 3440], uv: [0.22, 0.45] },
  { name: "Yanille", game: [2565, 3090], uv: [0.29, 0.64] },
  // Fremennik
  { name: "Rellekka", game: [2670, 3661], uv: [0.3, 0.18] },
  { name: "Waterbirth", game: [2540, 3740], uv: [0.24, 0.15] },
  // Wilderness / Forinthry
  { name: "Wilderness Agility", game: [2998, 3931], uv: [0.48, 0.12] },
  { name: "Daemonheim", game: [3449, 3697], uv: [0.624, 0.292] },
  { name: "Corp", game: [2966, 4381], uv: [0.47, 0.176] },
  // Desert
  { name: "Al Kharid", game: [3293, 3184], uv: [0.492, 0.7] },
  { name: "Pollnivneach", game: [3360, 2970], uv: [0.54, 0.82] },
  { name: "Sophanem", game: [3305, 2755], uv: [0.58, 0.9] },
  // Morytania
  { name: "Canifis", game: [3494, 3489], uv: [0.64, 0.48] },
  { name: "Port Phasmatys", game: [3680, 3485], uv: [0.72, 0.52] },
  { name: "Barrows", game: [3565, 3289], uv: [0.68, 0.58] },
  // Tirannwn
  { name: "Prifddinas", game: [2235, 3340], uv: [0.155, 0.52] },
  { name: "Lletya", game: [2340, 3170], uv: [0.175, 0.58] },
  // Karamja
  { name: "Musa Point", game: [2950, 3145], uv: [0.33, 0.74] },
  { name: "Brimhaven", game: [2760, 3170], uv: [0.264, 0.775] },
  { name: "Shilo", game: [2850, 2955], uv: [0.305, 0.882] },
  // Anachronia (island — looser)
  { name: "Anachronia base", game: [5400, 2400], uv: [0.72, 0.2] },
  // Havenhythe (new island — board-local)
  { name: "Havenhythe centre", game: [5800, 3100], uv: [0.847, 0.574] },
];

/** Affine coefficients: u = a*gx + b*gy + c ; v = d*gx + e*gy + f */
export type Affine6 = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

/** Least-squares affine fit from control landmarks. */
export function fitGeoref(controls = GEOREF_CONTROLS): Affine6 {
  // Solve normal equations for 3 params twice (u and v independently).
  let sxx = 0,
    sxy = 0,
    sx = 0,
    syy = 0,
    sy = 0,
    n = 0;
  let sux = 0,
    suy = 0,
    su = 0,
    svx = 0,
    svy = 0,
    sv = 0;
  for (const { game, uv } of controls) {
    const [x, y] = game;
    const [u, v] = uv;
    sxx += x * x;
    sxy += x * y;
    sx += x;
    syy += y * y;
    sy += y;
    n += 1;
    sux += u * x;
    suy += u * y;
    su += u;
    svx += v * x;
    svy += v * y;
    sv += v;
  }
  // 3x3 system for [a,b,c]
  const solve = (rx: number, ry: number, r1: number) => {
    // | sxx sxy sx | |a|   |rx|
    // | sxy syy sy | |b| = |ry|
    // | sx  sy  n  | |c|   |r1|
    const A = [
      [sxx, sxy, sx],
      [sxy, syy, sy],
      [sx, sy, n],
    ];
    const B = [rx, ry, r1];
    // Gaussian elimination
    const M = A.map((row, i) => [...row, B[i]]);
    for (let col = 0; col < 3; col++) {
      let piv = col;
      for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      [M[col], M[piv]] = [M[piv], M[col]];
      const div = M[col][col] || 1e-12;
      for (let c = col; c < 4; c++) M[col][c] /= div;
      for (let r = 0; r < 3; r++) {
        if (r === col) continue;
        const f = M[r][col];
        for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
      }
    }
    return [M[0][3], M[1][3], M[2][3]] as const;
  };
  const [a, b, c] = solve(sux, suy, su);
  const [d, e, f] = solve(svx, svy, sv);
  return { a, b, c, d, e, f };
}

export const BOARD_GEOREF: Affine6 = fitGeoref();

export function gameToUv(game: GameXY, fit: Affine6 = BOARD_GEOREF): BoardUV {
  const [x, y] = game;
  return [fit.a * x + fit.b * y + fit.c, fit.d * x + fit.e * y + fit.f];
}

/** Catalog of place → surface game coords (wiki / common knowledge). Only surface. */
export const PLACE_GAME_COORDS: ReadonlyMap<string, GameXY> = new Map(
  [
    ["Varrock", [3212, 3424]],
    ["Lumbridge", [3222, 3218]],
    ["Draynor Village", [3093, 3243]],
    ["Fort Forinthry", [3308, 3553]],
    ["Varrock Dig Site", [3360, 3420]],
    ["City of Um", [3200, 3160]],
    ["Wizards' Tower", [3109, 3157]],
    ["Edgeville", [3087, 3494]],
    ["Zanaris", [2440, 4435]],
    ["Falador", [2965, 3380]],
    ["Taverley", [2897, 3433]],
    ["Dwarven Mine", [3020, 3450]],
    ["Port Sarim", [3025, 3217]],
    ["Burthorpe", [2899, 3545]],
    ["Death Plateau", [2865, 3595]],
    ["Troll Stronghold", [2830, 3675]],
    ["Trollheim", [2885, 3675]],
    ["God Wars Dungeon", [2910, 3745]],
    ["Rimmington", [2957, 3215]],
    ["Entrana", [2834, 3335]],
    ["Ice Mountain", [3005, 3485]],
    ["Armadyl's Tower", [2830, 3300]],
    ["Piscatoris Fishing Colony", [2340, 3690]],
    ["Memorial to Guthix", [2360, 3520]],
    ["Hall of Memories", [2330, 3450]],
    ["Seers' Village", [2710, 3482]],
    ["Barbarian Outpost", [2520, 3570]],
    ["Catherby", [2809, 3434]],
    ["Tree Gnome Stronghold", [2460, 3440]],
    ["Fishing Guild", [2610, 3390]],
    ["Ourania Runecrafting Altar", [2465, 3245]],
    ["Ardougne", [2662, 3305]],
    ["Player-Owned Farm", [2560, 3260]],
    ["Warforge Dig Site", [2590, 3100]],
    ["Deep Sea Fishing Hub", [2520, 3050]],
    ["Stormguard Citadel Dig Site", [2680, 3350]],
    ["Temple of Ikov", [2650, 3380]],
    ["Howl's Floating Workshop", [2700, 3360]],
    ["Underground Pass", [2440, 3310]],
    ["Musa Point", [2950, 3145]],
    ["Brimhaven", [2760, 3170]],
    ["Hardwood Grove", [2820, 3080]],
    ["TzHaar City", [2450, 5120]],
    ["Tai Bwo Wannai", [2790, 3070]],
    ["Herblore Habitat", [2950, 2920]],
    ["Shilo Village", [2850, 2955]],
    ["Lunar Isle", [2110, 3910]],
    ["Livid Farm", [2115, 3940]],
    ["Neitiznot", [2330, 3800]],
    ["Jatizso", [2410, 3800]],
    ["Waterbirth Island", [2540, 3740]],
    ["Rellekka", [2670, 3661]],
    ["Miscellania", [2530, 3860]],
    ["Keldagrim", [2850, 3580]],
    ["Lava Flow Mine", [2930, 3520]],
    ["Wilderness Agility Course", [2998, 3931]],
    ["Mage Arena", [3105, 3930]],
    ["Wilderness Crater", [3135, 3820]],
    ["Mage of Zamorak", [3105, 3559]],
    ["Forinthry Dungeon", [3280, 3660]],
    ["Daemonheim", [3449, 3697]],
    ["Lava Maze", [3070, 3850]],
    ["Chaos Temple (Wilderness)", [3235, 3620]],
    ["Bandit Camp", [3030, 3700]],
    ["Rogues' Castle", [3285, 3930]],
    ["Demonic Ruins", [3290, 3880]],
    ["Frozen Waste Plateau", [2960, 3935]],
    ["Pirates' Hideout", [3040, 3950]],
    ["Al Kharid", [3293, 3184]],
    ["Garden of Kharid", [3320, 3150]],
    ["Kharid-et Dig Site", [3380, 3080]],
    ["Het's Oasis", [3360, 3120]],
    ["Sophanem", [3305, 2755]],
    ["Menaphos", [3180, 2740]],
    ["Slayer Tower", [3420, 3535]],
    ["Canifis", [3494, 3489]],
    ["Everlight Dig Site", [3700, 3400]],
    ["Port Phasmatys", [3680, 3485]],
    ["Araxyte Hive", [3550, 3350]],
    ["Darkmeyer", [3600, 3360]],
    ["Barrows", [3565, 3289]],
    ["Prifddinas", [2235, 3340]],
    ["Lost Grove", [2150, 3050]],
    ["Lletya", [2340, 3170]],
    ["Isafdar", [2200, 3200]],
    ["Port Tyras", [2180, 3120]],
    ["Anachronia base camp", [5400, 2400]],
    ["Orthen Dig Site", [5500, 2500]],
    ["Time altar", [5550, 2550]],
    ["Anachronia Agility Course", [5450, 2450]],
    ["Slayer Lodge", [5600, 2400]],
    ["Dream of Iaia", [5650, 2480]],
    ["Ranch Out of Time", [5480, 2300]],
  ].map(([name, xy]) => [name as string, xy as unknown as GameXY]),
);
