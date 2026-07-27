/**
 * Landmark plate-ownership audit for the main Gielinor block.
 *
 * Loads public/map/region-plates.json and checks that key surface points land
 * in the expected League region (league hardRules + classic frontiers).
 *
 *   node scripts/audit-region-ownership.mjs
 *
 * Exit 1 if any probe is BAD.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATES = path.join(ROOT, "public/map/region-plates.json");

/** [name, x, y, expectedRegionId] */
const PROBES = [
  // Misthalin cores
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
  ["Draynor Manor", 3100, 3330, "misthalin"],

  // Asgarnia cores
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
  ["White Wolf", 2870, 3480, "asgarnia"],
  ["Taverley W ridge", 2860, 3430, "asgarnia"],

  // Kandarin cores
  ["Ardougne", 2662, 3305, "kandarin"],
  ["Seers", 2710, 3482, "kandarin"],
  ["Catherby", 2809, 3434, "kandarin"],
  ["Gnome Stronghold", 2460, 3440, "kandarin"],
  ["Yanille", 2606, 3092, "kandarin"],
  ["Feldip", 2550, 2920, "kandarin"],
  ["Arandar gate", 2345, 3283, "kandarin"],
  ["Catherby approach", 2820, 3440, "kandarin"],

  // Forinthry (wildy body — not Fort)
  ["Wilderness ditch N", 3100, 3550, "forinthry"],
  ["Mage of Zamorak", 3105, 3559, "forinthry"],
  ["Forinthry Dungeon", 3280, 3660, "forinthry"],
  ["Daemonheim", 3449, 3697, "forinthry"],
  ["Wilderness Crater", 3135, 3820, "forinthry"],

  // Morytania east of Salve
  ["Canifis", 3494, 3489, "morytania"],
  ["Mortton", 3491, 3287, "morytania"],
  ["Barrows", 3565, 3289, "morytania"],
  ["Canifis W", 3460, 3490, "morytania"],
  ["Burgh approach", 3490, 3210, "morytania"],

  // Desert
  ["Al Kharid", 3293, 3184, "desert"],
  ["Hets Oasis", 3360, 3120, "desert"],
  ["Oasis N edge", 3380, 3210, "desert"],
  ["Shantay band", 3304, 3125, "desert"],
  ["Garden of Kharid", 3320, 3150, "desert"],

  // Karamja
  ["Musa Point", 2950, 3145, "karamja"],
  ["Brimhaven", 2760, 3170, "karamja"],
  ["TzHaar", 2845, 3172, "karamja"],

  // Tirannwn (already remapped)
  ["Prifddinas", 2235, 3340, "tirannwn"],
  ["Isafdar", 2200, 3200, "tirannwn"],
  ["LG island", 1980, 3150, "tirannwn"],

  // Soul Wars / Ashdale
  ["Soul Wars", 2200, 2910, "misthalin"],
  ["Ashdale", 2494, 2688, "asgarnia"],
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
  console.log(`${ok ? "OK " : "BAD"}  ${name.padEnd(22)} got ${got.padEnd(12)} want ${exp}`);
}
console.log(`\n${bad === 0 ? "PASS" : "FAIL"}: ${bad} bad of ${PROBES.length}`);
process.exit(bad === 0 ? 0 : 1);
