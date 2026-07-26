/**
 * Productize ironman-only permanent unlocks + multi-region skilling combos.
 *
 * Reads:
 *   scraped-data/audit-ironman-unlocks-vs-app-2026-07-26.json
 *   scraped-data/audit-region-combos-skilling-2026-07-26.json
 *   scraped-data/audit-ironman-gaps-crosscheck-2026-07-26.json
 *
 * Writes / patches:
 *   data/research/regional-skilling-unlocks.json  (dedupe by id)
 *   data/research/region-combos.json
 *   data/research/catalog.json                    (region upgrades + clear method regionHints)
 *
 * Policy: Leagues = ironman / no trade. Prefer self-sufficient unlocks and region combos.
 * No combat files. No inventing numbers.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const AUDIT_UNLOCKS = "scraped-data/audit-ironman-unlocks-vs-app-2026-07-26.json";
const AUDIT_COMBOS = "scraped-data/audit-region-combos-skilling-2026-07-26.json";
const AUDIT_GAPS = "scraped-data/audit-ironman-gaps-crosscheck-2026-07-26.json";
const SKILLING_PATH = "data/research/regional-skilling-unlocks.json";
const COMBOS_PATH = "data/research/region-combos.json";
const CATALOG_PATH = "data/research/catalog.json";
const SOURCE_FILE = "audit-ironman-unlocks-vs-app-2026-07-26.json";
const VERIFIED_AT = "2026-07-26";

const REGION_IDS = new Set([
  "misthalin",
  "asgarnia",
  "desert",
  "fremennik",
  "kandarin",
  "morytania",
  "tirannwn",
  "forinthry",
  "karamja",
  "anachronia",
  "havenhythe",
]);

const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const write = (path, value) => {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

// ---------------------------------------------------------------------------
// Curated product rows for audit missing_unlocks (wiki-backed, no invented rates)
// Only rows whose id is absent from regional-skilling-unlocks get inserted.
// ---------------------------------------------------------------------------
const PRODUCT_ROWS = [
  {
    id: "multi-region:slayer-helmet-craft-chain",
    name: "Slayer helmet craft + full upgrade chain",
    recordType: "equipment",
    regionHints: ["forinthry", "kandarin", "morytania", "desert", "tirannwn"],
    category: "Slayer permanent gear unlock",
    detail:
      "Ironman Slayer guide essential: learn to craft the Slayer helmet for 400 points after Smoking Kills, then full / reinforced / corrupted upgrades and ferocious-ring fuse. Helmet parts (black mask, focus sight, hexcrest, spectral lens) are multi-region farms. Permanent combat + Slayer multiplier stack.",
    requirements: [
      "Smoking Kills completed",
      "400 Slayer points to learn craft",
      "Helmet part drops by upgrade tier",
    ],
    confidence: "confirmed_wiki",
    skill: "Slayer",
    importance: "critical",
    wiki: "https://runescape.wiki/w/Slayer_helmet",
  },
  {
    id: "forinthry:toolbelt-attach-unlocks",
    name: "Toolbelt attach unlocks (drop cleaners)",
    recordType: "activity",
    regionHints: ["forinthry"],
    category: "Slayer permanent toolbelt unlocks",
    detail:
      "Ironman Slayer notable rewards: 500 points each to permanently attach bonecrusher, seedicide, herbicide, charming imp, and gold accumulator to the toolbelt. Items may exist as rows; this is the permanent attach unlock planner checklist.",
    requirements: ["500 Slayer points per attach unlock", "Owned cleaner item"],
    confidence: "confirmed_wiki",
    skill: "Slayer",
    importance: "critical",
    wiki: "https://runescape.wiki/w/Slayer_Rewards",
  },
  {
    id: "cross-region:natures-sentinel-outfit",
    name: "Nature's Sentinel outfit",
    recordType: "equipment",
    regionHints: ["karamja"],
    category: "Woodcutting / Firemaking XP outfit",
    detail:
      "Ironman Firemaking curly-roots rates quote full Nature's Sentinel with Ring of Fire. Jadinko Lair / Karamja outfit chain for permanent Woodcutting and Firemaking XP.",
    requirements: ["Jadinko Lair / Nature's sentinel acquisition path"],
    confidence: "confirmed_wiki",
    skill: "Woodcutting",
    importance: "high",
    wiki: "https://runescape.wiki/w/Nature%27s_sentinel_outfit",
  },
  {
    id: "misthalin:thieves-guild-master-tools",
    name: "Master thief's lockpick + master thief's stethoscope",
    recordType: "equipment",
    regionHints: ["misthalin"],
    category: "Thieving permanent tools",
    detail:
      "Thieves' Guild permanent tools required for efficient Keldagrim chests (94+) and safecracking/heists QoL. Complements Trahaearn exoskeleton for ironman Thieving.",
    requirements: ["Thieves' Guild progression"],
    confidence: "confirmed_wiki",
    skill: "Thieving",
    importance: "high",
    wiki: "https://runescape.wiki/w/Master_thief%27s_lockpick",
  },
  {
    id: "morytania:sticky-fingers-relic",
    name: "Sticky Fingers (Archaeology relic)",
    recordType: "activity",
    regionHints: ["anachronia", "misthalin"],
    category: "Archaeology monolith relic power",
    detail:
      "Ironman Thieving helpful unlock: pickpocket rate multiplier; also boosts master-farmer seed rates in Farming. First-class relic permanent unlock for no-trade planners (sibling pattern to Bait and Switch / Always Adze).",
    requirements: ["Archaeology relic unlock path for Sticky Fingers"],
    confidence: "confirmed_wiki",
    skill: "Thieving",
    importance: "high",
    wiki: "https://runescape.wiki/w/Sticky_Fingers",
  },
  {
    id: "cross-region:master-camouflage-outfit",
    name: "Master camouflage outfit",
    recordType: "equipment",
    regionHints: ["desert", "asgarnia", "kandarin", "morytania"],
    category: "Thieving XP outfit",
    detail:
      "Ironman Thieving: +5% pickpocket success and extra loot utility; stacks with Trahaearn exoskeleton discussion. Combined camouflage set from lower-tier Thieving outfits.",
    requirements: ["Full set of base camouflage outfits to combine"],
    confidence: "confirmed_wiki",
    skill: "Thieving",
    importance: "high",
    wiki: "https://runescape.wiki/w/Master_camouflage_outfit",
  },
  {
    id: "cross-region:poh-aquarium-prawnbroker",
    name: "Player-owned house Aquarium and Prawnbroker",
    recordType: "activity",
    regionHints: ["misthalin", "asgarnia", "kandarin"],
    category: "Fishing POH permanent infrastructure",
    detail:
      "Ironman Fishing Equipment: golden fish eggs unlock baitless fishing and local XP boosts via Prawnbroker perks. Construction 63 POH Aquarium is a permanent fishing QoL unlock, not just Construction XP.",
    requirements: ["63 Construction for Aquarium room", "Golden fish eggs for Prawn Perks"],
    confidence: "confirmed_wiki",
    skill: "Fishing",
    importance: "high",
    wiki: "https://runescape.wiki/w/Aquarium",
  },
  {
    id: "asgarnia:botanists-amulet",
    name: "Botanist's amulet",
    recordType: "equipment",
    regionHints: ["asgarnia", "kandarin"],
    category: "Herblore production amulet",
    detail:
      "Ironman Herblore ideal setup: 5% chance of 4-dose potions (5 charges). Stacks with factory/botanist outfits. Crafted/charged utility for no-trade potion production.",
    requirements: ["Botanist's amulet craft + charge materials"],
    confidence: "confirmed_wiki",
    skill: "Herblore",
    importance: "medium-high",
    wiki: "https://runescape.wiki/w/Botanist%27s_amulet",
  },
  {
    id: "misthalin:passing-bracelet",
    name: "Passing bracelet",
    recordType: "equipment",
    regionHints: ["misthalin"],
    category: "Underworld teleport jewelry",
    detail:
      "Ironman Fishing ghostly sole AFK bank loop and RC helpful unlocks. City of Um / Underworld teleport jewelry — permanent QoL for bone and fishing routes (Misthalin working taxonomy).",
    requirements: ["City of Um / Underworld progression"],
    confidence: "confirmed_wiki",
    skill: "Multi-skill",
    importance: "medium-high",
    wiki: "https://runescape.wiki/w/Passing_bracelet",
  },
  {
    id: "asgarnia:ore-box-tier-upgrades",
    name: "Ore box tier upgrades",
    recordType: "equipment",
    regionHints: ["asgarnia", "fremennik", "forinthry"],
    category: "Mining inventory tool progression",
    detail:
      "Ironman Mining guide: upgrade pickaxe and ore box every 10 levels. Ore box stores ore by tier and is a core self-sufficient Mining logistics unlock chain.",
    requirements: ["Smithing level for each ore box tier"],
    confidence: "confirmed_wiki",
    skill: "Mining",
    importance: "medium",
    wiki: "https://runescape.wiki/w/Ore_box",
  },
  {
    id: "misthalin:wood-box-tier-upgrades",
    name: "Wood box tier upgrades",
    recordType: "equipment",
    regionHints: ["asgarnia", "kandarin", "misthalin"],
    category: "Woodcutting inventory tool progression",
    detail:
      "Ironman Woodcutting Tips: wood box stores hundreds of logs. Tool-chain permanent upgrade path parallel to ore box for no-trade inventory pressure.",
    requirements: ["Fletching / Construction materials per tier as wiki"],
    confidence: "confirmed_wiki",
    skill: "Woodcutting",
    importance: "medium",
    wiki: "https://runescape.wiki/w/Wood_box",
  },
  {
    id: "kandarin:ferocious-ring-helmet-fuse",
    name: "Ferocious ring fuse to full slayer helmet",
    recordType: "equipment",
    regionHints: ["kandarin"],
    category: "Slayer helmet permanent upgrade",
    detail:
      "Ironman Slayer notable rewards: 500 points to fuse a ferocious ring into the full Slayer helmet. Kuradal's dungeon 4% damage while wearing any ring becomes helmet-passive. Complements multi-region:slayer-helmet-craft-chain.",
    requirements: [
      "Full Slayer helmet owned",
      "Ferocious ring",
      "500 Slayer points",
    ],
    confidence: "confirmed_wiki",
    skill: "Slayer",
    importance: "medium",
    wiki: "https://runescape.wiki/w/Ferocious_ring",
  },
  {
    id: "morytania:cremation-ability",
    name: "Cremation ability unlock",
    recordType: "activity",
    regionHints: ["morytania", "forinthry"],
    category: "Prayer permanent ability unlock",
    detail:
      "Ironman Prayer alternate offering path (2.5x bury Prayer XP + 2x bury Firemaking XP). Rare ghost drop permanent ability — distinct from Sunspear vyre cremation and Shades of Mort'ton methods already indexed.",
    requirements: ["Cremation ability drop from ghosts / wiki acquisition"],
    confidence: "confirmed_wiki",
    skill: "Prayer",
    importance: "medium",
    wiki: "https://runescape.wiki/w/Cremation",
  },
  {
    id: "kandarin:fishing-outfit",
    name: "Fishing outfit (Fish Flingers)",
    recordType: "equipment",
    regionHints: ["kandarin"],
    category: "Fishing XP outfit",
    detail:
      "Ironman Fishing Equipment: up to 5% Fishing XP via Fish Flingers. Separate from fury/shark Deep Sea Fishing outfit rows when those cover higher tiers only.",
    requirements: ["Fish Flingers participation"],
    confidence: "confirmed_wiki",
    skill: "Fishing",
    importance: "high",
    wiki: "https://runescape.wiki/w/Fishing_outfit",
  },
];

// Name aliases: if an existing record already covers the audit unlock, skip insert.
const EXISTING_NAME_MATCHERS = [
  { test: /underworld grimoire/i, covers: /underworld grimoire/i },
  { test: /diviner.?s outfit/i, covers: /diviner/i },
  { test: /memorial to guthix|boons/i, covers: /memorial to guthix/i },
  { test: /fury shark/i, covers: /shark outfit|fury shark/i },
  { test: /ring of fire|flame gloves|all fired up/i, covers: /ring of fire|flame gloves|all fired up/i },
  { test: /always adze/i, covers: /always adze/i },
  { test: /light form/i, covers: /light form/i },
  { test: /cooking gauntlets/i, covers: /cooking gauntlets/i },
  { test: /smelting gauntlets/i, covers: /smelting gauntlets|family crest/i },
  { test: /plank box/i, covers: /plank box/i },
  { test: /ranger.?s workroom/i, covers: /ranger/i },
  { test: /elder divination/i, covers: /elder divination/i },
  { test: /infinity ethereal/i, covers: /ethereal/i },
  { test: /ring of whispers/i, covers: /ring of whispers/i },
  { test: /death note/i, covers: /death note/i },
  { test: /pontifex/i, covers: /pontifex/i },
  { test: /varrock armour/i, covers: /varrock armour/i },
  { test: /scroll of gathering/i, covers: /scroll of gathering/i },
  { test: /deployable herb burner/i, covers: /herb burner/i },
  { test: /desert amulet/i, covers: /desert amulet/i },
  { test: /crystal mask/i, covers: /crystal mask/i },
  { test: /ring of imbuing/i, covers: /ring of imbuing/i },
  { test: /necklace of salamancy/i, covers: /salamancy/i },
  { test: /divine-o-matic/i, covers: /divine-o-matic/i },
  { test: /lorehound/i, covers: /lorehound/i },
  { test: /shaman.?s outfit/i, covers: /shaman/i },
  { test: /toolbelt attach/i, covers: /toolbelt attach/i },
  { test: /slayer helmet craft/i, covers: /slayer helmet craft/i },
  { test: /nature.?s sentinel/i, covers: /nature.?s sentinel/i },
  { test: /sticky fingers/i, covers: /sticky fingers/i },
  { test: /master camouflage/i, covers: /master camouflage/i },
  { test: /master thief/i, covers: /master thief/i },
  { test: /aquarium|prawn perk/i, covers: /aquarium|prawn perk/i },
  { test: /botanist.?s amulet/i, covers: /botanist.?s amulet/i },
  { test: /passing bracelet/i, covers: /passing bracelet/i },
  { test: /ore box/i, covers: /ore box/i },
  { test: /wood box/i, covers: /wood box/i },
  { test: /ferocious ring/i, covers: /ferocious ring/i },
  { test: /cremation ability/i, covers: /cremation ability unlock/i },
  { test: /fishing outfit \(fish flingers\)/i, covers: /fishing outfit \(fish flingers\)/i },
];

function sourceRef(title, url) {
  if (!url) return null;
  return {
    source: "runescape-wiki",
    url,
    title,
    verifiedAt: VERIFIED_AT,
  };
}

function normalizeRegionHints(hints) {
  return [...new Set((hints || []).map(String).filter((h) => REGION_IDS.has(h) || h === "global"))];
}

function toRecord(row) {
  return {
    id: row.id,
    name: row.name,
    recordType: row.recordType,
    regionHints: normalizeRegionHints(row.regionHints),
    requiredRegions: [],
    regionRequirementType: "",
    category: row.category,
    detail: row.detail,
    requirements: row.requirements || [],
    confidence: row.confidence || "confirmed_wiki",
    source: sourceRef(row.name, row.wiki),
    sourceFile: SOURCE_FILE,
  };
}

function alreadyCovered(unlockName, records) {
  const name = unlockName.toLowerCase();
  for (const matcher of EXISTING_NAME_MATCHERS) {
    if (!matcher.test.test(name)) continue;
    if (records.some((r) => matcher.covers.test(r.name))) return true;
  }
  // Direct substring either way
  return records.some((r) => {
    const rn = r.name.toLowerCase();
    return rn === name || name.includes(rn) || rn.includes(name.slice(0, 28));
  });
}

// ---------------------------------------------------------------------------
// 1) Merge permanent unlocks into regional-skilling-unlocks.json
// ---------------------------------------------------------------------------
const auditUnlocks = read(AUDIT_UNLOCKS);
const skilling = read(SKILLING_PATH);
const catalog = read(CATALOG_PATH);

const byId = new Map(skilling.records.map((r) => [r.id, r]));
let addedUnlocks = 0;
const addedRows = [];

for (const row of PRODUCT_ROWS) {
  if (byId.has(row.id)) continue;
  if (alreadyCovered(row.name, skilling.records)) continue;
  const record = toRecord(row);
  skilling.records.push(record);
  byId.set(record.id, record);
  addedRows.push(record);
  addedUnlocks++;
}

// Also walk audit missing_unlocks and emit only PRODUCT_ROWS matches — log gaps left as notes.
const productByWiki = new Map(PRODUCT_ROWS.map((r) => [r.wiki, r]));
const productByName = new Map(PRODUCT_ROWS.map((r) => [r.name.toLowerCase(), r]));
let auditStillMissing = 0;
for (const u of auditUnlocks.missing_unlocks || []) {
  const covered =
    alreadyCovered(u.unlock_name, skilling.records) ||
    productByName.has(u.unlock_name.toLowerCase()) ||
    productByWiki.has(u.wiki_url);
  if (!covered && !alreadyCovered(u.unlock_name, skilling.records)) {
    // Re-check after inserts
  }
  if (!alreadyCovered(u.unlock_name, skilling.records) && !byId.has(
    PRODUCT_ROWS.find((p) => p.name.toLowerCase() === u.unlock_name.toLowerCase() || p.wiki === u.wiki_url)?.id,
  )) {
    // If we have a product row now in byId, fine
    const prod = PRODUCT_ROWS.find(
      (p) => p.wiki === u.wiki_url || p.name.toLowerCase() === u.unlock_name.toLowerCase(),
    );
    if (prod && byId.has(prod.id)) continue;
    if (alreadyCovered(u.unlock_name, skilling.records)) continue;
    auditStillMissing++;
  }
}

// Recount post-insert coverage for console
let coveredCount = 0;
let stillMissingNames = [];
for (const u of auditUnlocks.missing_unlocks || []) {
  if (alreadyCovered(u.unlock_name, skilling.records)) coveredCount++;
  else stillMissingNames.push(u.unlock_name);
}

skilling.snapshotDate = VERIFIED_AT;
if (!skilling.sourceFiles?.includes(SOURCE_FILE)) {
  skilling.sourceFiles = [...(skilling.sourceFiles || []), SOURCE_FILE];
}
skilling.purpose =
  skilling.purpose ||
  "Region-defining skilling activities, shops, outfits, off-hands, tool chains and production infrastructure for Equilibrium planning.";

// ---------------------------------------------------------------------------
// 2) Patch catalog region upgrades carefully (by region id + name)
// ---------------------------------------------------------------------------
let upgradesAdded = 0;
for (const region of catalog.regions || []) {
  region.upgrades ||= [];
  const existingNames = new Set(region.upgrades.map((u) => u.name.toLowerCase()));
  for (const row of addedRows) {
    if (!row.regionHints.includes(region.id)) continue;
    if (existingNames.has(row.name.toLowerCase())) continue;
    region.upgrades.push({
      name: row.name,
      category: row.category,
      detail: row.detail,
      requirements: row.requirements,
      confidence: row.confidence,
      source: row.source,
      regionId: region.id,
      regionHints: row.regionHints,
      requiredRegions: row.requiredRegions || [],
      regionRequirementType: row.regionRequirementType || "",
    });
    existingNames.add(row.name.toLowerCase());
    upgradesAdded++;
  }
}

// ---------------------------------------------------------------------------
// 3) Region combos product file
// ---------------------------------------------------------------------------
const auditCombos = read(AUDIT_COMBOS);
const auditGaps = read(AUDIT_GAPS);

const comboRecords = (auditCombos.combos || []).map((c) => {
  const regions = [...new Set([...(c.required_regions || []), ...(c.optional_pressure_regions || [])].filter(Boolean))];
  const primaryUrl = (c.source_urls || [])[0] || "";
  return {
    id: c.id,
    name: c.name,
    regions: c.required_regions || [],
    optionalRegions: c.optional_pressure_regions || [],
    allRegions: regions,
    skills: c.skills_affected || [],
    detail: c.why || "",
    confidence:
      c.currently_modeled === true
        ? "modeled"
        : c.currently_modeled === "partial"
          ? "partial"
          : "gap",
    modeled: c.currently_modeled,
    gapAction: c.gap_action || "",
    source: sourceRef(c.name, primaryUrl),
    sourceUrls: c.source_urls || [],
  };
});

const globalIssues = (auditGaps.global_region_combo_issues || []).map((issue, i) => ({
  id: `global-issue:${i + 1}`,
  name: issue.issue,
  regions: [],
  optionalRegions: [],
  allRegions: [],
  skills: [],
  detail: issue.detail,
  confidence: issue.severity || "medium",
  modeled: false,
  gapAction: "",
  source: null,
  sourceUrls: [],
  kind: "global_issue",
  severity: issue.severity || "medium",
}));

const regionCombos = {
  snapshotDate: VERIFIED_AT,
  purpose:
    "Multi-region skilling dependency combos and global region-combo issues for ironman / no-trade League planning.",
  policy: {
    required_regions: "Regions needed on the normal self-sufficient unlock path.",
    optional_regions: "Regions that improve the chain but are not hard locks.",
    ironman: "Leagues = ironman / no trade. Prefer self-sufficient unlocks and region combos. No GE dual mode.",
  },
  sourceFiles: [
    "audit-region-combos-skilling-2026-07-26.json",
    "audit-ironman-gaps-crosscheck-2026-07-26.json",
  ],
  combos: comboRecords,
  globalIssues,
  records: [...comboRecords, ...globalIssues],
  counts: {
    combos: comboRecords.length,
    globalIssues: globalIssues.length,
    modeledTrue: comboRecords.filter((c) => c.modeled === true).length,
    modeledPartial: comboRecords.filter((c) => c.modeled === "partial").length,
    modeledFalse: comboRecords.filter((c) => c.modeled === false).length,
  },
};

// ---------------------------------------------------------------------------
// 4) Clear catalog method regionHints fixes only (no invention)
// ---------------------------------------------------------------------------
const METHOD_FIXES = [
  {
    id: "runecrafting:time-runes-through-the-abyss",
    regionHints: ["forinthry", "anachronia"],
    hardRegionRequirement: true,
    noteAppend:
      "Abyss entrance is Forinthry/Wilderness; Time altar is Anachronia — both required for this path.",
  },
  {
    id: "woodcutting:eternal-magic-trees",
    regionHints: ["kandarin", "havenhythe"],
    hardRegionRequirement: false,
    noteAppend:
      "Piscatoris (Kandarin) primary trees; Havenhythe nursery is an alternate chop location once saplings planted.",
  },
];

let methodsFixed = 0;
for (const skill of catalog.skills || []) {
  for (const method of skill.methods || []) {
    const fix = METHOD_FIXES.find((f) => f.id === method.id);
    if (!fix) continue;
    const before = JSON.stringify(method.regionHints);
    method.regionHints = fix.regionHints;
    if (fix.hardRegionRequirement != null) method.hardRegionRequirement = fix.hardRegionRequirement;
    if (fix.noteAppend) {
      const note = method.note || "";
      if (!note.includes(fix.noteAppend.slice(0, 40))) {
        method.note = note ? `${note} · ${fix.noteAppend}` : fix.noteAppend;
      }
    }
    if (JSON.stringify(method.regionHints) !== before) methodsFixed++;
    else methodsFixed++; // still count applied
  }
}

// Dataset counters
const activities = skilling.records.filter((r) => r.recordType === "activity");
const equipment = skilling.records.filter((r) => r.recordType === "equipment");
catalog.datasets ||= {};
catalog.datasets.regionalSkillingUnlocks = skilling.records.length;
catalog.datasets.regionalSkillingActivities = activities.length;
catalog.datasets.regionalSkillingEquipment = equipment.length;
catalog.datasets.regionCombos = regionCombos.combos.length;
catalog.coverage ||= {};
catalog.coverage.ironman_skilling =
  "Ironman permanent unlock gaps productized into regional-skilling-unlocks; multi-region skilling combos in region-combos.json. League planning assumes ironman/self-sufficient — no GE dual mode. Blessings still empty until reveals.";

write(SKILLING_PATH, skilling);
write(COMBOS_PATH, regionCombos);
write(CATALOG_PATH, catalog);

console.log("IRONMAN UNLOCKS SYNC");
console.log(`  Skilling records total: ${skilling.records.length}`);
console.log(`  Unlock rows added:      ${addedUnlocks}`);
for (const r of addedRows) console.log(`    + ${r.id}`);
console.log(`  Catalog upgrades added: ${upgradesAdded}`);
console.log(`  Region combos:          ${regionCombos.counts.combos} (+ ${regionCombos.counts.globalIssues} global issues)`);
console.log(`  Method regionHints fix: ${methodsFixed}`);
console.log(`  Audit top-40 covered:   ${coveredCount}/${(auditUnlocks.missing_unlocks || []).length}`);
if (stillMissingNames.length) {
  console.log(`  Still not indexed (${stillMissingNames.length}):`);
  for (const n of stillMissingNames) console.log(`    - ${n}`);
}
