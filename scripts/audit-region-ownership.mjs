/**
 * Landmark plate-ownership audit for the main Gielinor block.
 *
 * Loads public/map/region-plates.json and checks that key surface points land
 * in the expected League region (league hardRules + classic frontiers).
 *
 *   node scripts/audit-region-ownership.mjs
 *
 * Exit 1 if any probe is BAD.
 *
 * Mainland focus — Anachronia / Havenhythe polish is out of scope here.
 * Frontier corridors live in scripts/build-map-terrain.mjs after Voronoi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATES = path.join(ROOT, "public/map/region-plates.json");

/** [name, x, y, expectedRegionId] */
const PROBES = [
  // ── Misthalin cores ──────────────────────────────────────────────────────
  ["Lumbridge", 3222, 3218, "misthalin"],
  ["Varrock", 3212, 3424, "misthalin"],
  ["Draynor", 3093, 3243, "misthalin"],
  ["Edgeville", 3087, 3494, "misthalin"],
  ["Dig Site", 3360, 3420, "misthalin"],
  ["Fort Forinthry", 3308, 3553, "misthalin"], // league hardRule
  ["Wizards Tower", 3109, 3157, "misthalin"],
  ["Varrock N", 3210, 3500, "misthalin"],
  ["Silvarea", 3370, 3450, "misthalin"],
  ["Paterdomus W", 3400, 3488, "misthalin"], // west bank of Salve
  ["Paterdomus temple", 3405, 3488, "misthalin"],
  ["Salve bridge E", 3430, 3485, "morytania"],
  ["Desert top N of Al Kharid", 3320, 3240, "desert"],
  ["Desert top E sand", 3380, 3280, "desert"],
  ["Varrock W corridor", 3100, 3420, "misthalin"],
  ["Draynor Manor", 3100, 3330, "misthalin"],

  // ── Asgarnia cores ───────────────────────────────────────────────────────
  ["Falador", 2965, 3380, "asgarnia"],
  ["Port Sarim", 3025, 3217, "asgarnia"],
  ["Taverley", 2897, 3433, "asgarnia"],
  ["Rimmington", 2957, 3215, "asgarnia"],
  ["Burthorpe", 2899, 3545, "asgarnia"],
  ["Ice Mountain", 3005, 3485, "asgarnia"],
  ["Crafting Guild", 2929, 3280, "asgarnia"],
  ["Falador East", 3050, 3370, "asgarnia"],
  ["Barb Village", 3080, 3420, "asgarnia"],
  ["Desert NE of oasis", 3400, 3280, "desert"],
  ["Desert N band", 3420, 3260, "desert"],
  ["Mory W of Mortton", 3460, 3280, "morytania"],
  ["Abandoned Mine", 3441, 3233, "morytania"],
  ["White Wolf", 2870, 3480, "asgarnia"],
  ["Taverley W ridge", 2860, 3430, "asgarnia"],

  // ── Kandarin cores ───────────────────────────────────────────────────────
  ["Ardougne", 2662, 3305, "kandarin"],
  ["Seers", 2710, 3482, "kandarin"],
  ["Catherby", 2809, 3434, "kandarin"],
  ["Gnome Stronghold", 2460, 3440, "kandarin"],
  ["Yanille", 2606, 3092, "kandarin"],
  ["Feldip", 2550, 2920, "kandarin"],
  ["Arandar gate", 2345, 3283, "kandarin"],
  ["Catherby approach", 2820, 3440, "kandarin"],

  // ── Forinthry (wildy body — not Fort) ────────────────────────────────────
  ["Wilderness ditch N", 3100, 3550, "forinthry"],
  ["Mage of Zamorak", 3105, 3559, "forinthry"],
  ["Forinthry Dungeon", 3280, 3660, "forinthry"],
  ["Daemonheim", 3449, 3697, "forinthry"],
  ["Wilderness Crater", 3135, 3820, "forinthry"],

  // ── Morytania east of Salve ──────────────────────────────────────────────
  ["Canifis", 3494, 3489, "morytania"],
  ["Mortton", 3491, 3287, "morytania"],
  ["Barrows", 3565, 3289, "morytania"],
  ["Canifis W", 3460, 3490, "morytania"],
  ["Burgh approach", 3490, 3210, "morytania"],

  // ── Desert ───────────────────────────────────────────────────────────────
  ["Al Kharid", 3293, 3184, "desert"],
  ["Hets Oasis", 3360, 3120, "desert"],
  ["Oasis N edge", 3380, 3210, "desert"],
  ["Shantay band", 3304, 3125, "desert"],
  ["Garden of Kharid", 3320, 3150, "desert"],

  // ── Karamja ──────────────────────────────────────────────────────────────
  ["Musa Point", 2950, 3145, "karamja"],
  ["Brimhaven", 2760, 3170, "karamja"],
  ["TzHaar", 2845, 3172, "karamja"],
  ["Crandor centre", 2835, 3255, "karamja"],
  ["Crandor N", 2835, 3275, "karamja"],
  ["Crandor S", 2835, 3240, "karamja"],
  ["Entrana (not Crandor)", 2834, 3335, "asgarnia"],

  // ── Tirannwn ─────────────────────────────────────────────────────────────
  ["Prifddinas", 2235, 3340, "tirannwn"],
  ["Isafdar", 2200, 3200, "tirannwn"],
  ["LG island", 1980, 3150, "tirannwn"],

  // ── Soul Wars / Ashdale ──────────────────────────────────────────────────
  ["Soul Wars", 2200, 2910, "misthalin"],
  ["Ashdale", 2494, 2688, "asgarnia"],

  // =========================================================================
  // EXPANDED FRONTIER PROBES (mainland ownership audit)
  // =========================================================================

  // ── Misthalin–Asgarnia west edge ─────────────────────────────────────────
  // Corridor cut: asg x<=3083, mist x>=3088 (build-map-terrain.mjs).
  ["Draynor W market", 3080, 3250, "misthalin"],
  ["Draynor S bank", 3090, 3220, "misthalin"],
  ["Draynor NW road", 3070, 3280, "misthalin"],
  ["Draynor market N", 3082, 3265, "misthalin"],
  ["Draynor willow bank", 3085, 3235, "misthalin"],
  ["Port Sarim NE land", 3040, 3240, "asgarnia"],
  ["Port Sarim E dock", 3050, 3205, "asgarnia"],
  ["Falador–Varrock road mid", 3060, 3390, "asgarnia"],
  ["Barb Village centre", 3080, 3420, "asgarnia"],
  ["Barb Village E fence", 3085, 3420, "asgarnia"],
  ["Barb Village SE", 3082, 3400, "asgarnia"],
  ["Barb Village NE", 3082, 3445, "asgarnia"],
  ["Just E of Barb (mist)", 3095, 3420, "misthalin"],
  ["Just E of Barb N", 3095, 3450, "misthalin"],
  ["Just E of Barb S", 3095, 3380, "misthalin"],
  ["Ice Mtn summit", 3005, 3485, "asgarnia"],
  ["Ice Mtn E slope", 3040, 3485, "asgarnia"],
  ["Ice Mtn far E", 3065, 3480, "asgarnia"],
  ["Ice Mtn SE toward BV", 3055, 3450, "asgarnia"],
  ["Edgeville W ditch approach", 3065, 3505, "asgarnia"],
  ["Edgeville W bank", 3075, 3494, "misthalin"],
  ["Edgeville W houses", 3078, 3490, "misthalin"],
  ["Edgeville centre", 3087, 3494, "misthalin"],
  ["Edgeville E", 3105, 3490, "misthalin"],
  ["Grand Exchange W", 3145, 3490, "misthalin"],
  ["Black Knights F approach", 3025, 3510, "asgarnia"],
  ["Dwarven Mine surface", 3020, 3450, "asgarnia"],
  ["Artisans Workshop", 3049, 3340, "asgarnia"],
  ["Mining Guild surface", 3020, 3339, "asgarnia"],
  ["Falador Park E", 3020, 3375, "asgarnia"],
  ["Goblin Village", 2955, 3505, "asgarnia"],
  ["Monastery (Edge W)", 3055, 3490, "asgarnia"],

  // ── Misthalin–Forinthry (ditch; Fort stays Misthalin) ─────────────────────
  // Ditch ~y 3521–3525; Fort Forinthry is league hardRule = misthalin.
  ["Edgeville ditch S bank", 3087, 3518, "misthalin"],
  ["Edgeville ditch N bank", 3087, 3528, "forinthry"],
  ["GE ditch S", 3160, 3515, "misthalin"],
  ["GE ditch N", 3160, 3528, "forinthry"],
  ["GE ditch N+20", 3160, 3545, "forinthry"],
  ["Varrock ditch S", 3210, 3515, "misthalin"],
  ["Varrock ditch N", 3210, 3528, "forinthry"],
  ["Varrock ditch N+20", 3210, 3545, "forinthry"],
  ["Silvarea ditch S", 3340, 3515, "misthalin"],
  ["Silvarea ditch N", 3340, 3530, "forinthry"],
  ["Silvarea ditch N+25", 3340, 3550, "forinthry"],
  ["Fort Forinthry gate", 3300, 3545, "misthalin"],
  ["Fort Forinthry keep", 3308, 3553, "misthalin"],
  ["Fort SE approach", 3320, 3535, "misthalin"],
  ["Fort W wildy fringe", 3280, 3565, "forinthry"], // outside fort footprint
  ["Fort N wildy", 3308, 3580, "forinthry"],
  ["Fort N+40 wildy", 3308, 3600, "forinthry"],
  ["Chaos Temple wildy", 3235, 3620, "forinthry"],
  ["Lvl 1 wildy Edge N", 3095, 3540, "forinthry"],
  ["Obelisk low wildy", 3150, 3620, "forinthry"],

  // ── Misthalin–Desert (Al Kharid gate, digsite S/SE, Lumbridge swamp) ─────
  // Desert force up to y≤3382; dig hill y≥3385; Exam Centre blob ~[3362,3339].
  ["Al Kharid gate desert", 3290, 3225, "desert"],
  // West of the gate (Lumbridge side) = Misthalin; east stays Desert.
  ["Al Kharid gate mist W", 3255, 3228, "misthalin"],
  ["Al Kharid gate desert E", 3280, 3227, "desert"],
  // North of Al Kharid city toward Dig Site scrub — desert until dig hill / exam.
  ["Al Kharid N scrub", 3300, 3250, "desert"],
  ["Al Kharid palace", 3293, 3170, "desert"],
  ["Al Kharid NW wall", 3275, 3200, "desert"],
  ["Lumbridge E swamp", 3240, 3180, "misthalin"],
  ["Lumbridge swamp S", 3205, 3165, "misthalin"],
  ["Lumbridge SE river", 3255, 3200, "misthalin"],
  ["Cabbage patch band", 3260, 3270, "misthalin"], // Lumbridge-side west approach
  ["Dig Site core", 3360, 3420, "misthalin"],
  ["Dig Site hill S", 3360, 3395, "misthalin"],
  ["Exam Centre", 3362, 3340, "misthalin"],
  ["Desert top mid", 3360, 3300, "desert"],
  // Northern Kharidian sand — desert west/east of the narrow Exam corridor.
  ["Desert top high W", 3320, 3360, "desert"],
  ["Desert top high E", 3392, 3345, "desert"], // just W of Salve strip, S of dig hill
  ["Desert under dig W", 3325, 3375, "desert"], // west of Exam corridor
  ["Exam corridor mid", 3360, 3375, "misthalin"],
  ["Oasis NE sand", 3400, 3280, "desert"],
  ["Dig Site E ridge", 3395, 3365, "misthalin"], // Salve west-bank strip
  ["Senntisten approach", 3350, 3400, "misthalin"],
  ["Desert N of AK", 3320, 3240, "desert"],
  ["Desert NE finger", 3395, 3270, "desert"],
  ["Oasis far N sand", 3370, 3220, "desert"],
  ["Kharid-et dig", 3380, 3080, "desert"],
  ["Uzer path N", 3480, 3100, "desert"],

  // ── Misthalin–Morytania (Salve, Paterdomus, Silvarea, Canifis W) ─────────
  // Salve: river strip x≥3390 y≥3360; inland mist x<3390 y≥3390.
  ["Silvarea path", 3375, 3465, "misthalin"],
  ["Silvarea E ridge", 3395, 3470, "misthalin"],
  ["Paterdomus W bank", 3400, 3488, "misthalin"],
  ["Paterdomus temple door", 3410, 3488, "misthalin"],
  ["Salve west bank mid", 3410, 3450, "misthalin"],
  ["Salve west bank S", 3410, 3380, "misthalin"],
  ["Salve bridge mid", 3425, 3485, "morytania"],
  ["Salve east bank", 3435, 3485, "morytania"],
  ["Mort Myre W edge", 3440, 3400, "morytania"], // Temple Trekking coord
  ["Canifis W road", 3450, 3485, "morytania"],
  ["Canifis W gate area", 3470, 3490, "morytania"],
  ["Slayer Tower door", 3420, 3535, "morytania"],
  ["Haunted Woods W", 3520, 3480, "morytania"],
  ["Mort Myre centre", 3480, 3360, "morytania"],
  ["Nature Grotto approach", 3440, 3335, "morytania"],
  ["Burgh de Rott N", 3490, 3230, "morytania"],
  ["Burgh de Rott", 3490, 3210, "morytania"],
  ["Mine NW of Burgh", 3445, 3245, "morytania"],

  // ── Mory–Desert river/sand contact (no fingers either way) ───────────────
  // Piecewise cut in build-map-terrain.mjs: desert W/S, mory E/N of ~x 3440.
  ["Mine core", 3441, 3233, "morytania"],
  ["Mine W sand", 3430, 3210, "desert"], // no mory finger into orange sand
  ["Mine SW scrub", 3430, 3230, "desert"], // land tile (river gap is water)
  ["N of mine scrub", 3435, 3255, "desert"], // west of vertical cut @3440
  ["N of mine mory", 3445, 3255, "morytania"],
  ["Desert finger ban", 3440, 3295, "morytania"], // was multi-flip desert hole
  ["Mort Myre SW solid", 3445, 3310, "morytania"],
  ["Mortton W approach", 3460, 3280, "morytania"],
  ["Burgh SW dune", 3460, 3185, "desert"], // dunes SW of Burgh stay desert
  ["Burgh W approach", 3475, 3210, "morytania"],
  ["Uzer N dunes", 3450, 3150, "desert"], // land on northern dune tongue
  ["Het N sand tongue", 3410, 3240, "desert"],
  ["Contact mid river", 3440, 3235, "morytania"], // on/just E of cut near mine
  ["Contact cut N", 3435, 3280, "desert"],
  ["Contact cut N mory", 3445, 3280, "morytania"],

  // ── Asgarnia–Kandarin (White Wolf, Catherby E, Taverley W) ───────────────
  ["White Wolf summit", 2870, 3480, "asgarnia"],
  ["White Wolf E (Tav)", 2885, 3480, "asgarnia"],
  ["White Wolf W slope", 2850, 3480, "asgarnia"],
  ["White Wolf far W", 2835, 3475, "kandarin"], // Catherby side of pass
  ["Catherby town", 2809, 3434, "kandarin"],
  ["Catherby E land", 2825, 3445, "kandarin"],
  ["Catherby NE ridge", 2845, 3450, "kandarin"],
  ["Catherby–WW pass W", 2840, 3465, "kandarin"],
  ["Taverley W gate", 2865, 3430, "asgarnia"],
  ["Taverley centre", 2897, 3433, "asgarnia"],
  ["Taverley dungeon mouth", 2884, 3398, "asgarnia"],
  ["Camelot approach E", 2760, 3480, "kandarin"],
  ["Seers E road", 2750, 3485, "kandarin"],
  ["Fishing Guild", 2610, 3390, "kandarin"],
  ["Ranging Guild", 2667, 3426, "kandarin"],
  ["Burthorpe W ridge", 2870, 3550, "asgarnia"],
  ["Death Plateau", 2865, 3595, "asgarnia"],

  // ── Asgarnia–Karamja (Musa, Rimmington S) ────────────────────────────────
  ["Rimmington centre", 2957, 3215, "asgarnia"],
  ["Rimmington S houses", 2957, 3195, "asgarnia"],
  ["Rimmington SW land", 2940, 3200, "asgarnia"],
  ["Port Sarim S pier", 3025, 3195, "asgarnia"],
  ["Musa Point dock", 2950, 3145, "karamja"],
  ["Musa Point banana", 2920, 3155, "karamja"],
  ["Musa Point inland", 2880, 3150, "karamja"],
  ["Karamja volcano N", 2855, 3165, "karamja"],
  ["Karamja general store", 2900, 3148, "karamja"],

  // ── Kandarin–Karamja (Brimhaven N, Yanille S) ────────────────────────────
  ["Brimhaven centre", 2760, 3170, "karamja"],
  ["Brimhaven N dock", 2760, 3200, "karamja"],
  ["Brimhaven NE coast", 2790, 3205, "karamja"],
  ["Brimhaven Agility", 2809, 3193, "karamja"],
  ["Tai Bwo Wannai", 2790, 3070, "karamja"],
  ["Yanille centre", 2606, 3092, "kandarin"],
  ["Yanille S wall", 2606, 3070, "kandarin"],
  ["Yanille SE", 2630, 3080, "kandarin"],
  ["Warforge dig", 2590, 3100, "kandarin"],
  ["Feldip N approach", 2550, 3000, "kandarin"],
  ["Castle Wars approach", 2440, 3090, "kandarin"],
  ["Port Khazard", 2660, 3165, "kandarin"],

  // ── Kandarin–Tirannwn (Arandar) ──────────────────────────────────────────
  // Gate ~2345,3283 Kandarin; west of pass = Tirannwn.
  ["Arandar gate plaza", 2345, 3283, "kandarin"],
  ["Arandar E approach", 2365, 3290, "kandarin"],
  ["Arandar pass mid", 2330, 3280, "kandarin"], // still Kandarin-owned pass
  ["Arandar pass E half", 2338, 3285, "kandarin"],
  ["Arandar W of pass", 2305, 3275, "tirannwn"],
  ["Lletya", 2340, 3170, "tirannwn"],
  ["Isafdar SE rock", 2320, 3090, "tirannwn"],
  ["Port Tyras", 2180, 3120, "tirannwn"],
  ["Prif S gate", 2240, 3300, "tirannwn"],
  ["Ourania altar", 2465, 3245, "kandarin"],
  ["Underground Pass mouth", 2440, 3310, "kandarin"],

  // ── Forinthry–Fremennik / N Asgarnia fringe ──────────────────────────────
  ["Rellekka", 2670, 3661, "fremennik"],
  ["Rellekka SE approach", 2700, 3620, "fremennik"],
  ["Keldagrim entrance", 2850, 3580, "fremennik"],
  ["Lava Flow Mine", 2930, 3520, "asgarnia"], // surface near Ice/Black Knights
  ["Trollheim", 2885, 3675, "asgarnia"],
  ["Troll Stronghold", 2830, 3675, "asgarnia"],
  ["GWD approach", 2910, 3745, "asgarnia"],
  ["Wildy W of GWD", 2980, 3750, "forinthry"],
  ["Frozen Waste", 2960, 3935, "forinthry"],
  ["Bandit Camp wildy", 3030, 3700, "forinthry"],
  ["Waterbirth", 2540, 3740, "fremennik"],
  ["Barbarian Outpost", 2520, 3570, "kandarin"],
];

function ownAt(plates, x, y) {
  for (const [region, data] of Object.entries(plates.regions)) {
    for (const flat of data.rings) {
      let inside = false;
      const n = flat.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = flat[i * 2];
        const yi = flat[i * 2 + 1];
        const xj = flat[j * 2];
        const yj = flat[j * 2 + 1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) {
          inside = !inside;
        }
      }
      if (inside) return region;
    }
  }
  return "WATER";
}

const plates = JSON.parse(fs.readFileSync(PLATES, "utf8"));
let bad = 0;
const rows = [];
for (const [name, x, y, exp] of PROBES) {
  const got = ownAt(plates, x, y);
  const ok = got === exp;
  if (!ok) bad++;
  rows.push({ ok, name, x, y, got, exp });
  console.log(`${ok ? "OK " : "BAD"}  ${name.padEnd(28)} got ${got.padEnd(12)} want ${exp}`);
}
console.log(`\n${bad === 0 ? "PASS" : "FAIL"}: ${bad} bad of ${PROBES.length}`);

if (bad > 0) {
  console.log("\n── BAD SUMMARY ──");
  for (const r of rows.filter((r) => !r.ok)) {
    console.log(`  ${r.name} @ (${r.x},${r.y}): got ${r.got}, want ${r.exp}`);
  }
}

/**
 * Dense grid scan over locked frontier boxes. Each rule returns the expected
 * region for a land sample, or null to skip. Counts are advisory in the log;
 * only landmark PROBES fail the process (grid catches regressions between pins).
 */
const GRIDS = [
  {
    name: "Misth/Desert dig SE",
    x0: 3240, x1: 3420, y0: 3200, y1: 3400, step: 10,
    expect: (x, y) => {
      // Dig hill + narrow Exam corridor — not a sand blanket.
      if (y >= 3385 && x >= 3320 && x <= 3395) return "misthalin";
      if (y >= 3328 && y < 3385 && x >= 3340 && x <= 3385) return "misthalin";
      // Salve true west-bank strip.
      if (x >= 3390 && x <= 3416 && y >= 3360) return "misthalin";
      // Lumbridge side of Al Kharid gate is mist (west approach corridor).
      if (x <= 3275 && y >= 3215 && y <= 3275) return "misthalin";
      // Northern sand is desert up to dig hill (west/east of exam corridor).
      if (y <= 3382 && y >= 3200 && x >= 3260 && x < 3390) {
        if (y >= 3328 && y < 3385 && x >= 3340 && x <= 3385) return "misthalin";
        return "desert";
      }
      if (x >= 3390 && x < 3440 && y <= 3324 && y >= 3200) return "desert";
      return null;
    },
  },
  {
    // Stop south of the wildy ditch; north of ~3525 is Forinthry, not Salve mist.
    // Inland west of river is mist only for y≥3390; low-y west sand is desert.
    name: "Salve banks",
    x0: 3360, x1: 3500, y0: 3360, y1: 3520, step: 10,
    expect: (x, y) => {
      if (x >= 3420) return "morytania";
      if (x >= 3390 && x <= 3416) return "misthalin";
      if (x < 3390 && y >= 3390) return "misthalin";
      // Exam corridor: narrow mist finger dig hill → Exam Centre.
      if (x >= 3340 && x <= 3385 && y >= 3328 && y < 3385) return "misthalin";
      if (x < 3390 && y < 3385) return "desert";
      return null;
    },
  },
  {
    // Cap below the ditch so Forinthry samples do not pollute the Asg/Mist cut.
    name: "Asg/Mist latitude cut",
    x0: 3000, x1: 3180, y0: 3180, y1: 3510, step: 10,
    expect: (x, y) => {
      if (y < 3360) {
        if (x <= 3062) return "asgarnia";
        if (x >= 3068) return "misthalin";
      } else if (y < 3470) {
        if (x <= 3085) return "asgarnia";
        if (x >= 3090) return "misthalin";
      } else {
        if (x <= 3065) return "asgarnia";
        if (x >= 3070) return "misthalin";
      }
      return null;
    },
  },
  {
    // Fremennik fringe starts ~y 3540 north of White Wolf — keep grid on the pass.
    name: "White Wolf Asg/Kand",
    x0: 2780, x1: 2920, y0: 3400, y1: 3530, step: 10,
    expect: (x, y) => {
      if (x <= 2846) return "kandarin";
      if (x >= 2850) return "asgarnia";
      return null;
    },
  },
  {
    name: "Musa channel Asg/Kara",
    x0: 2860, x1: 3060, y0: 3100, y1: 3220, step: 10,
    expect: (x, y) => {
      if (x <= 2975 && y <= 3188) return "karamja";
      if (x >= 2988) return "asgarnia";
      return null;
    },
  },
  {
    name: "Yanille/Brimhaven Kand/Kara",
    x0: 2520, x1: 2840, y0: 3000, y1: 3220, step: 12,
    expect: (x, y) => {
      if (x <= 2685 && y <= 3185) return "kandarin";
      if (x >= 2720 && y >= 3120) return "karamja";
      return null;
    },
  },
  {
    // Forinthry body west of the Salve; Mory keeps x≥3375 near Slayer Tower.
    name: "Wildy ditch + Fort",
    x0: 3065, x1: 3365, y0: 3485, y1: 3600, step: 10,
    expect: (x, y) => {
      if (x >= 3288 && x <= 3336 && y >= 3524 && y <= 3572) return "misthalin";
      if (y <= 3522 && x >= 3075) return "misthalin";
      if (y >= 3526) return "forinthry";
      return null;
    },
  },
  {
    // Mory–Desert contact: piecewise xCut mirrors build-map-terrain.mjs.
    // Desert west/south of cut; mory east/north. ±2 tile deadband on the cut
    // absorbs plate-ring simplify drift; water samples are skipped.
    name: "Mory/Desert contact",
    x0: 3405,
    x1: 3520,
    y0: 3175,
    y1: 3315,
    step: 8,
    expect: (x, y) => {
      let xCut;
      if (y >= 3260) xCut = 3440;
      else if (y >= 3220) xCut = 3440 - (3260 - y) * 0.1;
      else xCut = 3436 + ((3220 - y) / 45) * 49;
      if (Math.abs(x - xCut) <= 2) return null;
      return x + 0.5 < xCut ? "desert" : "morytania";
    },
  },
];

let gridBad = 0;
console.log("\n── FRONTIER GRID SCAN ──");
for (const g of GRIDS) {
  let samples = 0;
  let fails = 0;
  const examples = [];
  for (let y = g.y0; y <= g.y1; y += g.step) {
    for (let x = g.x0; x <= g.x1; x += g.step) {
      const exp = g.expect(x, y);
      if (!exp) continue;
      const got = ownAt(plates, x, y);
      if (got === "WATER") continue;
      samples++;
      if (got !== exp) {
        fails++;
        gridBad++;
        if (examples.length < 6) examples.push(`${x},${y} got ${got} want ${exp}`);
      }
    }
  }
  const tag = fails === 0 ? "OK " : "BAD";
  console.log(`${tag}  ${g.name.padEnd(28)} ${fails} fail / ${samples} land`);
  for (const e of examples) console.log(`      ${e}`);
}
console.log(
  gridBad === 0
    ? `\nGRID PASS: 0 wedge samples`
    : `\nGRID FAIL: ${gridBad} wedge samples (probes are the exit gate; grid is diagnostic)`,
);

// Landmark probes are the hard gate; grid is printed for corridor tuning.
process.exit(bad === 0 ? 0 : 1);
