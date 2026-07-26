/**
 * Wave 2: re-kill skip list, clamp multi-req hosts, home empty-req, dedupe.
 * Run until walls only remain.
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

const REMOVE_ALL = [
  "Hoardstalker ring",
  "Learn broad arrow / bolt fletching (300 Spayer points)",
  "Learn broad arrow / bolt fletching (300 Slayer points)",
  "Learn quicker killing blows (400 Slayer points)",
  "Games necklace teleport package",
  "Ring of duelling",
  "Cremation ability unlock",
  "Ore box tier upgrades",
  "Herb patch network (global herb-run map)",
  "GOTE + Dark Facet of Grace + ancient elven ritual shard sustain",
  "GOTE gather + porter sustain checklist",
  "Signs of the porter (Divination supply system)",
  "Fury shark outfit + Bait and Switch Fishing stack",
  "Grace of the elves / signs of the porter supply chain",
  "Slayer prefer / block / extend (Assignment Rewards)",
  "Prefer / block slot ladder (quest-point scaled)",
  "Mattock tier ladder (bronze through elder rune + specials)",
  "Curly roots Firemaking ceiling stack (Jadinko + All Fired Up gear)",
  "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
  "Cooking dual-brewery network (Keldagrim + Phasmatys)",
  "Igneous cape progression",
  "Prifddinas spirit tree + Glouron three-tree unlock",
  "Aquarium room + Prawn Perks",
  "Player-owned house Aquarium and Prawnbroker",
  "Nimble outfit (The Pit Agility XP set)",
  "Silverhawk boots (Agility XP from feathers/down)",
  "Thaler skilling rewards hub (Stanley Limelight Traders)",
  "Portable skilling stations (ironman craft/deployment permanent note)",
  "Skills necklace (guild teleports)",
  "Gemstone golem outfit",
  "Nature's sentinel outfit",
  "Nature's Sentinel outfit",
  "Elder divination outfit",
  "Infinity ethereal outfit",
  "Magic golem outfit",
  "Fletcher's outfit",
  "Master constructor's outfit",
  "Witchdoctor camo outfit",
  "Ring of slaying (equipment residual)",
];

const PRIMARY = {
  "Velucia museum Archaeology collections": "misthalin",
  "Construction Contracts (estate agents)": "misthalin",
  "Prayer training infrastructure stack (altars + powders + books)": "misthalin",
  "Dragon hatchet (Dagannoth Kings pressure)": "fremennik",
  "Seedicide collector upgrade": "kandarin",
  "Toolbelt attach: Seedicide": "kandarin",
  "Always Adze (Seed of the Charyou Tree)": "kandarin",
  "Auto-burn Woodcutting paths (Superheat Form vs Always Adze vs partial outfit/adze)":
    "kandarin",
  "Invention Guild named machine room": "asgarnia",
  "Invention Guild workshop and machines": "asgarnia",
  "Invention Guild machines and research": "asgarnia",
  "Auto-screener v1.080": "asgarnia",
  "Sticky Fingers (Archaeology relic)": "misthalin",
  "Asylum surgeon's ring": "misthalin",
  "Ectoplasmator (base)": "morytania",
  "Ungael ritual site pressure": "fremennik",
  "Master farmer outfit is not a Desert unlock": "kandarin",
  "Abyssal Link (The Subtle Blade)": "kandarin",
  "Bait and Switch + Always Adze dual monolith skilling paths": "anachronia",
  "Crystal fishing rod": "tirannwn",
  "Grasping rune pouch": "forinthry",
  "Fairy ring network (Zanaris hub)": null, // multi handled below
  "Volcanic trapper outfit": "anachronia",
};

/** Multi-req: keep only these hosts (and set requiredRegions). */
const MULTI_KEEP = {
  "Fairy ring network (Zanaris hub)": ["misthalin", "morytania"],
  "Elite skilling outfits core set (ironman fragment paths)": [
    "kandarin",
    "forinthry",
    "anachronia",
    "desert",
    "tirannwn",
    "fremennik",
    "asgarnia",
  ],
  "Pickaxe of Life and Death": ["fremennik", "tirannwn", "asgarnia"],
  "Imcando tools family (pickaxe, hatchet, related craft pressure)": [
    "fremennik",
    "misthalin",
    "asgarnia",
  ],
  "Blessed flask production chain": [
    "desert",
    "morytania",
    "tirannwn",
    "forinthry",
  ],
  "Mattock of Time and Space": [
    "tirannwn",
    "misthalin",
    "kandarin",
    "anachronia",
  ],
  "Pickaxe of Earth and Song": ["fremennik", "tirannwn", "kandarin"],
  "Orthen furnace core + Superheat Form + smithing autoheater stack": [
    "anachronia",
    "tirannwn",
    "forinthry",
  ],
  "Orthen furnace core full skilling stack": [
    "anachronia",
    "tirannwn",
    "forinthry",
  ],
  "Masterwork plate → Orthen furnace core pressure stack": [
    "forinthry",
    "desert",
    "anachronia",
    "asgarnia",
  ],
  "Hatchet of Bloom and Blight": [
    "tirannwn",
    "misthalin",
    "asgarnia",
    "fremennik",
    "desert",
    "morytania",
  ],
  "Hatchet of Ember and Glade": [
    "forinthry",
    "tirannwn",
    "fremennik",
    "asgarnia",
  ],
  "Slayer Introspection (Amascut's Enchanted Gem)": [
    "kandarin",
    "morytania",
    "desert",
  ],
  "Perfect juju potion production path": ["karamja", "tirannwn"],
  "All Fired Up → Inferno adze reward chain": ["forinthry", "asgarnia"],
  "Death Ward relic chain": ["asgarnia", "kandarin"],
  "Balarak's sash brush": ["forinthry", "anachronia"],
  "Skeka's hypnowand": ["forinthry", "anachronia"],
  "Grace of the elves (GOTE)": ["forinthry", "tirannwn"],
  "Dark Facet of Grace (GOTE enchantment)": ["forinthry"],
  "POH gilded altar (Chapel offering)": [
    "fremennik",
    "tirannwn",
    "forinthry",
    "misthalin",
  ],
  "Area Tasks (achievement diaries) skilling overview": [
    "misthalin",
    "karamja",
    "asgarnia",
    "kandarin",
    "fremennik",
    "forinthry",
    "desert",
    "morytania",
    "tirannwn",
  ],
};

function removeAll(name) {
  let c = 0;
  for (const r of cat.regions) {
    const b = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
    c += b - r.upgrades.length;
  }
  if (c) log.push(`REMOVE ${c}× ${name}`);
}

function keepHosts(name, hosts, req) {
  const allow = new Set(hosts);
  const reqList = req || hosts;
  let template = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) {
      template = JSON.parse(JSON.stringify(u));
      break;
    }
  }
  if (!template) return;
  for (const r of cat.regions) {
    const idx = r.upgrades.findIndex((x) => x.name === name);
    if (allow.has(r.id)) {
      if (idx < 0) {
        const copy = JSON.parse(JSON.stringify(template));
        copy.regionId = r.id;
        copy.requiredRegions = [...reqList];
        r.upgrades.push(copy);
      } else {
        r.upgrades[idx].regionId = r.id;
        r.upgrades[idx].requiredRegions = [...reqList];
      }
    } else if (idx >= 0) {
      r.upgrades.splice(idx, 1);
    }
  }
  log.push(`KEEP ${name} → [${hosts.join(",")}]`);
}

// 1 remove-all
for (const n of REMOVE_ALL) removeAll(n);

// 2 primary
for (const [name, home] of Object.entries(PRIMARY)) {
  if (!home) continue;
  keepHosts(name, [home], [home]);
}

// 3 multi keep
for (const [name, hosts] of Object.entries(MULTI_KEEP)) {
  keepHosts(name, hosts, hosts);
}

// 4 clamp: any remaining multi-req — drop hosts outside requiredRegions
for (const r of cat.regions) {
  // nothing: need global pass by name
}
const byName = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!byName.has(u.name)) byName.set(u.name, []);
    byName.get(u.name).push({ r, u });
  }
}
for (const [name, copies] of byName) {
  if (copies.length < 2) continue;
  const reqs = copies.map((c) => c.u.requiredRegions || []).filter((x) => x.length);
  if (!reqs.length) continue;
  // if all same multi-req
  const req = reqs[0];
  if (req.length < 2) continue;
  const same = reqs.every(
    (r) => r.length === req.length && r.every((id) => req.includes(id)),
  );
  if (!same) continue;
  if (MULTI_KEEP[name] || PRIMARY[name]) continue;
  for (const { r, u } of copies) {
    if (!req.includes(r.id)) {
      r.upgrades = r.upgrades.filter((x) => x !== u);
      log.push(`CLAMP drop ${r.id} ${name}`);
    }
  }
}

// 5 fence dedupe
const stats = dedupeRegionUpgrades(cat);
log.push(`DEDUPE ${JSON.stringify(stats)}`);

// Nature sentinel case dup
removeAll("Nature's Sentinel outfit");

fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");

// metrics
const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (/^Herb patches \(\d+\)$/.test(u.name)) continue;
    if (!map.has(u.name)) map.set(u.name, { hosts: [], req: u.requiredRegions || [] });
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
    if ((u.requiredRegions || []).length) e.req = u.requiredRegions;
  }
}
const multi = [...map.values()].filter((e) => e.hosts.length > 1);
const empty = multi.filter((e) => !e.req.length);
const poll = multi.filter((e) => e.req.length === 1);
const outside = multi.filter(
  (e) => e.req.length > 1 && e.hosts.some((h) => !e.req.includes(h)),
);

const report = {
  log: log.slice(0, 80),
  logLines: log.length,
  metrics: {
    totalUpgrades: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
    multiHost: multi.length,
    emptyReqMulti: empty.length,
    singleReqPollution: poll.length,
    multiReqOutside: outside.length,
  },
  emptyReqRemaining: empty.map((e) => ({ name: e.name, hosts: e.hosts })),
  multiReqOutsideRemaining: outside.map((e) => ({
    name: e.name,
    hosts: e.hosts,
    req: e.req,
  })),
};
fs.writeFileSync(
  "scraped-data/wave2-clamp-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report.metrics, null, 2));
console.log("\nEMPTY REQ remaining", empty.length);
for (const e of empty) console.log("-", e.name, e.hosts.join(","));
console.log("\nOUTSIDE REQ remaining", outside.length);
for (const e of outside) console.log("-", e.name);
