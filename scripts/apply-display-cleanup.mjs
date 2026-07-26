/**
 * 1) Rename bare area∩upgrade (and area∩content) names to role titles
 * 2) Sirenic hosts = forinthry+kandarin only
 * 3) Elder div path → single host asgarnia (empty hard req; workbench global)
 * Then dedupe.
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

/** Bare place name → role title (upgrade rename; area keeps bare). */
const UPGRADE_TITLES = {
  "Moonrise Dig Site": "Moonrise dig-site hub (collections & mysteries)",
  "Herblore Habitat": "Herblore Habitat jadinko hunting and vine farming",
  "Invention Guild": "Invention Guild workshop and machines",
  "Player-Owned Farm": "Manor Farm player-owned farm unlock",
  "Fishing Guild": "Fishing Guild membership and DSF access",
  "Hall of Memories": "Hall of Memories Divination bots and jars",
  "Memorial to Guthix": "Memorial to Guthix engrams and echo slots",
  "Piscatoris Fishing Colony": "Piscatoris monkfish colony (Swan Song unlock)",
  "Wilderness Agility Course": "Wilderness Agility Course training",
  "Kharid-et Dig Site": "Kharid-et dig-site progression",
  "Everlight Dig Site": "Everlight dig-site infrastructure",
  Prifddinas: "Prifddinas city access",
  "Anachronia Agility Course":
    "Anachronia Agility codex pages (Double Surge / Double Escape)",
  "Anachronia base camp": "Anachronia base camp structures and passives",
  "Dream of Iaia": "Dream of Iaia passive multi-skill stations",
  "Orthen Dig Site": "Orthen dig-site collections and mysteries",
  "Time altar": "Time altar Runecrafting access",
};

/** Content renames when content name equals area (keep area bare). */
const CONTENT_TITLES = {
  "Fort Forinthry": "Fort Forinthry construction and Slayer hub",
  "Moonrise Dig Site": "Moonrise Archaeology activity",
  "Hall of Memories": "Hall of Memories Divination training",
  "Deep Sea Fishing Hub": "Deep Sea Fishing hub methods",
  "Waterbirth Island": "Waterbirth Island (Dagannoth Kings path)",
  Daemonheim: "Daemonheim Dungeoneering floors",
  "Wilderness Agility Course": "Wilderness Agility Course laps",
  Menaphos: "Menaphos city skilling hub",
  "Het's Oasis": "Het's Oasis skilling",
  "Everlight Dig Site": "Everlight Archaeology",
  "Slayer Tower": "Slayer Tower contracts",
  Barrows: "The Barrows Brothers",
  Prifddinas: "Prifddinas high-level hub",
  "Anachronia Agility Course":
    "Anachronia Agility Course (transit + training)",
};

function renameList(arr, titles, kind, regionId) {
  for (const row of arr) {
    const to = titles[row.name];
    if (!to) continue;
    // if role title already exists, drop bare row
    if (arr.some((x) => x.name === to && x !== row)) {
      const i = arr.indexOf(row);
      arr.splice(i, 1);
      log.push(`drop bare ${kind} ${regionId}/${row.name} (title exists)`);
      continue;
    }
    log.push(`rename ${kind} ${regionId}: ${row.name} → ${to}`);
    row.name = to;
  }
}

for (const r of cat.regions) {
  const areaSet = new Set(r.areas);
  // only rename when name collides with an area
  for (const u of [...r.upgrades]) {
    if (!areaSet.has(u.name)) continue;
    const to = UPGRADE_TITLES[u.name];
    if (!to) continue;
    if (r.upgrades.some((x) => x.name === to && x !== u)) {
      r.upgrades = r.upgrades.filter((x) => x !== u);
      log.push(`drop bare upgrade ${r.id}/${u.name}`);
    } else {
      log.push(`rename upgrade ${r.id}: ${u.name} → ${to}`);
      u.name = to;
    }
  }
  for (const c of [...r.content]) {
    if (!areaSet.has(c.name)) continue;
    const to = CONTENT_TITLES[c.name];
    if (!to) continue;
    if (r.content.some((x) => x.name === to && x !== c)) {
      r.content = r.content.filter((x) => x !== c);
      log.push(`drop bare content ${r.id}/${c.name}`);
    } else {
      log.push(`rename content ${r.id}: ${c.name} → ${to}`);
      c.name = to;
    }
  }
}

// Sirenic hosts = forinthry + kandarin only
function keep(name, hosts, req) {
  let t = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) {
      t = JSON.parse(JSON.stringify(u));
      break;
    }
  }
  if (!t) return;
  const allow = new Set(hosts);
  for (const r of cat.regions) {
    const i = r.upgrades.findIndex((x) => x.name === name);
    if (allow.has(r.id)) {
      if (i < 0) {
        const c = JSON.parse(JSON.stringify(t));
        c.regionId = r.id;
        c.requiredRegions = [...req];
        r.upgrades.push(c);
      } else {
        r.upgrades[i].regionId = r.id;
        r.upgrades[i].requiredRegions = [...req];
      }
    } else if (i >= 0) r.upgrades.splice(i, 1);
  }
  log.push(`KEEP ${name} → ${hosts.join(",")}`);
}

keep(
  "Sirenic armour (T90 ranged power craft)",
  ["forinthry", "kandarin"],
  ["forinthry", "kandarin"],
);
keep(
  "Sirenic → elite sirenic armour",
  ["forinthry", "kandarin"],
  ["forinthry", "kandarin"],
);

// Elder div path: single host asgarnia, empty hard req (workbench global)
keep(
  "Elder divination outfit path (Cache base + Invention elite)",
  ["asgarnia"],
  [],
);

// Prifddinas upgrade title if any left as city access vs high-level hub
// (content may be high-level hub; upgrade city access)

dedupeRegionUpgrades(cat);
fs.writeFileSync(
  "data/research/catalog.json",
  JSON.stringify(cat, null, 2) + "\n",
);

// report collisions left
const left = [];
for (const r of cat.regions) {
  const A = new Set(r.areas);
  const u = r.upgrades.filter((x) => A.has(x.name)).map((x) => x.name);
  const c = r.content.filter((x) => A.has(x.name)).map((x) => x.name);
  if (u.length || c.length) left.push({ r: r.id, upgrades: u, content: c });
}
console.log(log.join("\n"));
console.log("\nremaining collisions", JSON.stringify(left, null, 2));
