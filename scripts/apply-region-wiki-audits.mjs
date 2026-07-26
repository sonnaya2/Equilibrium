/**
 * Apply high-confidence fixes from scraped-data/region-wiki-audit-*-2026-07-26.json
 * and the wiki-backed consensus from the 11 region agents.
 *
 * Scope: areas, content/upgrade role renames, anchors, league regions.json areas.
 * Does not mass-rehome foreign upgrades (separate pass).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "data/research/catalog.json");
const leaguePath = path.join(root, "data/league/regions.json");
const anchorsPath = path.join(root, "src/map/data/placeAnchors.ts");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const league = JSON.parse(fs.readFileSync(leaguePath, "utf8"));

const today = "2026-07-26";
const wikiSrc = (title, url) => ({
  source: "runescape-wiki",
  url,
  title,
  verifiedAt: today,
});

function region(id) {
  const r = catalog.regions.find((x) => x.id === id);
  if (!r) throw new Error(`missing region ${id}`);
  return r;
}

function renameContent(r, from, toName, extra = {}) {
  for (const c of r.content) {
    if (c.name === from) {
      c.name = toName;
      Object.assign(c, extra);
      if (c.source) c.source.verifiedAt = today;
      return true;
    }
  }
  return false;
}

function renameUpgrade(r, from, toName, extra = {}) {
  for (const u of r.upgrades) {
    if (u.name === from) {
      u.name = toName;
      Object.assign(u, extra);
      if (u.source) u.source.verifiedAt = today;
      return true;
    }
  }
  return false;
}

function setAreas(r, areas) {
  r.areas = [...areas];
}

const log = [];

// ─── Karamja ───────────────────────────────────────────────────────────────
{
  const r = region("karamja");
  // Wiki: no region-name-as-area; TzHaar City not "TzHaar area"
  setAreas(r, [
    "Musa Point",
    "Brimhaven",
    "TzHaar City",
    "Tai Bwo Wannai",
    "Hardwood Grove",
    "Shilo Village",
    "Herblore Habitat",
  ]);
  renameContent(r, "Fight Cave", "TzHaar Fight Cave", {
    confidence: "confirmed_wiki",
  });
  // keep existing names that already match wiki where possible
  for (const c of r.content) {
    if (c.name === "TzHaar Fight Cave" || c.name === "Fight Kiln") {
      c.confidence = "confirmed_wiki";
      if (c.source) c.source.verifiedAt = today;
    }
  }
  log.push("karamja: areas cleaned (dropped region name, TzHaar City)");
}

// ─── Morytania ─────────────────────────────────────────────────────────────
{
  const r = region("morytania");
  setAreas(r, [
    "Canifis",
    "Slayer Tower",
    "Port Phasmatys",
    "Araxyte Hive",
    "Darkmeyer",
    "Barrows",
    "Everlight Dig Site",
  ]);
  renameContent(r, "Everlight Dig Site", "Everlight Archaeology", {
    kind: "Archaeology",
  });
  renameContent(r, "Slayer Tower", "Slayer Tower contracts", {
    kind: "Slayer",
  });
  renameContent(r, "Barrows", "The Barrows Brothers", {
    kind: "bossing",
  });
  renameUpgrade(r, "Everlight Dig Site", "Everlight dig-site infrastructure", {
    category: "Archaeology dig site infrastructure",
  });
  log.push("morytania: Araxxor→Araxyte Hive; content/upgrade disambiguated");
}

// ─── Tirannwn ──────────────────────────────────────────────────────────────
{
  const r = region("tirannwn");
  // Keep promo areas Prifddinas + Lost Grove
  renameContent(r, "Prifddinas", "Prifddinas high-level hub", {
    kind: "high-level hub",
    confidence: "confirmed_official",
  });
  renameUpgrade(r, "Prifddinas", "Prifddinas city access", {
    category: "major high-level hub",
    confidence: "confirmed_official",
  });
  // Lost Grove naming consistency on content if present
  renameContent(r, "The Lost Grove", "The Lost Grove (Solak / high Slayer)", {});
  log.push("tirannwn: Prif content/upgrade role titles; area stays city name");
}

// ─── Havenhythe ────────────────────────────────────────────────────────────
{
  const r = region("havenhythe");
  // Add Marigold Farm (wiki place, distinct from Eastfold)
  if (!r.areas.includes("Marigold Farm")) {
    r.areas = [...r.areas, "Marigold Farm"];
  }
  renameContent(r, "Moonrise Dig Site", "Moonrise Archaeology activity", {
    kind: "Archaeology",
  });
  renameUpgrade(r, "Moonrise Dig Site", "Moonrise dig-site hub (collections & mysteries)", {
    category: "Archaeology dig-site hub",
  });
  renameUpgrade(
    r,
    "Havenhythe Big Game Hunter",
    "Havenhythe BGH apex-hide progression",
    {},
  );
  // Drop content row that is pure upgrade clone if Apex is kind upgrade
  const apexIdx = r.content.findIndex((c) => c.name === "Apex Hide Armour");
  if (apexIdx >= 0) {
    r.content.splice(apexIdx, 1);
    log.push("havenhythe: removed Apex Hide Armour content clone (kept upgrade)");
  }
  log.push("havenhythe: Moonrise/BGH disambiguated; Marigold Farm area added");
}

// ─── Misthalin ─────────────────────────────────────────────────────────────
{
  const r = region("misthalin");
  renameContent(r, "Fort Forinthry", "Fort Forinthry construction and Slayer hub", {
    confidence: "confirmed_official",
  });
  renameContent(r, "City of Um", "City of Um / Underworld hub", {
    confidence: "confirmed_official",
  });
  renameContent(r, "Varrock Dig Site", "Varrock Dig Site Archaeology", {
    kind: "Archaeology",
  });
  // Optional wiki places already common in League notes
  for (const place of ["Edgeville", "Zanaris"]) {
    if (!r.areas.includes(place)) r.areas.push(place);
  }
  log.push("misthalin: hub content renames; Edgeville + Zanaris areas");
}

// ─── Kandarin ──────────────────────────────────────────────────────────────
{
  const r = region("kandarin");
  renameContent(r, "Hall of Memories", "Hall of Memories Divination training", {
    kind: "Divination",
  });
  renameContent(r, "Deep Sea Fishing Hub", "Deep Sea Fishing hub methods", {
    kind: "Fishing",
  });
  renameUpgrade(r, "Player-Owned Farm", "Manor Farm player-owned farm unlock", {
    category: "Farming progression",
  });
  renameUpgrade(r, "Fishing Guild", "Fishing Guild membership and DSF access", {
    category: "Fishing guild infrastructure and Deep Sea Fishing access",
  });
  renameUpgrade(r, "Hall of Memories", "Hall of Memories Divination bots and jars", {
    category: "Divination training dungeon and permanent bot unlocks",
  });
  renameUpgrade(r, "Memorial to Guthix", "Memorial to Guthix engrams and echo slots", {
    category: "Divination D&D and passive-buff infrastructure",
  });
  renameUpgrade(
    r,
    "Piscatoris Fishing Colony",
    "Piscatoris monkfish colony (Swan Song unlock)",
    {},
  );
  // case variant
  renameUpgrade(r, "Deep Sea Fishing hub", "Deep Sea Fishing methods and hub shops", {});
  renameUpgrade(r, "Deep Sea Fishing Hub", "Deep Sea Fishing methods and hub shops", {});
  log.push("kandarin: place-name upgrade/content disambiguation");
}

// ─── Fremennik ─────────────────────────────────────────────────────────────
{
  const r = region("fremennik");
  renameContent(r, "Waterbirth Island", "Waterbirth Island (Dagannoth Kings path)", {
    kind: "combat/slayer",
  });
  if (!r.hardRules) r.hardRules = [];
  const rules = [
    "Keldagrim resolves to Fremennik under Equilibrium league locality despite Dwarven Realm lore.",
    "Lunar Isle and Livid Farm resolve to Fremennik; there is no separate Moon Clan region.",
    "Miscellania and Etceteria kingdom management resolve to Fremennik.",
  ];
  for (const rule of rules) {
    if (!r.hardRules.includes(rule)) r.hardRules.push(rule);
  }
  log.push("fremennik: Waterbirth content rename; hardRules for Keldagrim/Lunar/Misc");
}

// ─── Forinthry ─────────────────────────────────────────────────────────────
{
  const r = region("forinthry");
  // Replace activity-as-area with places; keep Daemonheim + Agility facility
  setAreas(r, [
    "Daemonheim",
    "Wilderness Agility Course",
    "Mage of Zamorak",
    "Wilderness Crater",
    "Forinthry Dungeon",
    "Mage Arena",
  ]);
  renameContent(r, "Wilderness Slayer", "Wilderness Slayer (Mandrith)", {
    kind: "Slayer",
  });
  renameContent(r, "Daemonheim", "Daemonheim Dungeoneering floors", {
    kind: "Dungeoneering",
  });
  renameContent(r, "Abyss entrance", "Abyss Runecrafting (Mage of Zamorak)", {
    kind: "Runecrafting",
  });
  renameContent(r, "Wilderness Agility Course", "Wilderness Agility Course laps", {
    kind: "Agility",
  });
  renameUpgrade(r, "Wilderness Agility Course", "Wilderness Agility Course training", {
    category: "Agility training activity",
  });
  renameUpgrade(r, "Abyss entrance", "Abyss Runecrafting path", {});
  renameUpgrade(r, "Daemonheim", "Dungeoneering skill access (Daemonheim)", {});
  log.push("forinthry: place-first areas; activity labels moved to content/upgrades");
}

// ─── Desert ────────────────────────────────────────────────────────────────
{
  const r = region("desert");
  if (!r.areas.includes("Al Kharid")) r.areas.push("Al Kharid");
  renameContent(r, "Menaphos", "Menaphos city skilling hub", {
    kind: "city/skilling hub",
  });
  renameContent(r, "Het's Oasis", "Het's Oasis skilling", {
    kind: "skilling",
  });
  renameUpgrade(r, "Kharid-et Dig Site", "Kharid-et dig-site progression", {
    category: "Archaeology dig site progression",
  });
  if (!r.hardRules) r.hardRules = [];
  const rule =
    "Equilibrium Desert covers the full Kharidian Desert (including Al Kharid). Menaphos and Het's Oasis are official marketing examples, not an exclusive list.";
  if (!r.hardRules.includes(rule)) r.hardRules.push(rule);
  log.push("desert: Al Kharid area; hub renames; full-desert hardRule");
}

// ─── Anachronia ────────────────────────────────────────────────────────────
{
  const r = region("anachronia");
  renameContent(r, "Anachronia Agility Course", "Anachronia Agility Course (transit + training)", {
    kind: "Agility",
  });
  renameUpgrade(
    r,
    "Anachronia Agility Course",
    "Anachronia Agility codex pages (Double Surge / Double Escape)",
    {},
  );
  renameUpgrade(r, "Anachronia base camp", "Anachronia base camp structures and passives", {});
  renameUpgrade(r, "Dream of Iaia", "Dream of Iaia passive multi-skill stations", {});
  renameUpgrade(r, "Orthen Dig Site", "Orthen dig-site collections and mysteries", {});
  renameUpgrade(r, "Time altar", "Time altar Runecrafting access", {});
  renameUpgrade(
    r,
    "Anachronia Big Game Hunter",
    "Anachronia BGH dinosaur hunting progression",
    {},
  );
  // Fix BGH content wiki URL if pointing at disambiguation
  for (const c of r.content) {
    if (/Big Game Hunter/i.test(c.name) && c.source?.url) {
      if (c.source.url.includes("Big_Game_Hunter") && !c.source.url.includes("Anachronia")) {
        c.source.url = "https://runescape.wiki/w/Anachronia_Big_Game_Hunter";
        c.source.title = "Anachronia Big Game Hunter";
        c.source.verifiedAt = today;
      }
    }
  }
  // Split Herby Werby / Ranch if merged
  const herby = r.content.findIndex((c) => /Herby Werby.*Ranch|Ranch.*Herby/i.test(c.name));
  if (herby >= 0) {
    const old = r.content[herby];
    r.content[herby] = {
      ...old,
      name: "Herby Werby",
      kind: "D&D",
      detail:
        old.detail ||
        "Weekly Herby Werby D&D on Anachronia (distinct from the Dinosaur Farm / Ranch Out of Time).",
    };
    if (!r.content.some((c) => c.name === "Ranch Out of Time" || c.name === "Anachronia Dinosaur Farm")) {
      r.content.push({
        name: "Ranch Out of Time",
        kind: "Farming",
        detail: "Anachronia Dinosaur Farm (Ranch Out of Time) — breeding and farm infrastructure.",
        confidence: "confirmed_wiki",
        source: wikiSrc(
          "Anachronia Dinosaur Farm",
          "https://runescape.wiki/w/Anachronia_Dinosaur_Farm",
        ),
      });
    }
  }
  log.push("anachronia: agility/BGH/place upgrades disambiguated; BGH URL fix");
}

// ─── Asgarnia ──────────────────────────────────────────────────────────────
{
  const r = region("asgarnia");
  // Soft adds from Equilibrium settlements (wiki-backed places)
  for (const place of ["Rimmington", "Entrana", "Ice Mountain"]) {
    if (!r.areas.includes(place)) r.areas.push(place);
  }
  log.push("asgarnia: added Rimmington, Entrana, Ice Mountain areas");
}

// ─── Sync data/league/regions.json areas from catalog ──────────────────────
{
  for (const rec of league.records) {
    const cat = catalog.regions.find((x) => x.id === rec.id);
    if (!cat) continue;
    rec.areas = [...cat.areas];
  }
  log.push("league/regions.json: areas synced from catalog for all 11 regions");
}

// ─── Write catalog + league ────────────────────────────────────────────────
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
fs.writeFileSync(leaguePath, JSON.stringify(league, null, 2) + "\n");

// ─── Rewrite placeAnchors.ts with updated names + new pins ─────────────────
let anchors = fs.readFileSync(anchorsPath, "utf8");

const replacements = [
  // Karamja
  ['area: "Karamja", uv: [0.3, 0.758]', null], // remove line
  ['area: "TzHaar area"', 'area: "TzHaar City"'],
  // Morytania
  ['area: "Araxxor"', 'area: "Araxyte Hive"'],
  // Forinthry — replace activity pins with places (keep UVs roughly)
  [
    '  { region: "forinthry", area: "Wilderness Agility Course", uv: [0.48, 0.12] },\n  { region: "forinthry", area: "Wilderness Slayer", uv: [0.502, 0.172] },\n  { region: "forinthry", area: "Abyss entrance", uv: [0.45, 0.2] },\n  { region: "forinthry", area: "Daemonheim", uv: [0.624, 0.292] },',
    `  { region: "forinthry", area: "Wilderness Agility Course", uv: [0.48, 0.12] },
  { region: "forinthry", area: "Mage of Zamorak", uv: [0.45, 0.2] },
  { region: "forinthry", area: "Wilderness Crater", uv: [0.502, 0.172] },
  { region: "forinthry", area: "Forinthry Dungeon", uv: [0.53, 0.2] },
  { region: "forinthry", area: "Mage Arena", uv: [0.49, 0.15] },
  { region: "forinthry", area: "Daemonheim", uv: [0.624, 0.292] },`,
  ],
  // Desert — Het's Oasis north toward Al Kharid band; add Al Kharid
  [
    '  { region: "desert", area: "Garden of Kharid", uv: [0.5, 0.72] },\n  { region: "desert", area: "Kharid-et Dig Site", uv: [0.52, 0.75] },\n  { region: "desert", area: "Het\'s Oasis", uv: [0.545, 0.845] },\n  { region: "desert", area: "Sophanem", uv: [0.58, 0.9] },\n  { region: "desert", area: "Menaphos", uv: [0.56, 0.928] },',
    `  { region: "desert", area: "Al Kharid", uv: [0.492, 0.7] },
  { region: "desert", area: "Garden of Kharid", uv: [0.5, 0.72] },
  { region: "desert", area: "Kharid-et Dig Site", uv: [0.52, 0.75] },
  { region: "desert", area: "Het's Oasis", uv: [0.53, 0.73] },
  { region: "desert", area: "Sophanem", uv: [0.58, 0.9] },
  { region: "desert", area: "Menaphos", uv: [0.56, 0.928] },`,
  ],
  // Misthalin — Edgeville, Zanaris
  [
    '  { region: "misthalin", area: "Wizards\' Tower", uv: [0.5, 0.63] },',
    `  { region: "misthalin", area: "Wizards' Tower", uv: [0.5, 0.63] },
  { region: "misthalin", area: "Edgeville", uv: [0.505, 0.4] },
  { region: "misthalin", area: "Zanaris", uv: [0.515, 0.61] },`,
  ],
  // Asgarnia — Rimmington, Entrana, Ice Mountain
  [
    '  { region: "asgarnia", area: "God Wars Dungeon", uv: [0.42, 0.33] },',
    `  { region: "asgarnia", area: "God Wars Dungeon", uv: [0.42, 0.33] },
  { region: "asgarnia", area: "Rimmington", uv: [0.4, 0.58] },
  { region: "asgarnia", area: "Entrana", uv: [0.385, 0.55] },
  { region: "asgarnia", area: "Ice Mountain", uv: [0.445, 0.4] },`,
  ],
  // Havenhythe — Marigold Farm near Eastfold
  [
    '  { region: "havenhythe", area: "Eastfold Farm", uv: [0.876, 0.59] },',
    `  { region: "havenhythe", area: "Eastfold Farm", uv: [0.876, 0.59] },
  { region: "havenhythe", area: "Marigold Farm", uv: [0.86, 0.575] },`,
  ],
];

// Remove bare Karamja anchor line
anchors = anchors.replace(
  /\n\s*\{ region: "karamja", area: "Karamja", uv: \[[^\]]+\] \},/,
  "\n",
);

for (const [from, to] of replacements) {
  if (to === null) continue;
  if (!anchors.includes(from)) {
    console.warn("anchor pattern not found:", from.slice(0, 80));
    continue;
  }
  anchors = anchors.replace(from, to);
}

// Comment fix desert
anchors = anchors.replace(
  /\/\/ Kharidian Desert — dig site north, oasis mid-south/,
  "// Kharidian Desert — Al Kharid / dig / oasis on the north band, Menaphite south",
);

fs.writeFileSync(anchorsPath, anchors);

// Report remaining area=content exact collisions
console.log("Applied:");
for (const line of log) console.log(" -", line);
console.log("\nRemaining exact area∩content / area∩upgrade:");
for (const r of catalog.regions) {
  const A = new Set(r.areas);
  const C = r.content.filter((c) => A.has(c.name)).map((c) => c.name);
  const U = r.upgrades.filter((u) => A.has(u.name)).map((u) => u.name);
  if (C.length || U.length) console.log(r.id, { content: C, upgrades: U });
}
console.log("\nArea counts:", catalog.regions.map((r) => `${r.id}:${r.areas.length}`).join(" "));
