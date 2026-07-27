/**
 * Stamp unlock.regions onto data/combat/equipment.json from scraped corpus.
 * NEVER invents regions — only required_regions / hard hubs / explicit family expansions.
 *
 * Sources:
 *   data/research/regional-combat-unlocks.json
 *   scraped-data/major-upgrades-by-region.json
 *   scraped-data/progression-enrichment-regional-combat*.json
 *   scraped-data/agent-region-map-*.json (parallel agent audits)
 *   scraped-data/agent-region-gaps-*.json (per-region densify / gap re-assert passes)
 *   scraped-data/agent-slayer-midgear*.json (pass3 slayer/mid combat densify)
 *   scraped-data/agent-accessories-pass*.json (pass3 accessories densify)
 *   scraped-data/agent-accessories-pass3.json (pockets/capes/hybrid accessories densify)
 *
 * Outputs:
 *   data/combat/equipment.json  (mutated unlock.regions, union with existing)
 *   data/research/equipment-region-index.json
 *   scraped-data/equipment-region-stamp-report.json
 *
 * Run: node scripts/stamp-equipment-regions.mjs
 *      npm run stamp:equipment-regions
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const EQ_PATH = "data/combat/equipment.json";
const COMBAT_UNLOCKS = "data/research/regional-combat-unlocks.json";
const MAJOR = "scraped-data/major-upgrades-by-region.json";
const INDEX_OUT = "data/research/equipment-region-index.json";
const REPORT_OUT = "scraped-data/equipment-region-stamp-report.json";
const ENRICH_RE = /^progression-enrichment-regional-combat.*\.json$/;

const VALID = new Set([
  "misthalin", "havenhythe", "karamja", "asgarnia", "kandarin",
  "fremennik", "forinthry", "desert", "morytania", "tirannwn", "anachronia",
]);

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const write = (rel, value) => {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

/** lower, strip parentheticals, non-alnum → hyphens */
function kebab(raw) {
  return String(raw || "")
    .split(" / ")[0]
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripItemPrefix(id) {
  return String(id || "").replace(/^item:/, "");
}

function normRegion(raw) {
  const t = String(raw || "").trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
  if (!t) return "";
  if (t === "wilderness" || t === "wildy") return "forinthry";
  // accept both underscore and plain
  const plain = t.replaceAll("_", "");
  for (const v of VALID) {
    if (v === t || v.replaceAll("_", "") === plain || v === t.replaceAll("_", "")) return v;
  }
  if (VALID.has(t.replaceAll("_", ""))) return t.replaceAll("_", "");
  // already valid ids use no underscore
  if (VALID.has(raw)) return raw;
  const dashed = t.replaceAll("_", "-");
  if (VALID.has(dashed)) return dashed;
  // map underscore form back
  const map = {
    misthalin: "misthalin", havenhythe: "havenhythe", karamja: "karamja",
    asgarnia: "asgarnia", kandarin: "kandarin", fremennik: "fremennik",
    forinthry: "forinthry", desert: "desert", morytania: "morytania",
    tirannwn: "tirannwn", anachronia: "anachronia",
  };
  return map[t] || map[t.replaceAll("_", "")] || "";
}

function regionList(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(normRegion).filter((r) => VALID.has(r)))];
}

function list(v) {
  return Array.isArray(v) ? v : v == null || v === "" ? [] : [v];
}

// ─── aliases: corpus name → equipment kebab id (without item:) ───────────────
const ALIASES = new Map([
  ["tectonic-mask", "tectonic-helm"],
  ["tectonic-robe-top", "tectonic-body"],
  ["tectonic-robe-bottom", "tectonic-legs"],
  ["malevolent-cuirass", "malevolent-body"],
  ["malevolent-greaves", "malevolent-legs"],
  ["essence-of-finality-amulet", "essence-of-finality"],
  ["essence-of-finality-amulet-or", "essence-of-finality"],
  ["channelers-ring", "channelers-ring"],
  ["channellers-ring", "channelers-ring"],
  ["channeller-s-ring", "channelers-ring"],
  ["channeler-s-ring", "channelers-ring"],
  ["reaver-s-ring", "reavers-ring"],
  ["stalker-s-ring", "stalkers-ring"],
  ["champion-s-ring", "champions-ring"],
  ["occultist-s-ring", "occultists-ring"],
  ["wand-of-the-praesul", "wand-of-the-praesul"],
  ["imperium-core", "imperium-core"],
  ["salve-amulet-e", "salve-amulet-e"],
  ["fractured-staff-of-armadyl", "fractured-staff-of-armadyl"],
  ["fsoa", "fractured-staff-of-armadyl"],
  ["bolg", "bow-of-the-last-guardian"],
  ["bow-of-the-last-guardian", "bow-of-the-last-guardian"],
  ["tumekens-light", "tumekens-light"],
  ["devourers-guard", "devourers-guard"],
  ["masterwork-spear-of-annihilation", "masterwork-spear-of-annihilation"],
  // trimmed-masterwork-spear-of-annihilation: pass7 REMOVE_IDS phantom (wiki redirect only)
  // ancient-rebounder: pass9 REMOVE_IDS phantom (wiki redirects to Ancient lantern)
  ["ancient-rebounder", "ancient-lantern"],
  ["kerapacs-wrist-wraps", "kerapacs-wrist-wraps"],
  ["enhanced-kerapacs-wrist-wraps", "enhanced-kerapacs-wrist-wraps"],
  ["erethdors-grimoire", "erethdors-grimoire"],
  ["ig neous-kal-zuk", "igneous-kal-zuk"],
  // City of Um necro DW ladder — residual is t90 only (pass6); aliases point at kept ids
  ["death-guard", "deathguard-t90"],
  ["deathguard", "deathguard-t90"],
  ["death-guard-tier-70", "deathguard-t90"],
  ["death-guard-tier-80", "deathguard-t90"],
  ["death-guard-tier-90", "deathguard-t90"],
  ["skull-lantern", "skull-lantern-t90"],
  ["skull-lantern-tier-70", "skull-lantern-t90"],
  ["skull-lantern-tier-80", "skull-lantern-t90"],
  ["skull-lantern-tier-90", "skull-lantern-t90"],
]);

// ─── claim registry: eqKey → { regions, sources[], hard } ────────────────────
/** @type {Map<string, { regions: Set<string>, sources: object[], hard: boolean, requirement: string }>} */
const claims = new Map();

function ensureClaim(key) {
  if (!claims.has(key)) {
    claims.set(key, { regions: new Set(), sources: [], hard: false, requirement: "" });
  }
  return claims.get(key);
}

function addClaim(key, regions, meta) {
  if (!key || !regions?.length) return;
  const c = ensureClaim(key);
  const before = [...c.regions].sort().join("+");
  for (const r of regions) c.regions.add(r);
  if (meta.hard) c.hard = true;
  if (meta.requirement && !c.requirement) c.requirement = meta.requirement;
  c.sources.push({
    source: meta.source,
    hard: Boolean(meta.hard),
    regions: [...regions],
    requirement: meta.requirement || "",
    note: meta.note || "",
  });
  const after = [...c.regions].sort().join("+");
  // conflict: two hard sources with non-overlapping sets
  if (meta.hard && before && before !== after) {
    const prevHard = c.sources.filter((s) => s.hard && s !== c.sources.at(-1));
    for (const p of prevHard) {
      const a = new Set(p.regions);
      const b = new Set(regions);
      const overlap = [...a].some((x) => b.has(x));
      if (!overlap && a.size && b.size) {
        c.conflict = c.conflict || [];
        c.conflict.push({ a: p, b: c.sources.at(-1) });
      }
    }
  }
}

// ─── load equipment index ────────────────────────────────────────────────────
const eqFile = read(EQ_PATH);
const records = eqFile.records ?? [];

/** Inject missing high-value wearables so loadout + region stamps can see them. */
const CATALOG_EXTRA = [
  {
    id: "item:fire-cape",
    name: "Fire cape",
    style: "hybrid",
    slot: "cape",
    tier: 60,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: "https://runescape.wiki/w/Fire_cape", verifiedAt: "2026-07-26" }],
  },
  {
    id: "item:berserker-ring",
    name: "Berserker ring",
    style: "hybrid",
    slot: "ring",
    tier: 1,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: "https://runescape.wiki/w/Berserker_ring", verifiedAt: "2026-07-26" }],
  },
  {
    id: "item:warrior-ring",
    name: "Warrior ring",
    style: "melee",
    slot: "ring",
    tier: 1,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: "https://runescape.wiki/w/Warrior_ring", verifiedAt: "2026-07-26" }],
  },
  {
    id: "item:archers-ring",
    name: "Archers' ring",
    style: "ranged",
    slot: "ring",
    tier: 1,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: "https://runescape.wiki/w/Archers%27_ring", verifiedAt: "2026-07-26" }],
  },
  {
    id: "item:seers-ring",
    name: "Seers' ring",
    style: "magic",
    slot: "ring",
    tier: 1,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: "https://runescape.wiki/w/Seers%27_ring", verifiedAt: "2026-07-26" }],
  },
  {
    id: "item:dragonfire-shield",
    name: "Dragonfire shield",
    style: "hybrid",
    slot: "offhand",
    tier: 70,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: "https://runescape.wiki/w/Dragonfire_shield", verifiedAt: "2026-07-26" }],
  },
];

// Deathwarden tank ladder — inject T90 residual only (loadout browse; mid tiers stripped).
{
  const DW_PIECES = [
    { slug: "hood", name: "hood", slot: "helmet" },
    { slug: "robe-top", name: "robe top", slot: "body" },
    { slug: "robe-bottom", name: "robe bottom", slot: "legs" },
    { slug: "gloves", name: "gloves", slot: "gloves" },
    { slug: "boots", name: "boots", slot: "boots" },
  ];
  for (const p of DW_PIECES) {
    const bare = `deathwarden-${p.slug}`;
    const id = `item:${bare}-t90`;
    const name = `Deathwarden ${p.name} (tier 90)`;
    const wikiSlug = `Deathwarden_${p.name.replaceAll(" ", "_")}_(tier_90)`;
    CATALOG_EXTRA.push({
      id,
      name,
      style: "necromancy",
      slot: p.slot,
      tier: 90,
      setId: "deathwarden-90",
      bonuses: {},
      sources: [
        {
          source: "runescape-wiki",
          url: `https://runescape.wiki/w/${wikiSlug}`,
          verifiedAt: "2026-07-26",
        },
      ],
    });
  }
}

// Obsidian armour (Karamja Fight Cauldron) — corpus karamja:fight-cauldron-obsidian-support.
// Skip plateskirt (legs alt of platelegs) and tokkul shop weapons.
for (const row of [
  { id: "item:obsidian-warrior-helm", name: "Obsidian warrior helm", style: "melee", slot: "helmet", wiki: "Obsidian_warrior_helm" },
  { id: "item:obsidian-ranger-helm", name: "Obsidian ranger helm", style: "ranged", slot: "helmet", wiki: "Obsidian_ranger_helm" },
  { id: "item:obsidian-mage-helm", name: "Obsidian mage helm", style: "magic", slot: "helmet", wiki: "Obsidian_mage_helm" },
  { id: "item:obsidian-platebody", name: "Obsidian platebody", style: "hybrid", slot: "body", wiki: "Obsidian_platebody" },
  { id: "item:obsidian-platelegs", name: "Obsidian platelegs", style: "hybrid", slot: "legs", wiki: "Obsidian_platelegs" },
  { id: "item:obsidian-gloves", name: "Obsidian gloves", style: "hybrid", slot: "gloves", wiki: "Obsidian_gloves" },
  { id: "item:obsidian-boots", name: "Obsidian boots", style: "hybrid", slot: "boots", wiki: "Obsidian_boots" },
  { id: "item:obsidian-kiteshield", name: "Obsidian kiteshield", style: "hybrid", slot: "offhand", wiki: "Obsidian_kiteshield" },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: row.style,
    slot: row.slot,
    tier: 60,
    setId: "obsidian",
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Gemstone armour T80 hybrid — wiki: Gemstone cavern under Shilo Village (Karamja gloves 3).
// NOT Anachronia (pass4 false override); Dragonkin Lab gemstone dragons use a different drop table.
for (const row of [
  { id: "item:gemstone-helm", name: "Gemstone helm", slot: "helmet", wiki: "Gemstone_helm" },
  { id: "item:gemstone-hauberk", name: "Gemstone hauberk", slot: "body", wiki: "Gemstone_hauberk" },
  { id: "item:gemstone-greaves", name: "Gemstone greaves", slot: "legs", wiki: "Gemstone_greaves" },
  { id: "item:gemstone-gauntlets", name: "Gemstone gauntlets", slot: "gloves", wiki: "Gemstone_gauntlets" },
  { id: "item:gemstone-boots", name: "Gemstone boots", slot: "boots", wiki: "Gemstone_boots" },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: "hybrid",
    slot: row.slot,
    tier: 80,
    setId: "gemstone",
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Pass6 Forinthry densify — missing Daemonheim / Corp shield ladder rows.
// Chaotic kiteshield stamped by family:forinthry-chaotic; eagle/farseer by forinthry-dg-weapons;
// blessed spirit by forinthry-spirit-shield.
for (const row of [
  {
    id: "item:chaotic-kiteshield",
    name: "Chaotic kiteshield",
    style: "melee",
    slot: "offhand",
    tier: 80,
    wiki: "Chaotic_kiteshield",
  },
  {
    id: "item:farseer-kiteshield",
    name: "Farseer kiteshield",
    style: "magic",
    slot: "offhand",
    tier: 80,
    wiki: "Farseer_kiteshield",
  },
  {
    id: "item:blessed-spirit-shield",
    name: "Blessed spirit shield",
    style: "hybrid",
    slot: "offhand",
    tier: 70,
    wiki: "Blessed_spirit_shield",
  },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: row.style,
    slot: row.slot,
    tier: row.tier,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Pass3 Karamja residual: Abomination unique cape + lean classic TzHaar weapon icons.
// Full Toktz GE junk list skipped; Ek-ZekKil remains Misthalin Zuk drop.
CATALOG_EXTRA.push({
  id: "item:abomination-cape",
  name: "Abomination cape",
  style: "melee",
  slot: "cape",
  tier: 75,
  bonuses: {},
  sources: [{ source: "runescape-wiki", url: "https://runescape.wiki/w/Abomination_cape", verifiedAt: "2026-07-26" }],
});
for (const row of [
  { id: "item:tzhaar-ket-om", name: "TzHaar-Ket-Om", style: "melee", slot: "twohand", wiki: "TzHaar-Ket-Om" },
  { id: "item:tzhaar-ket-em", name: "TzHaar-Ket-Em", style: "melee", slot: "mainhand", wiki: "TzHaar-Ket-Em" },
  { id: "item:toktz-xil-ak", name: "Toktz-xil-ak", style: "melee", slot: "mainhand", wiki: "Toktz-xil-ak" },
  { id: "item:toktz-mej-tal", name: "Toktz-mej-tal", style: "magic", slot: "twohand", wiki: "Toktz-mej-tal" },
  { id: "item:toktz-xil-ul", name: "Toktz-xil-ul", style: "ranged", slot: "mainhand", wiki: "Toktz-xil-ul" },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: row.style,
    slot: row.slot,
    tier: 60,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// GWD1 residual wearables still absent (bandos/subjugation families already cover name prefixes).
for (const row of [
  {
    id: "item:ward-of-subjugation",
    name: "Ward of subjugation",
    style: "magic",
    slot: "offhand",
    tier: 70,
    setId: "subjugation",
    wiki: "Ward_of_subjugation",
  },
  {
    id: "item:bandos-warshield",
    name: "Bandos warshield",
    style: "melee",
    slot: "offhand",
    tier: 70,
    setId: "bandos",
    wiki: "Bandos_warshield",
  },
  {
    id: "item:saradomins-murmur",
    name: "Saradomin's murmur",
    style: "melee",
    slot: "amulet",
    tier: 70,
    wiki: "Saradomin%27s_murmur",
  },
  {
    id: "item:saradomins-hiss",
    name: "Saradomin's hiss",
    style: "magic",
    slot: "amulet",
    tier: 70,
    wiki: "Saradomin%27s_hiss",
  },
  {
    id: "item:saradomins-whisper",
    name: "Saradomin's whisper",
    style: "ranged",
    slot: "amulet",
    tier: 70,
    wiki: "Saradomin%27s_whisper",
  },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: row.style,
    slot: row.slot,
    tier: row.tier,
    ...(row.setId ? { setId: row.setId } : {}),
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Ports / Arc combat densify (Asgarnia packaging) — NOT scrimshaws.
// Core t85/88 body + weapons already in equipment.json; inject gloves/boots, elite DL darts, cape/ring.
for (const row of [
  { id: "item:superior-seasinger-aonori", name: "Superior seasinger aonori", style: "magic", slot: "gloves", tier: 85, setId: "seasinger", wiki: "Superior_seasinger_aonori" },
  { id: "item:superior-seasinger-asari", name: "Superior seasinger asari", style: "magic", slot: "boots", tier: 85, setId: "seasinger", wiki: "Superior_seasinger_asari" },
  { id: "item:superior-tetsu-kote", name: "Superior tetsu kote", style: "melee", slot: "gloves", tier: 85, setId: "tetsu", wiki: "Superior_tetsu_kote" },
  { id: "item:superior-tetsu-kogake", name: "Superior tetsu kogake", style: "melee", slot: "boots", tier: 85, setId: "tetsu", wiki: "Superior_tetsu_kogake" },
  { id: "item:superior-death-lotus-tekoh", name: "Superior Death Lotus tekoh", style: "ranged", slot: "gloves", tier: 85, setId: "death-lotus", wiki: "Superior_Death_Lotus_tekoh" },
  { id: "item:superior-death-lotus-tabi", name: "Superior Death Lotus tabi", style: "ranged", slot: "boots", tier: 85, setId: "death-lotus", wiki: "Superior_Death_Lotus_tabi" },
  { id: "item:elite-death-lotus-dart", name: "Elite Death Lotus dart", style: "ranged", slot: "mainhand", tier: 88, setId: "death-lotus", wiki: "Elite_Death_Lotus_dart" },
  { id: "item:off-hand-elite-death-lotus-dart", name: "Off-hand Elite Death Lotus dart", style: "ranged", slot: "offhand", tier: 88, setId: "death-lotus", wiki: "Off-hand_Elite_Death_Lotus_dart" },
  { id: "item:reefwalkers-cape", name: "Reefwalker's cape", style: "hybrid", slot: "cape", tier: 85, wiki: "Reefwalker%27s_cape" },
  { id: "item:superior-reefwalkers-cape", name: "Superior reefwalker's cape", style: "hybrid", slot: "cape", tier: 85, wiki: "Superior_reefwalker%27s_cape" },
  { id: "item:leviathan-ring", name: "Leviathan ring", style: "hybrid", slot: "ring", tier: 85, wiki: "Leviathan_ring" },
  { id: "item:superior-leviathan-ring", name: "Superior leviathan ring", style: "hybrid", slot: "ring", tier: 85, wiki: "Superior_leviathan_ring" },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: row.style,
    slot: row.slot,
    tier: row.tier,
    ...(row.setId ? { setId: row.setId } : {}),
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Havenhythe Apex hide ranged tank (base set only — +1..+5 upgrade ladder not catalogued).
// Wiki 2026-07-26: BGH apex hide → craft t85 tank pieces.
for (const row of [
  { id: "item:apex-hide-cowl", name: "Apex hide cowl", slot: "helmet", armour: 435.6, life: 850, wiki: "Apex_hide_cowl" },
  { id: "item:apex-hide-body", name: "Apex hide body", slot: "body", armour: 500.9, life: 1275, wiki: "Apex_hide_body" },
  { id: "item:apex-hide-chaps", name: "Apex hide chaps", slot: "legs", armour: 479.1, life: 1275, wiki: "Apex_hide_chaps" },
  { id: "item:apex-hide-vambraces", name: "Apex hide vambraces", slot: "gloves", armour: 108.9, life: 425, wiki: "Apex_hide_vambraces" },
  { id: "item:apex-hide-boots", name: "Apex hide boots", slot: "boots", armour: 108.9, life: 425, wiki: "Apex_hide_boots" },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: "ranged",
    slot: row.slot,
    tier: 85,
    setId: "apex-hide",
    bonuses: { armour: row.armour, life: row.life },
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Masterwork ranged power armour t100 (user MW ruling: anachronia + forinthry + kandarin).
// Craft gate includes Apex hide +5 achievement (Havenhythe soft pressure — not hard elective here).
for (const row of [
  { id: "item:masterwork-ranged-cowl", name: "Masterwork ranged cowl", slot: "helmet", armour: 553, prayer: 2, life: 950, wiki: "Masterwork_ranged_cowl" },
  { id: "item:masterwork-ranged-body", name: "Masterwork ranged body", slot: "body", armour: 635.9, prayer: 3, life: 1425, wiki: "Masterwork_ranged_body" },
  { id: "item:masterwork-ranged-chaps", name: "Masterwork ranged chaps", slot: "legs", armour: 608.3, prayer: 2, life: 1425, wiki: "Masterwork_ranged_chaps" },
  { id: "item:masterwork-ranged-vambraces", name: "Masterwork ranged vambraces", slot: "gloves", armour: 138.2, prayer: 2, life: 475, wiki: "Masterwork_ranged_vambraces" },
  { id: "item:masterwork-ranged-boots", name: "Masterwork ranged boots", slot: "boots", armour: 138.2, prayer: 2, life: 475, wiki: "Masterwork_ranged_boots" },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: "ranged",
    slot: row.slot,
    tier: 100,
    setId: "masterwork-ranged",
    bonuses: { armour: row.armour, prayer: row.prayer, life: row.life },
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Masterwork magic power armour t100 — same hard multi-region chain as Masterwork staff.
for (const row of [
  { id: "item:masterwork-magic-hat", name: "Masterwork magic hat", slot: "helmet", armour: 553, prayer: 2, life: 950, wiki: "Masterwork_magic_hat" },
  { id: "item:masterwork-magic-robe-top", name: "Masterwork magic robe top", slot: "body", armour: 635.9, prayer: 3, life: 1425, wiki: "Masterwork_magic_robe_top" },
  { id: "item:masterwork-magic-robe-bottom", name: "Masterwork magic robe bottom", slot: "legs", armour: 608.3, prayer: 2, life: 1425, wiki: "Masterwork_magic_robe_bottom" },
  { id: "item:masterwork-magic-gloves", name: "Masterwork magic gloves", slot: "gloves", armour: 138.2, prayer: 2, life: 475, wiki: "Masterwork_magic_gloves" },
  { id: "item:masterwork-magic-boots", name: "Masterwork magic boots", slot: "boots", armour: 138.2, prayer: 2, life: 475, wiki: "Masterwork_magic_boots" },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: "magic",
    slot: row.slot,
    tier: 100,
    setId: "masterwork-magic",
    bonuses: { armour: row.armour, prayer: row.prayer, life: row.life },
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Pass6 BiS residual densify — real wearables still absent after pass1–5 injects.
// Audit (2026-07-26): Hexhunter / Decimation / Obliteration / Annihilation / Enhanced Excalibur /
// Nightmare gauntlets / Enhanced nightmare / GWD2 OH (shadow glaive OH, Cywir orb, Avaryss OH) already present.
// Inject only confirmed wiki wearables with equip slots (no codices / craft mats / set aggregates).
for (const row of [
  // Necro BiS ring (Osseous / Rex Matriarchs — Anachronia); family:anachronia-occultist
  { id: "item:occultists-ring", name: "Occultist's ring", style: "necromancy", slot: "ring", tier: 85, wiki: "Occultist%27s_ring" },
  // Universal adrenaline utility (Daemonheim tokens — Forinthry)
  { id: "item:ring-of-vigour", name: "Ring of vigour", style: "hybrid", slot: "ring", tier: 62, wiki: "Ring_of_vigour" },
  // Claws of Guthix / EoF store (Mage Arena — Forinthry)
  { id: "item:guthix-staff", name: "Guthix staff", style: "magic", slot: "twohand", tier: 60, wiki: "Guthix_staff" },
  // Summoning special cost passive cape (DG tokens — Forinthry)
  { id: "item:spirit-cape", name: "Spirit cape", style: "hybrid", slot: "cape", tier: 50, wiki: "Spirit_cape" },
  // DG chaotic style shields (eagle-eye already catalogued)
  { id: "item:chaotic-kiteshield", name: "Chaotic kiteshield", style: "melee", slot: "offhand", tier: 80, wiki: "Chaotic_kiteshield" },
  { id: "item:farseer-kiteshield", name: "Farseer kiteshield", style: "magic", slot: "offhand", tier: 80, wiki: "Farseer_kiteshield" },
  // Style OH defender ladder siblings (defender/repriser already present)
  { id: "item:kalphite-rebounder", name: "Kalphite rebounder", style: "magic", slot: "offhand", tier: 90, wiki: "Kalphite_rebounder" },
  // pass9: ancient-rebounder removed — wiki redirect phantom of Ancient lantern (item:ancient-lantern)
  // Hexhunter ammo residual (wiki: Stalker arrows, not "Hexhunter arrows")
  { id: "item:stalker-arrows", name: "Stalker arrows", style: "ranged", slot: "ammo", tier: 80, wiki: "Stalker_arrow", bonuses: { damage: 768 } },
  // EoF melee special residual (Tormented demons — Misthalin Ancient Guthix Temple)
  { id: "item:dragon-claws", name: "Dragon claws", style: "melee", slot: "mainhand", tier: 60, wiki: "Dragon_claws", bonuses: { damage: 576, accuracy: 1132 } },
  // pass8: OH sibling of dragon claws (same TD drop; wiki Off-hand_dragon_claw singular)
  { id: "item:off-hand-dragon-claw", name: "Off-hand dragon claw", style: "melee", slot: "offhand", tier: 60, wiki: "Off-hand_dragon_claw", bonuses: { damage: 288, accuracy: 1132 } },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: row.style,
    slot: row.slot,
    tier: row.tier,
    bonuses: row.bonuses || {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

// Pass9 BiS residual densify — custom-fit MW (distinct untradeable ids), base Morrigan, First Necro helm ladder.
// Audit 2026-07-26: MW magic/ranged base sets, GWD2 weapons/anima, Kerapac wraps, Cryptbloom 5/5,
// Vestments of Havoc 4/4 (no gloves piece), Devourer's Guard + Tumeken resplendence already present.
// Skip: Amascut's crown (POH trophy), spiked custom-fit (cosmetic only), vestments gloves (REMOVE_IDS phantom).
for (const row of [
  // Custom-fit trimmed masterwork melee — same combat stats as trimmed; distinct wiki ids (Elof custom-fit).
  { id: "item:custom-fit-trimmed-masterwork-melee-helm", name: "Custom-fit trimmed masterwork melee helm", style: "melee", slot: "helmet", tier: 92, setId: "custom-fit-trimmed-masterwork", wiki: "Custom-fit_trimmed_masterwork_melee_helm", bonuses: { armour: 457.4, prayer: 2, damage: 23 } },
  { id: "item:custom-fit-trimmed-masterwork-melee-platebody", name: "Custom-fit trimmed masterwork melee platebody", style: "melee", slot: "body", tier: 92, setId: "custom-fit-trimmed-masterwork", wiki: "Custom-fit_trimmed_masterwork_melee_platebody", bonuses: { armour: 526, prayer: 3, damage: 34.5 } },
  { id: "item:custom-fit-trimmed-masterwork-melee-platelegs", name: "Custom-fit trimmed masterwork melee platelegs", style: "melee", slot: "legs", tier: 92, setId: "custom-fit-trimmed-masterwork", wiki: "Custom-fit_trimmed_masterwork_melee_platelegs", bonuses: { armour: 503.1, prayer: 2, damage: 28.7 } },
  { id: "item:custom-fit-trimmed-masterwork-melee-gloves", name: "Custom-fit trimmed masterwork melee gloves", style: "melee", slot: "gloves", tier: 92, setId: "custom-fit-trimmed-masterwork", wiki: "Custom-fit_trimmed_masterwork_melee_gloves", bonuses: { armour: 114.3, prayer: 2, damage: 14.3 } },
  { id: "item:custom-fit-trimmed-masterwork-melee-boots", name: "Custom-fit trimmed masterwork melee boots", style: "melee", slot: "boots", tier: 92, setId: "custom-fit-trimmed-masterwork", wiki: "Custom-fit_trimmed_masterwork_melee_boots", bonuses: { armour: 114.3, prayer: 2, damage: 14.3 } },
  // Custom-fit masterwork magic — same stats as MW magic base; Crafting Guild Master Crafter.
  { id: "item:custom-fit-masterwork-magic-hat", name: "Custom-fit masterwork magic hat", style: "magic", slot: "helmet", tier: 100, setId: "custom-fit-masterwork-magic", wiki: "Custom-fit_masterwork_magic_hat", bonuses: { armour: 553, prayer: 2, life: 950 } },
  { id: "item:custom-fit-masterwork-magic-robe-top", name: "Custom-fit masterwork magic robe top", style: "magic", slot: "body", tier: 100, setId: "custom-fit-masterwork-magic", wiki: "Custom-fit_masterwork_magic_robe_top", bonuses: { armour: 635.9, prayer: 3, life: 1425 } },
  { id: "item:custom-fit-masterwork-magic-robe-bottom", name: "Custom-fit masterwork magic robe bottom", style: "magic", slot: "legs", tier: 100, setId: "custom-fit-masterwork-magic", wiki: "Custom-fit_masterwork_magic_robe_bottom", bonuses: { armour: 608.3, prayer: 2, life: 1425 } },
  { id: "item:custom-fit-masterwork-magic-gloves", name: "Custom-fit masterwork magic gloves", style: "magic", slot: "gloves", tier: 100, setId: "custom-fit-masterwork-magic", wiki: "Custom-fit_masterwork_magic_gloves", bonuses: { armour: 138.2, prayer: 2, life: 475 } },
  { id: "item:custom-fit-masterwork-magic-boots", name: "Custom-fit masterwork magic boots", style: "magic", slot: "boots", tier: 100, setId: "custom-fit-masterwork-magic", wiki: "Custom-fit_masterwork_magic_boots", bonuses: { armour: 138.2, prayer: 2, life: 475 } },
  // Custom-fit masterwork ranged — same stats as MW ranged base.
  { id: "item:custom-fit-masterwork-ranged-cowl", name: "Custom-fit masterwork ranged cowl", style: "ranged", slot: "helmet", tier: 100, setId: "custom-fit-masterwork-ranged", wiki: "Custom-fit_masterwork_ranged_cowl", bonuses: { armour: 553, prayer: 2, life: 950 } },
  { id: "item:custom-fit-masterwork-ranged-body", name: "Custom-fit masterwork ranged body", style: "ranged", slot: "body", tier: 100, setId: "custom-fit-masterwork-ranged", wiki: "Custom-fit_masterwork_ranged_body", bonuses: { armour: 635.9, prayer: 3, life: 1425 } },
  { id: "item:custom-fit-masterwork-ranged-chaps", name: "Custom-fit masterwork ranged chaps", style: "ranged", slot: "legs", tier: 100, setId: "custom-fit-masterwork-ranged", wiki: "Custom-fit_masterwork_ranged_chaps", bonuses: { armour: 608.3, prayer: 2, life: 1425 } },
  { id: "item:custom-fit-masterwork-ranged-vambraces", name: "Custom-fit masterwork ranged vambraces", style: "ranged", slot: "gloves", tier: 100, setId: "custom-fit-masterwork-ranged", wiki: "Custom-fit_masterwork_ranged_vambraces", bonuses: { armour: 138.2, prayer: 2, life: 475 } },
  { id: "item:custom-fit-masterwork-ranged-boots", name: "Custom-fit masterwork ranged boots", style: "ranged", slot: "boots", tier: 100, setId: "custom-fit-masterwork-ranged", wiki: "Custom-fit_masterwork_ranged_boots", bonuses: { armour: 138.2, prayer: 2, life: 475 } },
  // Base Morrigan weapons (t78) — superior already catalogued; no OH variants on wiki.
  { id: "item:morrigans-javelin", name: "Morrigan's javelin", style: "ranged", slot: "mainhand", tier: 78, wiki: "Morrigan%27s_javelin", bonuses: { damage: 1162.2, accuracy: 1829 } },
  { id: "item:morrigans-throwing-axe", name: "Morrigan's throwing axe", style: "ranged", slot: "mainhand", tier: 78, wiki: "Morrigan%27s_throwing_axe", bonuses: { damage: 955.5, accuracy: 1829 } },
  // First Necromancer helm ladder residual (crown already present).
  { id: "item:misalionars-death-mask", name: "Misalionar's death mask", style: "necromancy", slot: "helmet", tier: 95, setId: "first-necromancer", wiki: "Misalionar%27s_death_mask", bonuses: { armour: 491.6, damage: 23.7 } },
  { id: "item:visage-of-the-first-necromancer", name: "Visage of the First Necromancer", style: "necromancy", slot: "helmet", tier: 95, setId: "first-necromancer", wiki: "Visage_of_the_First_Necromancer", bonuses: { armour: 491.6, damage: 23.7 } },
]) {
  CATALOG_EXTRA.push({
    id: row.id,
    name: row.name,
    style: row.style,
    slot: row.slot,
    tier: row.tier,
    ...(row.setId ? { setId: row.setId } : {}),
    bonuses: row.bonuses || {},
    sources: [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${row.wiki}`, verifiedAt: "2026-07-26" }],
  });
}

/** @type {string[]} ids newly pushed this run (for pass3 report) */
const catalogInjectedThisRun = [];
{
  const have = new Set(records.map((r) => r.id));
  let injected = 0;
  for (const row of CATALOG_EXTRA) {
    if (have.has(row.id)) continue;
    records.push({ ...row });
    have.add(row.id);
    injected++;
    catalogInjectedThisRun.push(row.id);
  }
  if (injected) {
    eqFile.records = records;
    console.log(`catalog inject: +${injected} missing wearables (deathwarden / obsidian / gemstone / gwd1 / ports-arc / pass6-bis / pass9-bis)`);
  }
}

const byId = new Map(); // bare id → record
const byKebabName = new Map(); // kebab(name) → record[]
const byLowerName = new Map();

for (const rec of records) {
  const bare = stripItemPrefix(rec.id);
  byId.set(bare, rec);
  byId.set(rec.id, rec);
  const kn = kebab(rec.name);
  if (!byKebabName.has(kn)) byKebabName.set(kn, []);
  byKebabName.get(kn).push(rec);
  byLowerName.set(String(rec.name).toLowerCase(), rec);
}

function resolveEquipmentKeys(rawName) {
  if (!rawName) return [];
  const k = kebab(rawName);
  const keys = new Set();
  const alias = ALIASES.get(k);
  if (alias && byId.has(alias)) keys.add(alias);
  if (byId.has(k)) keys.add(k);
  if (byId.has(`item:${k}`)) keys.add(k);
  for (const rec of byKebabName.get(k) || []) keys.add(stripItemPrefix(rec.id));
  const lower = String(rawName).toLowerCase().replace(/\([^)]*\)/g, "").trim();
  if (byLowerName.has(lower)) keys.add(stripItemPrefix(byLowerName.get(lower).id));
  // partial: "Tectonic mask" already covered; try without trailing fluff words
  return [...keys];
}

/** Match unlocks/effects prose fragments to wearables that exist. */
function extractNameCandidates(text) {
  if (!text || typeof text !== "string") return [];
  const out = [];
  // split common delimiters
  const chunks = text
    .split(/[;|]/)
    .flatMap((p) => p.split(/(?:,\s+|\s+\/\s+|\s+\+\s+)/))
    .map((s) => s.replace(/\s*[—–-]\s*.*$/, "").replace(/\s*\(.*?\)\s*/g, " ").trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    // drop pure ability / passive prose
    if (/^(effects?|optional|strong|top-end|tier-|t\d+|hard |primary |residual |wiki |do not)/i.test(chunk)) continue;
    if (chunk.length > 80) continue;
    out.push(chunk);
    // also try leading capitalised phrase before " with/for/from"
    const lead = chunk.match(/^([A-Z][\w'’ -]+?)(?:\s+(?:with|for|from|and|→|->|T\d+|t\d+|\+).*)?$/);
    if (lead) out.push(lead[1].trim());
  }
  return out;
}

// ─── 1) regional-combat-unlocks.json ─────────────────────────────────────────
const combatUnlocks = read(COMBAT_UNLOCKS);
for (const rec of combatUnlocks.records ?? []) {
  if (rec.recordType !== "equipment") continue;
  // Corpus still has asgarnia:combat-scrimshaw-pocket-package as hard Asgarnia —
  // user ruling: invent/POP scrimshaws are NOT region-gated like EoF. Skip whole row.
  if (/scrimshaw/i.test(rec.id || "") || /scrimshaw/i.test(rec.name || "")) continue;
  const req = regionList(rec.requiredRegions);
  const hints = regionList(rec.regionHints);
  const type = String(rec.regionRequirementType || "").toLowerCase();
  const hard =
    req.length > 0 &&
    !/support|self_supply|pressure|alternates/.test(type);
  // Prefer required over soft hints alone — skip soft-only unless single-region hard-ish name match later via families
  const regions =
    hard
      ? type === "all_required" || rec.isRegionCombo || req.length > 1
        ? req
        : req
      : [];
  if (!regions.length) continue;

  const meta = {
    source: `regional-combat-unlocks:${rec.id}`,
    hard: true,
    requirement: rec.name,
    note: type,
  };

  // direct name
  for (const key of resolveEquipmentKeys(rec.name)) addClaim(key, regions, meta);

  // detail unlocks line only (skip Effects: — names competing BiS)
  const detail = String(rec.detail || "");
  const unlocksMatch = /Unlocks:\s*([^·]+)/i.exec(detail);
  if (unlocksMatch) {
    for (const cand of extractNameCandidates(unlocksMatch[1])) {
      for (const key of resolveEquipmentKeys(cand)) {
        addClaim(key, regions, { ...meta, note: `${type}|unlock` });
      }
    }
  }
}

// ─── 2) progression-enrichment-regional-combat*.json ─────────────────────────
const enrichFiles = readdirSync(join(ROOT, "scraped-data")).filter((n) => ENRICH_RE.test(n)).sort();
for (const file of enrichFiles) {
  const data = read(`scraped-data/${file}`);
  for (const row of data.equipment_additions ?? []) {
    const req = regionList(row.required_regions ?? row.requiredRegions);
    const type = String(row.region_requirement_type || "").toLowerCase();
    if (!req.length) continue; // soft region_hints alone — do not stamp
    if (/support|self_supply|pressure|alternates/.test(type) && req.length === 0) continue;

    const hard = true;
    const regions =
      type === "all_required" || req.length > 1 ? req : req;
    const meta = {
      source: `enrichment:${file}:${row.id}`,
      hard,
      requirement: row.name,
      note: type || "required_regions",
    };

    for (const key of resolveEquipmentKeys(row.name)) addClaim(key, regions, meta);

    // unlocks[] only — NEVER effects/notes (those name competing BiS from other regions)
    for (const u of list(row.unlocks)) {
      for (const cand of extractNameCandidates(String(u))) {
        for (const key of resolveEquipmentKeys(cand)) {
          addClaim(key, regions, { ...meta, note: `${meta.note}|unlock` });
        }
      }
    }
  }
}

// ─── 3) major-upgrades-by-region examples ────────────────────────────────────
const major = read(MAJOR);
for (const [regionRaw, entries] of Object.entries(major.regions ?? {})) {
  const region = normRegion(regionRaw);
  if (!VALID.has(region)) continue;
  for (const entry of entries) {
    const meta = {
      source: `major-upgrades:${region}:${entry.name}`,
      hard: true,
      requirement: entry.name,
      note: entry.category || "",
    };
    // Whitelist set-root expansions only (never free-form comparison prose).
    // Base sirenic intentionally omitted — multi-source pressure only; elite via family:elite-sirenic.
    const SET_ROOTS = [
      "torva", "pernix", "virtus", "bandos", "armadyl", "subjugation",
      "anima-core", "malevolent", "tectonic", "cryptbloom",
      "dracolich", "chaotic", "drygore", "noxious", "death-lotus", "tetsu",
      "seasinger", "achto", "igneous-kal", "tokhaar-kal",
    ];
    for (const ex of list(entry.examples)) {
      for (const key of resolveEquipmentKeys(ex)) addClaim(key, [region], meta);
      let setTok = kebab(ex)
        .replace(/-equipment$/, "")
        .replace(/-armour$/, "")
        .replace(/-components$/, "")
        .replace(/-weapons?$/, "")
        .replace(/-capes?$/, "");
      if (setTok.startsWith("anima-core")) setTok = "anima-core";
      if (setTok.includes("subjugation")) setTok = "subjugation";
      const root = SET_ROOTS.find((r) => setTok === r || setTok.startsWith(`${r}-`));
      if (!root) continue;
      for (const rec of records) {
        const bare = stripItemPrefix(rec.id);
        const kn = kebab(rec.name);
        const hit =
          kn === root ||
          kn.startsWith(`${root}-`) ||
          bare === root ||
          bare.startsWith(`${root}-`) ||
          (root === "subjugation" && /of-subjugation$/.test(kn)) ||
          (root === "anima-core" && /anima-core/.test(kn));
        if (hit) addClaim(bare, [region], meta);
      }
    }
  }
}

// ─── 4) family expansions (corpus hubs → wearables in equipment.json) ────────
// Only patterns backed by major-upgrades hubs or explicit user family table.
const FAMILY = [
  // desert
  {
    regions: ["desert"],
    requirement: "Drygore weapons",
    source: "family:desert-drygore",
    test: (r) => /^(off-hand )?drygore (mace|rapier|longsword)$/i.test(r.name),
  },
  {
    // Kalphite King residual defenders (pass2 — not covered by drygore family alone).
    // pass6: +rebounder magic OH sibling.
    regions: ["desert"],
    requirement: "Kalphite King defender residual",
    source: "family:desert-kalphite-defenders",
    test: (r) => /^(kalphite defender|kalphite repriser|kalphite rebounder)$/i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "Telos weapon progression",
    source: "family:desert-telos",
    test: (r) => /^(seren godbow|staff of sliske|zaros godsword)$/i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "God Wars Dungeon 2 weapon and anima-core progression",
    source: "family:desert-gwd2",
    test: (r) =>
      /^(dragon rider lance|wand of the cywir elders|orb of the cywir elders|shadow glaive|off-hand shadow glaive|blade of avaryss|blade of nymora)$/i.test(
        r.name,
      ) ||
      /^(refined )?anima core (helm|body|legs) of (seren|sliske|zamorak|zaros)$/i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "Amascut, the Devourer progression",
    source: "family:desert-amascut",
    test: (r) =>
      /^(devourer'?s guard|tumeken'?s light|shard of genesis essence)$/i.test(r.name) ||
      /^((mask|robe top|robe bottom|gloves|boots) of )?tumeken'?s resplendence/i.test(r.name) ||
      /tumeken'?s resplendence/i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "Gloves of passage / Magister",
    source: "family:desert-passage",
    test: (r) => /^(enhanced )?gloves of passage$/i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "Khopesh of Tumeken / Elidinis",
    source: "family:desert-khopesh",
    test: (r) => /khopesh of (tumeken|elidinis|the kharidian)/i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "Inquisitor staff",
    source: "family:desert-inquisitor",
    test: (r) => /^inquisitor staff$/i.test(r.name),
  },
  {
    // Mazcab = desert (user + corpus rule). Base Teralith/Tempest/Primeval + Achto.
    // Pass2: base sets were pass1 misses (Achto-only in agent-region-map-desert-morytania).
    regions: ["desert"],
    requirement: "Liberation of Mazcab armour (Teralith / Tempest / Primeval / Achto)",
    source: "family:desert-mazcab-armour",
    test: (r) =>
      /^(achto )?(teralith|tempest|primeval) /i.test(r.name) ||
      /^achto /i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "Camel staff (Camel Warriors island)",
    source: "family:desert-camel-staff",
    test: (r) => /^camel staff$/i.test(r.name),
  },
  {
    // Ripper Demon cave wiki dual Desert + Wilderness (pass6).
    regions: ["desert", "forinthry"],
    requirement: "Ripper claws (Ripper Demon cave)",
    source: "family:desert-forinthry-ripper-claws",
    test: (r) => /^(off-hand )?ripper claw$/i.test(r.name),
  },

  // morytania
  {
    regions: ["morytania"],
    requirement: "Noxious weapons",
    source: "family:morytania-noxious",
    test: (r) => /^noxious (scythe|longbow|staff)$/i.test(r.name),
  },
  {
    regions: ["morytania"],
    requirement: "Rise of the Six progression",
    source: "family:morytania-malevolent",
    test: (r) =>
      /^(malevolent (helm|cuirass|greaves|energy|kiteshield|armour)|malevolent (body|legs))$/i.test(r.name) ||
      /^malevolent /i.test(r.name),
  },
  {
    regions: ["morytania"],
    requirement: "Salve amulet (e)",
    source: "family:morytania-salve",
    test: (r) => /^salve amulet/i.test(r.name),
  },
  {
    regions: ["morytania"],
    // Wearable amulet + Barrows→Berserker's Fury progression residual (same Barrows source).
    requirement: "Amulet of the forsaken / Berserker's Fury chain",
    source: "family:morytania-forsaken",
    test: (r) => /^amulet of the forsaken/i.test(r.name),
  },
  {
    regions: ["morytania"],
    // t70: corruption sigil + Barrows weapons; t80 ancient line kept mory per corpus (emblem is Nex).
    // pass2: reclaim corrupted/tainted from false Forinthry DG claim.
    requirement: "Barrows defenders / corruption sigil ladder",
    source: "family:morytania-defenders",
    // pass6 had "ancient rebounder" — pass9: that name is a wiki redirect to Ancient lantern
    // (invent-global USER_FORCE clear). Keep defender/repriser/t70 ladder only.
    test: (r) =>
      /^(ancient defender|ancient repriser|corrupted defender|tainted repriser|sunspear)/i.test(
        r.name,
      ),
  },
  {
    regions: ["morytania"],
    requirement: "Polypore Dungeon (ganodermic / polypore staff)",
    source: "family:morytania-polypore",
    test: (r) => /^polypore staff$/i.test(r.name) || /^ganodermic /i.test(r.name),
  },
  {
    regions: ["morytania"],
    // RoTS style shields — NOT Vorago (pass1 asgarnia-rago-shields was false).
    requirement: "Barrows: Rise of the Six style kiteshields",
    source: "family:morytania-rots-kiteshields",
    test: (r) => /^(vengeful|merciless) kiteshield$/i.test(r.name),
  },
  {
    // Classic Barrows brothers + Akrisae / Linza residual weapons (armour pieces not in catalog).
    // pass6 densify: durable family so agent-map-only stamps survive corpus re-runs.
    regions: ["morytania"],
    requirement: "Barrows brothers weapons (classic + Akrisae / Linza)",
    source: "family:morytania-barrows-weapons",
    test: (r) =>
      /^(ahrim'?s? |dharok'?s? |guthan'?s? |karil'?s? |torag'?s? |verac'?s? |akrisae'?s? |linza'?s? )/i.test(
        r.name,
      ) || /^book of magic$/i.test(r.name), // ahrims-book-of-magic scrape name
  },
  {
    // Branches of Darkmeyer / vyre combat blisterwood weapons.
    regions: ["morytania"],
    requirement: "Blisterwood weapons (Darkmeyer / vyre combat)",
    source: "family:morytania-blisterwood",
    test: (r) => /^blisterwood /i.test(r.name),
  },

  // asgarnia — GWD1 / Nex / Vorago / AoD
  {
    regions: ["asgarnia"],
    requirement: "God Wars Dungeon 1 equipment",
    source: "family:asgarnia-bandos",
    test: (r) => /^bandos /i.test(r.name) && !/godsword/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "God Wars Dungeon 1 equipment",
    source: "family:asgarnia-armadyl",
    // Off-hand Armadyl crossbow missed by bare ^armadyl; exclude FSoA / staff of Armadyl (Misthalin).
    test: (r) =>
      /^(off-hand )?armadyl /i.test(r.name) &&
      !/godsword|battlestaff|fractured|staff of armadyl/i.test(r.name),
  },
  {
    // GWD1 unique weapons outside armour/godsword set-root expansions (Zilyana / K'ril leftovers).
    // Staff of light is ice strykewyrms (Fremennik) — never GWD1; see family:fremennik-staff-of-light.
    regions: ["asgarnia"],
    requirement: "God Wars Dungeon 1 unique weapons",
    source: "family:asgarnia-gwd1-unique-weapons",
    test: (r) => /^(saradomin sword|zamorakian spear)$/i.test(r.name),
  },
  {
    // Commander Zilyana residual amulets (style-split necks).
    regions: ["asgarnia"],
    requirement: "God Wars Dungeon 1 equipment",
    source: "family:asgarnia-gwd1-amulets",
    test: (r) => /^saradomin'?s (murmur|hiss|whisper)$/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "God Wars Dungeon 1 equipment",
    source: "family:asgarnia-subjugation",
    test: (r) => /of subjugation$/i.test(r.name) || /^ward of subjugation$/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "God Wars Dungeon 1 equipment",
    source: "family:asgarnia-godswords",
    test: (r) => /^(armadyl|bandos|saradomin|zamorak) godsword$/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Nex equipment",
    source: "family:asgarnia-torva",
    test: (r) => /^torva /i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Nex equipment",
    source: "family:asgarnia-pernix",
    test: (r) => /^pernix /i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Nex equipment",
    source: "family:asgarnia-virtus",
    test: (r) => /^virtus /i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Vorago progression",
    source: "family:asgarnia-seismic-tectonic",
    test: (r) =>
      /^(seismic wand|seismic singularity)$/i.test(r.name) ||
      /^(elite )?tectonic /i.test(r.name) ||
      /^tectonic (mask|robe|energy|helm|body|legs)/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Nex: Angel of Death progression",
    source: "family:asgarnia-praesul",
    test: (r) => /^(wand of the praesul|imperium core|praesul codex)$/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Essence of Finality amulet (neck BiS chain)",
    source: "family:asgarnia-eof",
    test: (r) => /^essence of finality/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Royal crossbow",
    source: "family:asgarnia-royal-xbow",
    test: (r) => /^royal crossbow$/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Zaryte / masuta / armadyl battlestaff",
    source: "family:asgarnia-misc",
    // Wyvern crossbow is dual asgarnia+forinthry (Ice Dungeon + Frozen Waste Plateau) — stamped below.
    test: (r) => /^(zaryte bow|masuta'?s warspear|armadyl battlestaff)$/i.test(r.name),
  },
  {
    regions: ["asgarnia", "forinthry"],
    requirement: "Wyvern crossbow (Asgarnian Ice Dungeon + Frozen Waste Plateau)",
    source: "family:asgarnia-forinthry-wyvern-crossbow",
    test: (r) => /^wyvern crossbow$/i.test(r.name),
  },
  // elite tectonic is asgarnia+forinthry — stamped below as combo family

  // forinthry
  {
    regions: ["forinthry"],
    requirement: "Chaotic equipment",
    source: "family:forinthry-chaotic",
    test: (r) => /^(off-hand )?chaotic /i.test(r.name),
  },
  {
    regions: ["forinthry"],
    requirement: "Shadow Reef progression",
    source: "family:forinthry-eldritch",
    test: (r) => /^eldritch crossbow/i.test(r.name),
  },
  {
    regions: ["forinthry"],
    requirement: "Wilderness T87 style weapons",
    source: "family:forinthry-t87",
    test: (r) => /^(annihilation|decimation|obliteration)$/i.test(r.name),
  },
  {
    // Dominion Tower ruinous set is Wilderness geography for League electives (user 2026-07-26).
    regions: ["forinthry"],
    requirement: "Ruinous weapons (Wilderness / Dominion Tower path)",
    source: "family:forinthry-ruinous",
    test: (r) => /^(off-hand )?ruinous /i.test(r.name),
  },
  {
    // Lava whip = abyssal whip + wyrm spike (Wildywyrm). Vine whip is whip + jadinko vine — not Forinthry.
    regions: ["forinthry"],
    requirement: "Lava whip (wyrm spike / Wildywyrm)",
    source: "family:forinthry-lava-wyrm",
    test: (r) => /^lava whip$/i.test(r.name),
  },
  {
    // Abyssal whip (Morytania primary) + whip vine (Jadinko Lair / Herblore Habitat = Karamja).
    regions: ["morytania", "karamja"],
    requirement: "Abyssal vine whip (whip + whip vine)",
    source: "family:morytania-karamja-vine-whip",
    test: (r) => /^abyssal vine whip$/i.test(r.name),
  },
  {
    // Base + superior ancient warriors (Wilderness). Base Zuriel was empty after pass1.
    regions: ["forinthry"],
    requirement: "Ancient warrior weapons (Wilderness residual)",
    source: "family:forinthry-ancient-warrior",
    test: (r) =>
      /^(superior )?(statius'?s?|vesta'?s?|morrigan'?s?|zuriel'?s?) /i.test(r.name) ||
      /^(superior )?(statius|vesta|morrigan|zuriel)/i.test(r.name),
  },
  {
    regions: ["forinthry"],
    requirement: "Hexhunter bow",
    source: "family:forinthry-hexhunter",
    // Hexhunter bow + real ammo is Stalker arrows (wiki).
    test: (r) => /^hexhunter bow$/i.test(r.name) || /^stalker arrows?$/i.test(r.name),
  },
  {
    // Ring of vigour base (DG tokens). Warped-gem passive is Extinction quest overlay — not a 2nd elective.
    regions: ["forinthry"],
    requirement: "Ring of vigour (Daemonheim tokens)",
    source: "family:forinthry-ring-of-vigour",
    test: (r) => /^ring of vigour$/i.test(r.name),
  },
  {
    // Mage Arena Guthix staff — Claws of Guthix / EoF residual.
    regions: ["forinthry"],
    requirement: "Guthix staff (Mage Arena)",
    source: "family:forinthry-guthix-staff",
    test: (r) => /^guthix staff$/i.test(r.name),
  },
  {
    // Spirit cape DG token purchase (also unlocks permanent familiar special discount).
    regions: ["forinthry"],
    requirement: "Spirit cape (Daemonheim tokens)",
    source: "family:forinthry-spirit-cape",
    test: (r) => /^spirit cape$/i.test(r.name),
  },
  {
    // Tormented demons at Ancient Guthix Temple — Misthalin (wiki / corpus dragon-claws residual).
    // MH catalog is plural "Dragon claws"; OH wiki item is singular "Off-hand dragon claw".
    regions: ["misthalin"],
    requirement: "Dragon claws (Tormented demons)",
    source: "family:misthalin-dragon-claws",
    test: (r) => /^(off-hand )?dragon claws?$/i.test(r.name),
  },
  {
    regions: ["forinthry"],
    requirement: "Spirit shield sigils",
    source: "family:forinthry-spirit-shield",
    test: (r) => /^(divine|arcane|elysian|spectral|blessed) spirit shield$/i.test(r.name),
  },
  {
    // Mercenary's gloves only — true Daemonheim token residual.
    // Corrupted defender / tainted repriser are Barrows t70 ladder → morytania (USER_FORCE).
    regions: ["forinthry"],
    requirement: "Daemonheim token residual (mercenary gloves)",
    source: "family:forinthry-dg-token-residual",
    test: (r) => /^mercenary'?s gloves$/i.test(r.name),
  },

  // kandarin
  {
    regions: ["kandarin"],
    requirement: "Ascension crossbows",
    source: "family:kandarin-ascension",
    test: (r) => /^(off-hand )?ascension (crossbow|grips)$/i.test(r.name),
  },
  {
    regions: ["kandarin"],
    requirement: "Nightmare gauntlets",
    source: "family:kandarin-nightmare",
    test: (r) => /^nightmare gauntlets$/i.test(r.name), // enhanced is misthalin
  },

  // tirannwn
  {
    regions: ["tirannwn"],
    requirement: "Blightbound crossbows",
    source: "family:tirannwn-blightbound",
    test: (r) => /^(off-hand )?blightbound crossbow$/i.test(r.name),
  },
  {
    regions: ["tirannwn"],
    requirement: "Cinderbane gloves",
    source: "family:tirannwn-cinderbane",
    test: (r) => /^cinderbane gloves$/i.test(r.name),
  },
  {
    regions: ["tirannwn"],
    requirement: "Erethdor's grimoire / Solak",
    source: "family:tirannwn-solak",
    test: (r) => /^erethdor'?s grimoire$/i.test(r.name),
  },
  {
    regions: ["tirannwn"],
    requirement: "Attuned crystal weapons",
    source: "family:tirannwn-crystal",
    test: (r) => /^(off-hand )?attuned crystal /i.test(r.name),
  },
  {
    // Base (non-attuned) crystal weapons share Prif singing-bowl / crystal-seed path.
    regions: ["tirannwn"],
    requirement: "Base crystal weapons (Prifddinas)",
    source: "family:tirannwn-base-crystal",
    test: (r) =>
      /^(off-hand )?crystal (dagger|halberd|bow|deflector|wand|orb|staff|chakram)$/i.test(r.name),
  },

  // misthalin
  {
    regions: ["misthalin"],
    requirement: "Cryptbloom armour",
    source: "family:misthalin-cryptbloom",
    test: (r) => /^cryptbloom /i.test(r.name),
  },
  {
    // Fort Forinthry / Zemouregal & Vorkath — not Misthalin EGWD (pass6).
    regions: ["forinthry"],
    requirement: "Dracolich armour (Zemouregal & Vorkath / Fort Forinthry)",
    source: "family:forinthry-dracolich",
    test: (r) => /^(elite )?dracolich /i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Vestments of havoc",
    source: "family:misthalin-vestments",
    test: (r) => /vestments of havoc/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Dark ice → Dark Shard/Sliver of Leng",
    source: "family:misthalin-leng",
    test: (r) =>
      /^(dark ice (shard|sliver)|dark (shard|sliver) of leng|frozen core of leng|leng artefact)$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Fractured Staff of Armadyl",
    source: "family:misthalin-fsoa",
    test: (r) => /fractured staff of armadyl|staff of armadyl/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Ek-ZekKil (Zuk 2h melee)",
    source: "family:misthalin-ekzekkil",
    test: (r) => /^ek-zekkil$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Bow of the Last Guardian",
    source: "family:misthalin-bolg",
    test: (r) => /^bow of the last guardian$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Roar of Awakening / Ode to Deceit",
    source: "family:misthalin-sanctum",
    test: (r) => /^(roar of awakening|ode to deceit)$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "First Necromancer's equipment",
    source: "family:misthalin-rasial",
    // Omni / Soulbound + full First Necromancer robe set (crown/top/bottom/wraps + set row)
    test: (r) =>
      /^(omni guard|soulbound lantern)$/i.test(r.name) ||
      /first necromancer/i.test(r.name) ||
      /^robes of the first/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    // Spaced wiki name "Death guard (tier N)" AND unspaced catalog "Deathguard" / "Deathguard (tier N)"
    // plus Skull lantern OH ladder — City of Um craft path (misthalin:death-guard-skull-lantern).
    // Id match is mandatory: bare ids deathguard / skull-lantern collide with kebab(name) of
    // tiered siblings if apply-path only uses bare-key byId (fixed in reindex + claim resolve).
    requirement: "Death guard / Skull lantern (City of Um)",
    source: "family:misthalin-death-guard",
    test: (r) =>
      /^(deathguard|death guard)\b/i.test(r.name) ||
      /^skull lantern\b/i.test(r.name) ||
      /^item:death-?guard/i.test(r.id) ||
      /^item:skull-lantern/i.test(r.id),
  },
  {
    regions: ["misthalin"],
    // Power (Deathdealer) + tank (Deathwarden) Um soul-forge ladders (City of Um / Misthalin).
    // Deathwarden pieces injected via CATALOG_EXTRA when equipment.json lacks them (pass3).
    requirement: "Deathdealer / Deathwarden armour",
    source: "family:misthalin-necro-armour",
    test: (r) =>
      /^(deathdealer|deathwarden)\b/i.test(r.name) ||
      /^item:(deathdealer|deathwarden)-/i.test(r.id),
  },
  {
    regions: ["misthalin"],
    // EGWD + Sanctum + Gate of Elidinis pocket books — hard Misthalin (not Desert Amascut weapons).
    requirement: "EGWD / Sanctum / Gate scriptures",
    source: "family:misthalin-scripture",
    test: (r) => /^scripture of (jas|wen|ful|bik|amascut|elidinis)$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Kerapac residual / Leng glove ladder",
    source: "family:misthalin-gloves-upgrades",
    test: (r) =>
      /^(kerapac'?s wrist wraps|enhanced kerapac'?s wrist wraps|enhanced nightmare gauntlets|enhanced gloves of passage)$/i.test(
        r.name,
      ),
  },
  {
    // Abyssal lords: wiki dual Misthalin + Wilderness (match jaws-of-the-abyss) (pass6).
    regions: ["misthalin", "forinthry"],
    requirement: "Abyssal scourge (abyssal lords / Senntisten Asylum + Wilderness)",
    source: "family:misthalin-forinthry-scourge",
    test: (r) => /^abyssal scourge$/i.test(r.name),
  },

  // karamja + misthalin igneous
  {
    regions: ["karamja", "misthalin"],
    requirement: "Igneous cape progression",
    source: "family:igneous-capes",
    test: (r) => /^igneous kal-/i.test(r.name),
  },
  {
    regions: ["karamja"],
    requirement: "TokHaar-Kal capes",
    source: "family:karamja-tokhaar",
    test: (r) => /^tokhaar-kal-/i.test(r.name),
  },
  {
    regions: ["karamja"],
    // Fight Cauldron shard craft — corpus karamja:fight-cauldron-obsidian-support.
    requirement: "Fight Cauldron obsidian armour progression",
    source: "family:karamja-obsidian",
    test: (r) =>
      /^obsidian (warrior helm|ranger helm|mage helm|platebody|platelegs|plateskirt|gloves|boots|kiteshield)$/i.test(
        r.name,
      ),
  },
  {
    // Wiki: Gemstone cavern under Shilo Village mine — hard Karamja (gloves 3 / Kelhar).
    // Pass4 anachronia override was false; Dragonkin Lab dragons ≠ armour residual.
    regions: ["karamja"],
    requirement: "Gemstone armour (Shilo gemstone cavern / gemstone dragons)",
    source: "family:karamja-gemstone",
    test: (r) => /^gemstone (helm|hauberk|greaves|gauntlets|boots)$/i.test(r.name),
  },

  // anachronia boots
  {
    regions: ["anachronia"],
    requirement: "Raksha boot upgrades",
    source: "family:anachronia-boots",
    test: (r) =>
      /^(enhanced )?(laceration|fleeting|blast diffusion) boots$/i.test(r.name),
  },
  {
    regions: ["anachronia"],
    requirement: "Terrasaur maul",
    source: "family:anachronia-terrasaur",
    test: (r) => /^terrasaur maul$/i.test(r.name),
  },
  {
    regions: ["anachronia"],
    requirement: "Laniakea's spear",
    source: "family:anachronia-laniakea",
    test: (r) => /^laniakea'?s spear$/i.test(r.name),
  },
  // matriarch rings — hearts anachronia; base rings fremennik for upgraded combos
  {
    regions: ["anachronia"],
    requirement: "Occultist's ring",
    source: "family:anachronia-occultist",
    test: (r) => /^occultist'?s ring$/i.test(r.name),
  },

  // fremennik glacor boots
  {
    regions: ["fremennik"],
    requirement: "Dagannoth / glacor boots base",
    source: "family:fremennik-glacor-boots",
    test: (r) => /^(steadfast|ragefire|glaiven) boots$/i.test(r.name),
  },
  {
    regions: ["fremennik", "forinthry"],
    requirement: "T90 glacor-upgraded boots",
    source: "family:t90-glacor-boots",
    test: (r) => /^(emberkeen|hailfire|flarefrost) boots$/i.test(r.name),
  },

  // cross-region rings (anachronia heart + fremennik base)
  {
    regions: ["anachronia", "fremennik"],
    requirement: "Reaver's / Stalker's / Channeller's / Champion's ring",
    source: "family:matriarch-rings",
    test: (r) => /^(reaver'?s|stalker'?s|channell?er'?s|champion'?s) ring$/i.test(r.name),
  },

  // trimmed masterwork melee armour only — asgarnia + morytania
  // (do not match "Trimmed Masterwork Spear..." phantoms — pass7 REMOVE_IDS)
  // pass9: also custom-fit trimmed masterwork melee * (distinct wiki ids)
  {
    regions: ["asgarnia", "morytania"],
    requirement: "Trimmed / custom-fit trimmed masterwork melee armour",
    source: "family:trimmed-masterwork",
    test: (r) =>
      (/^(custom-fit )?trimmed masterwork /i.test(r.name) ||
        /^custom-fit trimmed masterwork melee /i.test(r.name)) &&
      !/spear/i.test(r.name),
  },
  // base masterwork plates — asgarnia hub (Artisans') is primary; still stamp asgarnia from MW chain pressure
  {
    regions: ["asgarnia"],
    requirement: "Masterwork melee armour (Artisans' Workshop)",
    source: "family:masterwork-melee",
    test: (r) =>
      /^masterwork (helm|platebody|platelegs|gloves|boots)$/i.test(r.name) &&
      !/trimmed|spear|staff|bow|2h|sword/i.test(r.name),
  },
  {
    regions: ["asgarnia", "morytania"],
    requirement: "Masterwork Spear of Annihilation",
    source: "family:mw-spear",
    test: (r) => /masterwork spear of annihilation/i.test(r.name),
  },

  // elite tectonic: asgarnia + forinthry
  {
    regions: ["asgarnia", "forinthry"],
    requirement: "Elite tectonic robe armour",
    source: "family:elite-tectonic",
    test: (r) => /^elite tectonic /i.test(r.name),
  },

  // elite sirenic — asgarnia required (Pernix essence / Arc packaging); do not force multi soft-hints
  {
    regions: ["asgarnia"],
    requirement: "Elite sirenic armour",
    source: "family:elite-sirenic",
    test: (r) => /^elite sirenic /i.test(r.name),
  },

  // masterwork 2h sword / bow / staff cross-region from enrichment
  {
    // Chaotic essence (DG/Forinthry) + drygore + Twin Furies blades (Desert).
    // No Artisans Workshop / Asgarnia hard residual (pass6 strip false asgarnia).
    regions: ["desert", "forinthry"],
    requirement: "Masterwork 2h sword",
    source: "family:mw-2h-sword",
    test: (r) => /^masterwork 2h sword$/i.test(r.name),
  },
  {
    regions: ["morytania", "kandarin"],
    requirement: "Masterwork bow",
    source: "family:mw-bow",
    test: (r) => /^masterwork bow$/i.test(r.name),
  },
  {
    regions: ["asgarnia", "desert", "tirannwn"],
    requirement: "Masterwork staff",
    source: "family:mw-staff",
    test: (r) => /^masterwork staff$/i.test(r.name),
  },

  // User: LOTD / hydrix residuals / illuminated books / underworld grim = Misthalin.
  {
    regions: ["misthalin"],
    requirement: "Luck of the Dwarves",
    source: "family:misthalin-lotd",
    test: (r) => /^luck of the dwarves$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Reaper necklace / Amulet of souls / Ring of death (Misthalin)",
    source: "family:misthalin-hydrix-residuals",
    test: (r) => /^(reaper necklace|amulet of souls|ring of death)$/i.test(r.name),
  },
  {
    // Illumination at Abbey of St. Elspeth Citharede (east of Al Kharid) = Desert — not Misthalin.
    regions: ["desert"],
    requirement: "Illuminated god books (Abbey of St. Elspeth Citharede)",
    source: "family:desert-illuminated-godbooks",
    test: (r) => /^illuminated book of (law|war|chaos|wisdom|balance)$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Underworld Grimoire",
    source: "family:misthalin-underworld-grimoire",
    test: (r) => /^underworld grimoire/i.test(r.name),
  },
  {
    // Wiki: Airut (Desert+Kandarin badges) + Beastmaster Durzag (Desert / Mazcab). Not QBD/Asgarnia.
    regions: ["desert"],
    requirement: "Razorback gauntlets (Airut / Beastmaster Durzag)",
    source: "family:desert-razorback",
    test: (r) => /^razorback gauntlets$/i.test(r.name),
  },
  {
    // Celestial dragons on Dragontooth Island = Morytania (not Dominion Tower).
    regions: ["morytania"],
    requirement: "Celestial handwraps (celestial dragons / Dragontooth)",
    source: "family:morytania-celestial-handwraps",
    test: (r) => /^celestial handwraps$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Max cape",
    source: "family:misthalin-max-cape",
    test: (r) => /^max cape$/i.test(r.name),
  },
  {
    regions: ["havenhythe"],
    requirement: "Apex hide armour (Havenhythe BGH / craft)",
    source: "family:havenhythe-apex-hide",
    test: (r) => /^apex hide (cowl|body|chaps|vambraces|boots)$/i.test(r.name),
  },
  {
    // User MW ruling 2026-07-26: anachronia + forinthry + kandarin (not Asgarnia plate anvil).
    // pass9: custom-fit masterwork ranged * shares material chain.
    regions: ["anachronia", "forinthry", "kandarin"],
    requirement: "Masterwork ranged armour",
    source: "family:mw-ranged-armour",
    test: (r) =>
      /^(custom-fit )?masterwork ranged (cowl|body|chaps|vambraces|boots)$/i.test(r.name),
  },
  {
    // Same multi-region material chain as Masterwork staff (user MW answers).
    // pass9: custom-fit masterwork magic * shares material chain.
    regions: ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"],
    requirement: "Masterwork magic armour",
    source: "family:mw-magic-armour",
    test: (r) =>
      /^(custom-fit )?masterwork magic (hat|robe top|robe bottom|gloves|boots)$/i.test(r.name),
  },
  {
    // One of a Kind / Varrock Museum — Misthalin (pass7 wiki; not Forinthry/KBD).
    regions: ["misthalin"],
    requirement: "Dragon Rider amulet (One of a Kind / Museum)",
    source: "family:misthalin-dragon-rider-amulet",
    test: (r) => /^dragon rider amulet$/i.test(r.name),
  },

  // Arc / Ports armour + weapons + hybrid accessories (NOT scrimshaws).
  // Covers Seasinger's / Superior seasinger's apostrophe names, Waiko mitts/waders,
  // elite Death Lotus darts, reefwalker cape, leviathan ring.
  {
    regions: ["asgarnia"],
    requirement: "Player-Owned Port combat residual (Arc = Asgarnia)",
    source: "family:asgarnia-ports",
    test: (r) =>
      /^(elite |superior )?(seasinger'?s?|death lotus|tetsu) /i.test(r.name) ||
      /^(elite )?(seasinger|tetsu) (kiba|makigai|katana|wakizashi)/i.test(r.name) ||
      /^(off-hand )?(elite )?death lotus dart$/i.test(r.name) ||
      /^mizuyari$/i.test(r.name) ||
      /^winds of waiko$/i.test(r.name) ||
      /^(superior )?reefwalker'?s cape$/i.test(r.name) ||
      /^(superior )?leviathan ring$/i.test(r.name),
  },

  // User 2026-07-26: base Spear of Annihilation → Kandarin (overrides prior Misthalin stamp).
  {
    regions: ["kandarin"],
    requirement: "Spear of Annihilation base",
    source: "family:spear-annihilation-base",
    test: (r) => /^spear of annihilation$/i.test(r.name),
  },

  // ─── densify pass: remaining BiS / clear gaps ─────────────────────────────
  // deathguard/skull-lantern: covered by family:misthalin-death-guard above (pass2 necro densify).
  // jaws-of-the-abyss: dual misthalin+forinthry via family:misthalin-forinthry-jaws-abyss (pass5).
  {
    regions: ["misthalin"],
    requirement: "Elder God Wars arrows / deathspore",
    source: "family:misthalin-egw-ammo",
    test: (r) =>
      /^(bik|ful|wen|jas dragonbane) arrows$/i.test(r.name) ||
      /^deathspore arrows$/i.test(r.name),
  },
  {
    regions: ["misthalin"],
    requirement: "Deathtouch bracelet (hydrix residual)",
    source: "family:misthalin-deathtouch",
    test: (r) => /^deathtouch bracelet$/i.test(r.name),
  },
  // Vengeful/Merciless kiteshields are RoTS (Morytania) — see family:morytania-rots-kiteshields.
  {
    // Craft: dark bow (dark beasts Tirannwn) + wyrm scalp (Wildywyrm Forinthry). Not QBD.
    regions: ["forinthry", "tirannwn"],
    requirement: "Strykebow (wyrm scalp + dark bow)",
    source: "family:strykebow-wyrm-darkbow",
    test: (r) => /^strykebow$/i.test(r.name),
  },
  {
    // Craft: staff of light (ice strykewyrms Fremennik) + wyrm heart (Wildywyrm Forinthry).
    // Not desert GWD2 / desert strykewyrms (those drop focus sight).
    regions: ["fremennik", "forinthry"],
    requirement: "Staff of darkness (staff of light + wyrm heart)",
    source: "family:staff-of-darkness-wyrm",
    test: (r) => /^staff of darkness$/i.test(r.name),
  },
  {
    // Ice strykewyrm unique — Fremennik ice cave primary (wiki Equilibrium badge).
    regions: ["fremennik"],
    requirement: "Staff of light (ice strykewyrms)",
    source: "family:fremennik-staff-of-light",
    test: (r) => /^staff of light$/i.test(r.name),
  },
  {
    regions: ["anachronia"],
    requirement: "Upgraded bone blowpipe",
    source: "family:anachronia-bone-blowpipe",
    test: (r) => /^(upgraded )?bone blowpipe$/i.test(r.name),
  },
  {
    regions: ["forinthry"],
    requirement: "Hellfire bow (Wilderness)",
    source: "family:forinthry-hellfire-bow",
    test: (r) => /^hellfire bow$/i.test(r.name),
  },
  {
    // Vault of Hereditas = Desert (wiki leagueRegion + desert:vault-of-hereditas-heist).
    // Pass1 morytania-gloomfire-bow was a false lock. Legatus is family:desert-legatus-emberstaff.
    regions: ["desert"],
    requirement: "Vault of Hereditas (Gloomfire bow)",
    source: "family:desert-gloomfire-bow",
    test: (r) => /^gloomfire bow$/i.test(r.name),
  },
  {
    // Second-Age weapons are master-casket / Global (not DG). Do not stamp them here.
    // Chaotic kiteshield is covered by family:forinthry-chaotic (name prefix).
    regions: ["forinthry"],
    requirement: "Daemonheim / Dungeoneering residual weapons",
    source: "family:forinthry-dg-weapons",
    test: (r) =>
      /primal /i.test(r.name) ||
      /eternal magic/i.test(r.name) ||
      /eagle-eye kiteshield/i.test(r.name) ||
      /farseer kiteshield/i.test(r.name),
  },
  {
    // Dominion Tower (Al Kharid) = Desert. Main-game usable gloves only.
    // Tower-only dominion sword/staff/crossbow are REMOVE_IDS, not stamped.
    // Celestial handwraps are celestial dragons (Morytania) — never DT.
    regions: ["desert"],
    requirement: "Dominion Tower wearable rewards (main-game usable gloves)",
    source: "family:desert-dominion-gloves",
    test: (r) =>
      /goliath gloves/i.test(r.name) ||
      /spellcaster gloves/i.test(r.name) ||
      /pneumatic gloves/i.test(r.name) ||
      /static gloves/i.test(r.name) ||
      /tracking gloves/i.test(r.name) ||
      /swift gloves/i.test(r.name),
  },
  {
    regions: ["morytania"],
    requirement: "Blood necklaces (Barrows residual)",
    source: "family:morytania-blood-necklaces",
    test: (r) =>
      /^(arcane blood necklace|brawler'?s knockout necklace|farsight sniper necklace)$/i.test(r.name),
  },
  {
    regions: ["fremennik"],
    requirement: "Glacyte boots (glacor residual)",
    source: "family:fremennik-glacyte",
    test: (r) => /^(glacyte boots|glacier boots)$/i.test(r.name),
  },
  {
    regions: ["kandarin"],
    requirement: "Ascendri bolts (e) (ascension residual)",
    source: "family:kandarin-ascendri",
    test: (r) => /^ascendri bolts/i.test(r.name),
  },
  {
    // Vault of Hereditas (Kharid-et = Desert) — sibling of gloomfire / Misalionar death mask.
    // Pass1–8 family:misthalin-legatus-emberstaff was a false home (Senntisten name pollution).
    regions: ["desert"],
    requirement: "Legatus's Emberstaff (Vault of Hereditas)",
    source: "family:desert-legatus-emberstaff",
    test: (r) => /legatus'?s? emberstaff/i.test(r.name),
  },

  // ─── mid-tier densify (remaining empties with clear geography) ─────────────
  {
    regions: ["asgarnia"],
    requirement: "Warriors' Guild dragon defender",
    source: "family:asgarnia-dragon-defender",
    test: (r) => /^dragon defender$/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "Void Knight / Pest Control residual weapons",
    source: "family:asgarnia-void-swords",
    test: (r) => /^(korasi'?s? sword|jessika'?s? sword)$/i.test(r.name),
  },
  {
    regions: ["asgarnia"],
    requirement: "The Death of Chivalry (Vanquish)",
    source: "family:asgarnia-vanquish",
    test: (r) => /^vanquish/i.test(r.name),
  },
  {
    // Wiki league badge: Fremennik (Chaos Dwarf Battlefield / Red Axe) — not Daemonheim.
    regions: ["fremennik"],
    requirement: "Hand cannon (Chaos Dwarf Battlefield)",
    source: "family:fremennik-hand-cannon",
    test: (r) => /^hand cannon$/i.test(r.name),
  },
  {
    // Match abyssal whip primary (Slayer Tower). Multi-source demons exist but forinthry-only was false.
    regions: ["morytania"],
    requirement: "Abyssal wand / orb (abyssal demons — Slayer Tower primary)",
    source: "family:morytania-abyssal-wand-orb",
    test: (r) => /^(abyssal wand|abyssal orb)$/i.test(r.name),
  },
  {
    // Senntisten Asylum (Misthalin) + Wilderness abyssal beasts per wiki league dual badges.
    regions: ["misthalin", "forinthry"],
    requirement: "Jaws of the Abyss (abyssal beasts)",
    source: "family:misthalin-forinthry-jaws-abyss",
    test: (r) => /^jaws of the abyss$/i.test(r.name),
  },
  {
    regions: ["tirannwn"],
    requirement: "Dark bow (dark beasts / Tirannwn)",
    source: "family:tirannwn-dark-bow",
    test: (r) => /^dark bow$/i.test(r.name),
  },
  {
    regions: ["desert"],
    requirement: "Enhanced ancient staff (Ancient Magicks / desert residual)",
    source: "family:desert-enhanced-ancient-staff",
    test: (r) => /^enhanced ancient staff$/i.test(r.name),
  },
  {
    // Wilderness Warbands residual (removed 2026) — never Dominion Tower (pass6).
    regions: ["forinthry"],
    requirement: "Wand of treachery (Wilderness Warbands residual)",
    source: "family:forinthry-wand-of-treachery",
    test: (r) => /^wand of treachery$/i.test(r.name),
  },
  {
    // Slayer Tower abyssal demons — classic mid-game whip farm (multi-source but Mory primary).
    regions: ["morytania"],
    requirement: "Abyssal whip (Slayer Tower / abyssal demons)",
    source: "family:morytania-abyssal-whip",
    test: (r) => /^abyssal whip$/i.test(r.name),
  },
  {
    regions: ["morytania"],
    requirement: "Full slayer helmet (black mask path)",
    source: "family:morytania-slayer-helm",
    test: (r) => /^(full )?slayer helmet/i.test(r.name) || /^slayer-helmet/i.test(r.id),
  },
  {
    regions: ["karamja"],
    requirement: "Fire cape (TzHaar Fight Cave)",
    source: "family:karamja-fire-cape",
    test: (r) => /^fire cape$/i.test(r.name),
  },
  {
    // Fight Cauldron shards → smithable t60 hybrid set; kiln / Zuk support damage reduction.
    regions: ["karamja"],
    requirement: "Fight Cauldron obsidian armour progression",
    source: "family:karamja-obsidian-armour",
    test: (r) =>
      /^obsidian (warrior|ranger|mage) helm$/i.test(r.name) ||
      /^obsidian (platebody|platelegs|plateskirt|gloves|boots|kiteshield)$/i.test(r.name),
  },
  {
    // Durable guard: Shilo gemstone cavern is hard Karamja (not Anachronia).
    regions: ["karamja"],
    requirement: "Gemstone armour (Shilo gemstone cavern / gemstone dragons)",
    source: "family:karamja-gemstone-armour",
    test: (r) => /^gemstone (helm|hauberk|greaves|gauntlets|boots)$/i.test(r.name),
  },
  {
    regions: ["karamja"],
    requirement: "Abomination cape (Hero's Welcome residual)",
    source: "family:karamja-abomination-cape",
    test: (r) => /^abomination cape$/i.test(r.name),
  },
  {
    // Classic Toktz / TzHaar-Ket weapons — GE/shop residual, hard TzHaar City geography.
    regions: ["karamja"],
    requirement: "TzHaar City obsidian weapons",
    source: "family:karamja-obsidian-weapons",
    test: (r) =>
      /^(tzhaar-ket-om|tzhaar-ket-em|toktz-xil-ak|toktz-xil-ek|toktz-mej-tal|toktz-xil-ul)$/i.test(r.name) ||
      /^(tzhaar-ket-om|tzhaar-ket-em|toktz-xil-ak|toktz-xil-ek|toktz-mej-tal|toktz-xil-ul)$/i.test(
        stripItemPrefix(r.id),
      ),
  },
  {
    regions: ["karamja"],
    requirement: "TokKul-Zo (The Elder Kiln)",
    source: "family:karamja-tokkul-zo",
    test: (r) => /^tokkul-zo$/i.test(r.name) || /^tokkul-zo$/i.test(stripItemPrefix(r.id)),
  },
  {
    regions: ["fremennik"],
    requirement: "Dagannoth Kings rings",
    source: "family:fremennik-dk-rings",
    // Pass3: Archers'/Seers' use trailing apostrophe ("Archers' ring") — old ('?s)? missed them.
    test: (r) =>
      /^(berserker|warrior|seers'?|archers'?) ring$/i.test(r.name) ||
      /^(berserker|warrior|seers|archers)-ring$/i.test(r.id),
  },
  {
    regions: ["asgarnia"],
    requirement: "Dragonfire shield / deflector residual",
    source: "family:asgarnia-dragonfire",
    test: (r) => /^dragonfire (shield|deflector|ward)$/i.test(r.name),
  },

  // ─── pass3 empty resolution ────────────────────────────────────────────────
  {
    // Boneyard Hunter net traps only — hard Forinthry (corpus hunter:black-salamanders).
    regions: ["forinthry"],
    requirement: "Black salamander (Wilderness Boneyard Hunter)",
    source: "family:forinthry-black-salamander",
    test: (r) => /^black salamander$/i.test(r.name),
  },
];

/** Force-replace regions (not union) — user overrides that must win over stale stamps.
 *  Empty array = clear region tags (intentionally unverified / not region-gated).
 *  See scraped-data/agent-intentionally-unverified-pass2.json. */
const USER_FORCE = new Map([
  // pass7: Warforge (Kandarin) + chaotic spikes (Forinthry/DG) — user MW ruling 2026-07-26.
  ["spear-of-annihilation", ["kandarin", "forinthry"]],
  ["reaper-necklace", ["misthalin"]],
  ["amulet-of-souls", ["misthalin"]],
  ["ring-of-death", ["misthalin"]],
  ["luck-of-the-dwarves", ["misthalin"]],
  ["max-cape", ["misthalin"]],
  // Airut / Beastmaster Durzag (Desert) — not QBD/Asgarnia (false family:asgarnia-razorback).
  ["razorback-gauntlets", ["desert"]],
  // pass7: abyssal whip (Morytania) + wyrm spike (Wildywyrm Forinthry) — forinthry-only understates whip.
  ["lava-whip", ["morytania", "forinthry"]],
  // pass7: One of a Kind quest reward + Mordaut reclaim (Varrock Museum) = Misthalin — not Forinthry.
  ["dragon-rider-amulet", ["misthalin"]],
  ["apex-hide-cowl", ["havenhythe"]],
  ["apex-hide-body", ["havenhythe"]],
  ["apex-hide-chaps", ["havenhythe"]],
  ["apex-hide-vambraces", ["havenhythe"]],
  ["apex-hide-boots", ["havenhythe"]],
  ["masterwork-ranged-cowl", ["anachronia", "forinthry", "kandarin"]],
  ["masterwork-ranged-body", ["anachronia", "forinthry", "kandarin"]],
  ["masterwork-ranged-chaps", ["anachronia", "forinthry", "kandarin"]],
  ["masterwork-ranged-vambraces", ["anachronia", "forinthry", "kandarin"]],
  ["masterwork-ranged-boots", ["anachronia", "forinthry", "kandarin"]],
  ["masterwork-magic-hat", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["masterwork-magic-robe-top", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["masterwork-magic-robe-bottom", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["masterwork-magic-gloves", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["masterwork-magic-boots", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  // pass9 custom-fit MW — same hard multi-region chains as base/trimmed parents.
  ["custom-fit-trimmed-masterwork-melee-helm", ["asgarnia", "morytania"]],
  ["custom-fit-trimmed-masterwork-melee-platebody", ["asgarnia", "morytania"]],
  ["custom-fit-trimmed-masterwork-melee-platelegs", ["asgarnia", "morytania"]],
  ["custom-fit-trimmed-masterwork-melee-gloves", ["asgarnia", "morytania"]],
  ["custom-fit-trimmed-masterwork-melee-boots", ["asgarnia", "morytania"]],
  ["custom-fit-masterwork-magic-hat", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-magic-robe-top", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-magic-robe-bottom", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-magic-gloves", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-magic-boots", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-ranged-cowl", ["anachronia", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-ranged-body", ["anachronia", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-ranged-chaps", ["anachronia", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-ranged-vambraces", ["anachronia", "forinthry", "kandarin"]],
  ["custom-fit-masterwork-ranged-boots", ["anachronia", "forinthry", "kandarin"]],
  // Vault of Hereditas (Kharid-et digsite = Desert); Visage = crown (Misthalin) + death mask (Desert).
  ["misalionars-death-mask", ["desert"]],
  ["visage-of-the-first-necromancer", ["misthalin", "desert"]],
  // Illuminated at Abbey of St. Elspeth Citharede (east Al Kharid) = Desert.
  ["illuminated-book-of-law", ["desert"]],
  ["illuminated-book-of-war", ["desert"]],
  ["illuminated-book-of-chaos", ["desert"]],
  ["illuminated-book-of-wisdom", ["desert"]],
  ["illuminated-book-of-balance", ["desert"]],
  ["underworld-grimoire-4", ["misthalin"]],
  ["deathtouch-bracelet", ["misthalin"]],
  // Abyssal beasts: Senntisten Asylum + Wilderness wiki dual.
  ["jaws-of-the-abyss", ["misthalin", "forinthry"]],
  // City of Um necro DW residual — t90 only (pass6; base/t80 stripped from catalog)
  ["deathguard-t90", ["misthalin"]],
  ["skull-lantern-t90", ["misthalin"]],
  // ─── pass6 Misthalin densify reaffirm (force-replace; EGW / Um / Sanctum / Zuk) ──
  ["fractured-staff-of-armadyl", ["misthalin"]],
  ["dark-shard-of-leng", ["misthalin"]],
  ["dark-sliver-of-leng", ["misthalin"]],
  ["dark-ice-shard", ["misthalin"]],
  ["dark-ice-sliver", ["misthalin"]],
  ["ek-zekkil", ["misthalin"]],
  ["bow-of-the-last-guardian", ["misthalin"]],
  ["roar-of-awakening", ["misthalin"]],
  ["ode-to-deceit", ["misthalin"]],
  ["omni-guard", ["misthalin"]],
  ["soulbound-lantern", ["misthalin"]],
  ["first-necromancer-helm", ["misthalin"]],
  ["first-necromancer-body", ["misthalin"]],
  ["first-necromancer-legs", ["misthalin"]],
  ["first-necromancer-gloves", ["misthalin"]],
  ["first-necromancer-boots", ["misthalin"]],
  ["cryptbloom-helm", ["misthalin"]],
  ["cryptbloom-body", ["misthalin"]],
  ["cryptbloom-legs", ["misthalin"]],
  ["cryptbloom-gloves", ["misthalin"]],
  ["cryptbloom-boots", ["misthalin"]],
  ["deathdealer-hood-t90", ["misthalin"]],
  ["deathdealer-robe-top-t90", ["misthalin"]],
  ["deathdealer-robe-bottom-t90", ["misthalin"]],
  ["deathdealer-gloves-t90", ["misthalin"]],
  ["deathdealer-boots-t90", ["misthalin"]],
  ["deathwarden-hood-t90", ["misthalin"]],
  ["deathwarden-robe-top-t90", ["misthalin"]],
  ["deathwarden-robe-bottom-t90", ["misthalin"]],
  ["deathwarden-gloves-t90", ["misthalin"]],
  ["deathwarden-boots-t90", ["misthalin"]],
  // Dracolich: NOT here — pass6 forinthry USER_FORCE (Fort Forinthry / Vorkath) owns the set.
  ["vestments-of-havoc-hood", ["misthalin"]],
  ["vestments-of-havoc-robe-top", ["misthalin"]],
  ["vestments-of-havoc-robe-bottom", ["misthalin"]],
  ["vestments-of-havoc-boots", ["misthalin"]],
  ["abyssal-scourge", ["misthalin"]],
  ["kerapacs-wrist-wraps", ["misthalin"]],
  ["enhanced-kerapacs-wrist-wraps", ["misthalin"]],
  // enhanced-nightmare-gauntlets: dual kandarin+misthalin later (base World Gate + Leng).
  // pass9: Legatus's Emberstaff = Vault of Hereditas (Desert), not Misthalin.
  ["legatuss-emberstaff", ["desert"]],
  // Dominion Tower gloves — hard Desert (pass2 densify black recolours + swift).
  ["goliath-gloves", ["desert"]],
  ["goliath-gloves-black", ["desert"]],
  ["spellcaster-gloves", ["desert"]],
  ["spellcaster-gloves-black", ["desert"]],
  ["swift-gloves", ["desert"]],
  ["swift-gloves-black", ["desert"]],
  ["pneumatic-gloves", ["desert"]],
  ["static-gloves", ["desert"]],
  ["tracking-gloves", ["desert"]],
  // celestial-handwraps: NOT Dominion Tower — pass5 reclaims Morytania (see below).
  // Kalphite King residual defenders (not dual-home with morytania barrows package).
  ["kalphite-defender", ["desert"]],
  ["kalphite-repriser", ["desert"]],
  ["kalphite-rebounder", ["desert"]],
  // pass6 BiS inject force stamps
  ["occultists-ring", ["anachronia"]],
  ["ring-of-vigour", ["forinthry"]],
  ["guthix-staff", ["forinthry"]],
  ["spirit-cape", ["forinthry"]],
  ["chaotic-kiteshield", ["forinthry"]],
  ["farseer-kiteshield", ["forinthry"]],
  // pass9: ancient-rebounder removed (wiki redirect → ancient-lantern; invent-global empty)
  ["stalker-arrows", ["forinthry"]],
  // phantom wiki id — strip if re-scraped
  // hexhunter-arrows removed; stalker-arrows is the real ammo
  ["dragon-claws", ["misthalin"]],
  // pass8: OH sibling of dragon claws (Tormented demons / Misthalin — wiki Off-hand_dragon_claw).
  ["off-hand-dragon-claw", ["misthalin"]],
  // pass7: eternal magic trees = Piscatoris (Kandarin) — not DG/Forinthry residual.
  ["eternal-magic-staff-saturated", ["kandarin"]],
  ["eternal-magic-staff-meagre", ["kandarin"]],

  // ─── pass2 morytania corrections (force-replace wins over stale unions) ────
  // RoTS style shields — never Vorago/Asgarnia.
  ["merciless-kiteshield", ["morytania"]],
  ["vengeful-kiteshield", ["morytania"]],
  // t70 Barrows defenders — never Daemonheim/Forinthry.
  ["corrupted-defender", ["morytania"]],
  ["tainted-repriser", ["morytania"]],
  // Gloomfire from Vault of Hereditas — Desert, not Morytania.
  ["gloomfire-bow", ["desert"]],
  // ─── pass3 wrong-region audit (force-replace wins over stale multi-unions) ──
  // shard-of-genesis-essence removed pass4 (slotless progression junk — see REMOVE_IDS).
  // cross-region:masterwork-bow = kandarin+morytania; pass1 asgarnia partial polluted union.
  ["masterwork-bow", ["kandarin", "morytania"]],
  // pass7: seismic Asgarnia + Cywir Desert + crystal Tirannwn + Abyss synapse Forinthry + Ourania Kandarin (user MW ruling).
  ["masterwork-staff", ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"]],
  // Mid-tier densify force (wins over empty).
  ["dragon-defender", ["asgarnia"]],
  ["korasis-sword", ["asgarnia"]],
  ["jessikas-sword", ["asgarnia"]],
  ["vanquish-melee", ["asgarnia"]],
  // Chaos Dwarf Battlefield = Fremennik (wiki league badge) — not Daemonheim/Forinthry.
  ["hand-cannon", ["fremennik"]],
  ["dark-bow", ["tirannwn"]],
  ["enhanced-ancient-staff", ["desert"]],
  // Wilderness Warbands residual — not Dominion Tower desert (pass6 reclaim below).
  ["wand-of-treachery", ["forinthry"]],
  ["abyssal-whip", ["morytania"]],
  // Match whip primary (Slayer Tower); strip false forinthry:abyssal-wand-orb.
  ["abyssal-wand", ["morytania"]],
  ["abyssal-orb", ["morytania"]],
  // Whip + whip vine (Jadinko Lair Karamja) — strip false forinthry-lava-wyrm bundle.
  ["abyssal-vine-whip", ["morytania", "karamja"]],
  ["slayer-helmet-i", ["morytania"]],
  ["fire-cape", ["karamja"]],
  ["tokkul-zo", ["karamja"]],
  ["abomination-cape", ["karamja"]],
  ["obsidian-warrior-helm", ["karamja"]],
  ["obsidian-ranger-helm", ["karamja"]],
  ["obsidian-mage-helm", ["karamja"]],
  ["obsidian-platebody", ["karamja"]],
  ["obsidian-platelegs", ["karamja"]],
  ["obsidian-gloves", ["karamja"]],
  ["obsidian-boots", ["karamja"]],
  ["obsidian-kiteshield", ["karamja"]],
  // Hard audit 2026-07-26: wiki Gemstone cavern = Karamja (not Anachronia pass4 false lock).
  ["gemstone-helm", ["karamja"]],
  ["gemstone-hauberk", ["karamja"]],
  ["gemstone-greaves", ["karamja"]],
  ["gemstone-gauntlets", ["karamja"]],
  ["gemstone-boots", ["karamja"]],
  // Ice strykewyrms Fremennik — strip false asgarnia GWD1 bundle.
  ["staff-of-light", ["fremennik"]],
  // SoL + wyrm heart (Wildywyrm) — strip false desert GWD2 stamp.
  ["staff-of-darkness", ["fremennik", "forinthry"]],
  // Dark bow + wyrm scalp — strip false asgarnia QBD stamp.
  ["strykebow", ["forinthry", "tirannwn"]],
  // ─── pass5 hard audit 2026-07-26 ───────────────────────────────────────────
  // Celestial dragons / Dragontooth Island = Morytania (not Dominion Tower desert).
  ["celestial-handwraps", ["morytania"]],
  // Master reward caskets = Global — not region-hard (strip false forinthry DG residual).
  ["second-age-sword", []],
  ["second-age-staff", []],
  ["second-age-bow", []],
  // ─── pass6 Forinthry densify 2026-07-26 ────────────────────────────────────
  // DG style kiteshields + blessed spirit intermediate (catalog-injected above).
  ["chaotic-kiteshield", ["forinthry"]],
  ["farseer-kiteshield", ["forinthry"]],
  ["eagle-eye-kiteshield", ["forinthry"]],
  ["blessed-spirit-shield", ["forinthry"]],
  // Reaffirm user-verify targets (chaotics / eldritch / hex / T87 / ruinous / spirit / lava / hellfire / DRA).
  ["hexhunter-bow", ["forinthry"]],
  ["eldritch-crossbow", ["forinthry"]],
  ["hellfire-bow", ["forinthry"]],
  ["annihilation", ["forinthry"]],
  ["decimation", ["forinthry"]],
  ["obliteration", ["forinthry"]],
  ["divine-spirit-shield", ["forinthry"]],
  ["arcane-spirit-shield", ["forinthry"]],
  ["elysian-spirit-shield", ["forinthry"]],
  ["spectral-spirit-shield", ["forinthry"]],
  // Mercenary gloves only from former dg-token-residual trio (defenders stay morytania).
  ["mercenarys-gloves", ["forinthry"]],
  // Primal = DG residual (Forinthry). Eternal magic = Piscatoris trees (Kandarin) — pass7 reclaim.
  ["primal-crossbow-mk-5", ["forinthry"]],
  ["off-hand-primal-crossbow-mk-5", ["forinthry"]],
  ["eternal-magic-longbow", ["kandarin"]],
  ["eternal-magic-shortbow-mk-5", ["kandarin"]],
  ["eternal-magic-wand-meagre", ["kandarin"]],
  ["eternal-magic-wand-saturated", ["kandarin"]],
  ["eternal-magic-orb-meagre", ["kandarin"]],
  ["eternal-magic-orb-saturated", ["kandarin"]],
  ["tzhaar-ket-om", ["karamja"]],
  ["tzhaar-ket-em", ["karamja"]],
  ["toktz-xil-ak", ["karamja"]],
  ["toktz-mej-tal", ["karamja"]],
  ["toktz-xil-ul", ["karamja"]],
  ["berserker-ring", ["fremennik"]],
  ["warrior-ring", ["fremennik"]],
  ["archers-ring", ["fremennik"]],
  ["seers-ring", ["fremennik"]],
  ["dragonfire-shield", ["asgarnia"]],
  ["dragonfire-deflector", ["asgarnia"]],

  // ─── pass6 wrong-region hard audit 2026-07-26 ─────────────────────────────
  // Fort Forinthry / Zemouregal & Vorkath — strip false family:misthalin-dracolich.
  ["dracolich-helm", ["forinthry"]],
  ["dracolich-body", ["forinthry"]],
  ["dracolich-legs", ["forinthry"]],
  ["dracolich-gloves", ["forinthry"]],
  ["dracolich-boots", ["forinthry"]],
  ["elite-dracolich-helm", ["forinthry"]],
  ["elite-dracolich-body", ["forinthry"]],
  ["elite-dracolich-legs", ["forinthry"]],
  ["elite-dracolich-gloves", ["forinthry"]],
  ["elite-dracolich-boots", ["forinthry"]],
  // Abyssal lords wiki dual Misthalin + Wilderness (match jaws-of-the-abyss).
  ["abyssal-scourge", ["misthalin", "forinthry"]],
  // Ripper Demon cave wiki dual Desert + Wilderness.
  ["ripper-claw", ["desert", "forinthry"]],
  ["off-hand-ripper-claw", ["desert", "forinthry"]],
  // Nightmare (Kandarin World Gate ruling) + Leng artefact (EGWD Misthalin).
  ["enhanced-nightmare-gauntlets", ["kandarin", "misthalin"]],
  // Chaotic + drygore + Twin Furies — strip false Asgarnia Artisans residual.
  ["masterwork-2h-sword", ["desert", "forinthry"]],

  // ─── pass3 hard densify (still-empty non-intentional) ──────────────────────
  // Black salamander: Boneyard Hunter (Wilderness) → Forinthry.
  // Not multi-hunter intentional empty — black colour is site-specific.
  // See scraped-data/agent-slayer-midgear-pass3.json.
  ["black-salamander", ["forinthry"]],

  // ─── pass3 accessories densify (pockets / capes / hybrid necks+rings) ─────
  // Scriptures + grimoires + god books — durable force (corpus family already stamps).
  ["scripture-of-jas", ["misthalin"]],
  ["scripture-of-wen", ["misthalin"]],
  ["scripture-of-ful", ["misthalin"]],
  ["scripture-of-bik", ["misthalin"]],
  ["scripture-of-amascut", ["misthalin"]],
  ["scripture-of-elidinis", ["misthalin"]],
  ["erethdors-grimoire", ["tirannwn"]],
  ["holy-wrench", ["morytania"]],
  // EoF Asgarnia (user ruling + asgarnia:essence-of-finality-amulet).
  ["essence-of-finality", ["asgarnia"]],
  // Capes: max/fire already forced; TokHaar / Igneous durable force.
  ["tokhaar-kal-ket", ["karamja"]],
  ["tokhaar-kal-xil", ["karamja"]],
  ["tokhaar-kal-mej", ["karamja"]],
  ["tokhaar-kal-mor", ["karamja"]],
  ["igneous-kal-ket", ["karamja", "misthalin"]],
  ["igneous-kal-xil", ["karamja", "misthalin"]],
  ["igneous-kal-mej", ["karamja", "misthalin"]],
  ["igneous-kal-mor", ["karamja", "misthalin"]],
  ["igneous-kal-zuk", ["karamja", "misthalin"]],
  // Hybrid rings / amulets reaffirm (no empty wearables remain beyond intentional).
  ["asylum-surgeons-ring", ["misthalin"]],
  ["reavers-ring", ["anachronia", "fremennik"]],
  ["channelers-ring", ["anachronia", "fremennik"]],
  ["stalkers-ring", ["anachronia", "fremennik"]],
  ["champions-ring", ["anachronia", "fremennik"]],
  ["salve-amulet-e", ["morytania"]],
  ["amulet-of-the-forsaken", ["morytania"]],
  // amulet-of-the-forsaken-to-berserkers-fury removed pass7 (progression-path aggregate — see REMOVE_IDS)
  ["arcane-blood-necklace", ["morytania"]],
  ["brawlers-knockout-necklace", ["morytania"]],
  ["farsight-sniper-necklace", ["morytania"]],
  ["demon-horn-necklace", ["forinthry"]],
  ["split-dragontooth-necklace", ["forinthry"]],

  // ─── pass6 morytania densify reaffirm (force-replace; wins over forinthry/asgarnia pollution) ──
  // Araxxor / Araxxi noxious triad.
  ["noxious-scythe", ["morytania"]],
  ["noxious-longbow", ["morytania"]],
  ["noxious-staff", ["morytania"]],
  // RoTS malevolent wearable set (energy/armour aggregates are REMOVE_IDS).
  ["malevolent-helm", ["morytania"]],
  ["malevolent-body", ["morytania"]],
  ["malevolent-legs", ["morytania"]],
  ["malevolent-kiteshield", ["morytania"]],
  // Polypore Dungeon (east of Canifis).
  ["ganodermic-visor", ["morytania"]],
  ["ganodermic-poncho", ["morytania"]],
  ["ganodermic-leggings", ["morytania"]],
  ["polypore-staff", ["morytania"]],
  // Blisterwood / Sunspear vyre ladder.
  ["blisterwood-wand", ["morytania"]],
  ["blisterwood-orb", ["morytania"]],
  ["blisterwood-staff", ["morytania"]],
  ["blisterwood-stake-thrower-crossbow", ["morytania"]],
  ["sunspear", ["morytania"]],
  ["sunspear-melee", ["morytania"]],
  ["sunspear-magic", ["morytania"]],
  ["sunspear-ranged", ["morytania"]],
  // Classic Barrows brothers + residual weapons.
  ["ahrims-staff", ["morytania"]],
  ["ahrims-wand", ["morytania"]],
  ["ahrims-book-of-magic", ["morytania"]],
  ["dharoks-greataxe", ["morytania"]],
  ["guthans-warspear", ["morytania"]],
  ["karils-crossbow", ["morytania"]],
  ["karils-pistol-crossbow", ["morytania"]],
  ["karils-off-hand-pistol-crossbow", ["morytania"]],
  ["torags-hammer", ["morytania"]],
  ["veracs-flail", ["morytania"]],
  ["akrisaes-war-mace", ["morytania"]],
  ["linzas-hammer", ["morytania"]],
  // t80 Barrows defender line (corpus single-home; multi-mat Nex/DG noted only).
  ["ancient-defender", ["morytania"]],
  ["ancient-repriser", ["morytania"]],

  // ─── pass6 asgarnia densify reaffirm (force-replace; durable vs stale multi-unions) ──
  // GWD1 armour + unique weapons + style amulets + godswords.
  ["bandos-helmet", ["asgarnia"]],
  ["bandos-chestplate", ["asgarnia"]],
  ["bandos-tassets", ["asgarnia"]],
  ["bandos-gloves", ["asgarnia"]],
  ["bandos-boots", ["asgarnia"]],
  ["bandos-warshield", ["asgarnia"]],
  ["bandos-godsword", ["asgarnia"]],
  ["armadyl-helmet", ["asgarnia"]],
  ["armadyl-chestplate", ["asgarnia"]],
  ["armadyl-chainskirt", ["asgarnia"]],
  ["armadyl-gloves", ["asgarnia"]],
  ["armadyl-boots", ["asgarnia"]],
  ["armadyl-buckler", ["asgarnia"]],
  ["armadyl-crossbow", ["asgarnia"]],
  ["off-hand-armadyl-crossbow", ["asgarnia"]],
  ["armadyl-battlestaff", ["asgarnia"]],
  ["armadyl-godsword", ["asgarnia"]],
  ["hood-of-subjugation", ["asgarnia"]],
  ["garb-of-subjugation", ["asgarnia"]],
  ["gown-of-subjugation", ["asgarnia"]],
  ["gloves-of-subjugation", ["asgarnia"]],
  ["boots-of-subjugation", ["asgarnia"]],
  ["ward-of-subjugation", ["asgarnia"]],
  ["saradomin-godsword", ["asgarnia"]],
  ["zamorak-godsword", ["asgarnia"]],
  ["saradomin-sword", ["asgarnia"]],
  ["zamorakian-spear", ["asgarnia"]],
  ["saradomins-murmur", ["asgarnia"]],
  ["saradomins-hiss", ["asgarnia"]],
  ["saradomins-whisper", ["asgarnia"]],
  // Nex T80 + AoD + zaryte.
  ["torva-full-helm", ["asgarnia"]],
  ["torva-platebody", ["asgarnia"]],
  ["torva-platelegs", ["asgarnia"]],
  ["torva-gloves", ["asgarnia"]],
  ["torva-boots", ["asgarnia"]],
  ["pernix-cowl", ["asgarnia"]],
  ["pernix-body", ["asgarnia"]],
  ["pernix-chaps", ["asgarnia"]],
  ["pernix-gloves", ["asgarnia"]],
  ["pernix-boots", ["asgarnia"]],
  ["virtus-mask", ["asgarnia"]],
  ["virtus-robe-top", ["asgarnia"]],
  ["virtus-robe-legs", ["asgarnia"]],
  ["virtus-gloves", ["asgarnia"]],
  ["virtus-boots", ["asgarnia"]],
  ["virtus-wand", ["asgarnia"]],
  ["virtus-book", ["asgarnia"]],
  ["zaryte-bow", ["asgarnia"]],
  ["wand-of-the-praesul", ["asgarnia"]],
  ["imperium-core", ["asgarnia"]],
  // Vorago seismic + base tectonic (elite is dual asgarnia+forinthry below).
  ["seismic-wand", ["asgarnia"]],
  ["seismic-singularity", ["asgarnia"]],
  ["tectonic-helm", ["asgarnia"]],
  ["tectonic-body", ["asgarnia"]],
  ["tectonic-legs", ["asgarnia"]],
  ["elite-tectonic-mask", ["asgarnia", "forinthry"]],
  ["elite-tectonic-robe-top", ["asgarnia", "forinthry"]],
  ["elite-tectonic-robe-bottom", ["asgarnia", "forinthry"]],
  // EoF already forced above; reaffirm for pass6 density report.
  ["essence-of-finality", ["asgarnia"]],
  // QBD path (razorback is desert — never reaffirm here).
  ["royal-crossbow", ["asgarnia"]],
  // pass9: wyvern dual Asgarnian Ice Dungeon + Frozen Waste Plateau (Wilderness/Forinthry).
  ["wyvern-crossbow", ["asgarnia", "forinthry"]],
  // Ports / Arc combat armour+weapons+accessories (NOT scrimshaws).
  ["seasingers-hood", ["asgarnia"]],
  ["seasingers-robe-top", ["asgarnia"]],
  ["seasingers-robe-bottom", ["asgarnia"]],
  ["elite-seasingers-hood", ["asgarnia"]],
  ["elite-seasingers-robe-top", ["asgarnia"]],
  ["elite-seasingers-robe-bottom", ["asgarnia"]],
  ["seasinger-kiba", ["asgarnia"]],
  ["seasinger-makigai", ["asgarnia"]],
  ["elite-seasinger-kiba", ["asgarnia"]],
  ["elite-seasinger-makigai", ["asgarnia"]],
  ["superior-seasinger-aonori", ["asgarnia"]],
  ["superior-seasinger-asari", ["asgarnia"]],
  ["tetsu-helm", ["asgarnia"]],
  ["tetsu-body", ["asgarnia"]],
  ["tetsu-platelegs", ["asgarnia"]],
  ["elite-tetsu-helm", ["asgarnia"]],
  ["elite-tetsu-body", ["asgarnia"]],
  ["elite-tetsu-platelegs", ["asgarnia"]],
  ["tetsu-katana", ["asgarnia"]],
  ["tetsu-wakizashi", ["asgarnia"]],
  ["elite-tetsu-katana", ["asgarnia"]],
  ["elite-tetsu-wakizashi", ["asgarnia"]],
  ["superior-tetsu-kote", ["asgarnia"]],
  ["superior-tetsu-kogake", ["asgarnia"]],
  ["death-lotus-hood", ["asgarnia"]],
  ["death-lotus-chestplate", ["asgarnia"]],
  ["death-lotus-chaps", ["asgarnia"]],
  ["elite-death-lotus-hood", ["asgarnia"]],
  ["elite-death-lotus-chestplate", ["asgarnia"]],
  ["elite-death-lotus-chaps", ["asgarnia"]],
  ["death-lotus-dart", ["asgarnia"]],
  ["off-hand-death-lotus-dart", ["asgarnia"]],
  ["elite-death-lotus-dart", ["asgarnia"]],
  ["off-hand-elite-death-lotus-dart", ["asgarnia"]],
  ["superior-death-lotus-tekoh", ["asgarnia"]],
  ["superior-death-lotus-tabi", ["asgarnia"]],
  ["mizuyari", ["asgarnia"]],
  ["masutas-warspear", ["asgarnia"]],
  ["winds-of-waiko", ["asgarnia"]],
  ["reefwalkers-cape", ["asgarnia"]],
  ["superior-reefwalkers-cape", ["asgarnia"]],
  ["leviathan-ring", ["asgarnia"]],
  ["superior-leviathan-ring", ["asgarnia"]],
  // Elite sirenic (base sirenic stays intentional empty).
  ["elite-sirenic-mask", ["asgarnia"]],
  ["elite-sirenic-hauberk", ["asgarnia"]],
  ["elite-sirenic-chaps", ["asgarnia"]],
  // Masterwork hub (Artisans') + dual chains.
  ["masterwork-helm", ["asgarnia"]],
  ["masterwork-platebody", ["asgarnia"]],
  ["masterwork-platelegs", ["asgarnia"]],
  ["masterwork-gloves", ["asgarnia"]],
  ["masterwork-boots", ["asgarnia"]],
  ["trimmed-masterwork-helm", ["asgarnia", "morytania"]],
  ["trimmed-masterwork-platebody", ["asgarnia", "morytania"]],
  ["trimmed-masterwork-platelegs", ["asgarnia", "morytania"]],
  ["trimmed-masterwork-gloves", ["asgarnia", "morytania"]],
  ["trimmed-masterwork-boots", ["asgarnia", "morytania"]],
  // pass7 MW spear: base SoA (kandarin+forinthry) + trim (malevolent mory + praesulic asg) = 4-region UO.
  // wiki: Masterwork Spear of Annihilation only (no separate trimmed spear wearable).
  ["masterwork-spear-of-annihilation", ["kandarin", "forinthry", "morytania", "asgarnia"]],
  // pass6: strip Asgarnia Artisans pollution — chaotic (forinthry) + drygore/Twin Furies (desert).
  ["masterwork-2h-sword", ["desert", "forinthry"]],
  // Mid-asgarnia residual already forced above (defender / korasi / jessika / vanquish / DFS).

  // ─── intentional empty (USER_FORCE clear) — pass2 + pass3 policy 2026-07-26 ─
  // Invention / POP scrimshaws — craft path, NOT Asgarnia-hard like EoF.
  ["scrimshaw-of-vampyrism", []],
  ["scrimshaw-of-the-elements", []],
  ["scrimshaw-of-cruelty", []],
  ["superior-scrimshaw-of-vampyrism", []],
  ["superior-scrimshaw-of-the-elements", []],
  ["superior-scrimshaw-of-cruelty", []],
  // Historical Loyalty/Solomon combat auras deleted post-Aura Overhaul (not loadout items).
  // Generic skilling bows — not league-hard combat gates.
  ["magic-longbow", []],
  ["magic-shortbow", []],
  ["magic-composite-bow", []],
  ["elder-longbow", []],
  ["elder-shortbow", []],
  // pass3: yew tier skilling bows (same policy as magic/elder).
  ["yew-longbow", []],
  ["yew-shortbow", []],
  ["yew-composite-bow", []],
  // Bakriminel / onyx / hydrix enchanted bolts — invent fletching global.
  ["onyx-bakriminel-bolts-e", []],
  ["hydra-bakriminel-bolts-e", []],

  // limitless-staff removed pass7 (plural family aggregate "Limitless staves" — see REMOVE_IDS).
  // Invention-global offhand — leave empty unless corpus hard required_regions.
  ["ancient-lantern", []],
  // Greater runic staff — Runespan shop (Misthalin-accessible, not region-exclusive).
  ["greater-runic-staff", []],
  // Base sirenic — multi-source scale/thread pressure only; never invent a hard lock.
  // Elite sirenic stays family:elite-sirenic → asgarnia (not cleared here).
  ["sirenic-mask", []],
  ["sirenic-hauberk", []],
  ["sirenic-chaps", []],
]);

/** Clear-reason text for empty USER_FORCE (category by id/name). */
function userForceClearReason(key, rec) {
  const blob = `${key} ${rec?.name || ""}`;
  if (/second-age/i.test(blob)) {
    return "user ruling: master casket / Global reward — not region-hard";
  }
  if (/scrimshaw/i.test(blob)) {
    return "user ruling: invent/POP craft — not Asgarnia-gated like EoF";
  }
  if (/\baura\b/i.test(blob)) {
    return "user ruling: Loyalty/Solomon store aura — not League region-gated";
  }
  if (/bakriminel|bolts \(e\)|bolts-e/i.test(blob)) {
    return "user ruling: invent fletching global — not region-hard";
  }
  if (
    /magic (long|short)bow|magic composite|elder (long|short)bow|yew (long|short)bow|yew composite/i.test(
      blob,
    )
  ) {
    return "user ruling: skilling bow — not league-hard combat gate";
  }
  if (/ancient lantern/i.test(blob)) {
    return "user ruling: invent-global offhand — leave empty (no hard region)";
  }
  if (/greater runic/i.test(blob)) {
    return "user ruling: Runespan reward — Misthalin-accessible not region-exclusive";
  }
  if (/^sirenic |item:sirenic-|sirenic-(mask|hauberk|chaps)/i.test(blob) && !/elite/i.test(blob)) {
    return "user ruling: base sirenic multi-source pressure — no hard required_regions";
  }
  return "user ruling: intentionally unverified / not region-gated";
}

/** True if key must never receive corpus stamps (USER_FORCE empty clear). */
function isUserForceClear(key) {
  const v = USER_FORCE.get(key);
  return Array.isArray(v) && v.length === 0;
}

/** Drop from equipment catalog — unusable / unobtainable / junk for main-game loadouts. */
const REMOVE_IDS = new Set([
  // pass1 — DT-only / unobtainable / joke / malformed
  "item:dominion-sword",
  "item:dominion-staff",
  "item:dominion-crossbow",
  "item:completionist-cape",
  "item:corrupted-slayer-helmet",
  "item:body-helmet", // malformed wiki scrape junk
  "item:swordy-mcswordface", // joke / unusable loadout row
  // pass2 — pure craft energy/components (no slot) that duplicate wearable sets/weapons
  "item:tectonic-energy",
  "item:malevolent-energy",
  "item:eldritch-crossbow-components",
  "item:fractured-staff-of-armadyl-components",
  "item:staff-of-armadyl", // FSoA component residual — not combat-wearable
  "item:frozen-core-of-leng",
  "item:dark-nilas",
  "item:leng-artefact",
  "item:croesus-foultorch", // skilling material, not combat wearable
  "item:croesus-sporehammer", // skilling material, not combat wearable
  // pass2 — malformed / phantom loadout rows
  "item:vestments-of-havoc-gloves", // no gloves piece on Vestments of Havoc set
  "item:glacier-boots", // Glacyte boots disambiguation scrap — not equippable
  // pass7 multi-region audit — wiki redirect phantom (no distinct trimmed spear item)
  "item:trimmed-masterwork-spear-of-annihilation",
  // pass2 — set aggregates with no slot that only duplicate equippable pieces
  "item:malevolent-armour",
  "item:tumekens-resplendence-equipment",
  "item:cryptbloom-armour",
  "item:dracolich-armour",
  "item:elite-dracolich-armour",
  "item:robes-of-the-first-necromancer",
  "item:igneous-capes",
  "item:godsword",
  // pass3 — deathwarden t60 craft base (not residual)
  "item:deathwarden-hood-t60",
  "item:deathwarden-robe-top-t60",
  "item:deathwarden-robe-bottom-t60",
  "item:deathwarden-gloves-t60",
  "item:deathwarden-boots-t60",
  // pass4 — slotless abilities/codices/progressions (not loadout wearables)
  "item:praesul-codex",
  "item:shard-of-genesis-essence",
  "item:barrows-defenders-shields-progression",
  "item:greater-concentrated-blast",
  "item:enhanced-glove-upgrades",
  "item:magma-tempest",
  "item:eclipsed-soul-prayer-codex",
  "item:memory-dowser",
  "item:runic-attuner",
  "item:divine-rage-prayer-codex",
  "item:invoke-lord-of-bones",
  "item:igneous-cape-progression",
  "item:corporeal-beast-holy-elixir-supply",
  // pass8 — phantom ammo (wiki has Stalker arrows, not Hexhunter arrows)
  "item:hexhunter-arrows",
  // pass5 — catalog hygiene: duplicate / mid-tier ladder spam that wrecks loadout browse
  // Death guard spaced-name twins + scrape aliases (pass5 kept bare/t80/t90; pass6 keeps t90 only)
  "item:death-guard-tier-70",
  "item:death-guard-tier-80",
  "item:death-guard-tier-90",
  "item:deathguard-tier-70",
  "item:deathguard-tier-80",
  "item:deathguard-tier-90",
  "item:death-guard-t70",
  "item:death-guard-t80",
  "item:death-guard-t90",
  // pass6 — Death guard residual t90 only (drop base t70 + t80 ladder spam)
  "item:deathguard",
  "item:deathguard-t80",
  // Skull lantern OH pair — same residual policy (t90 only)
  "item:skull-lantern",
  "item:skull-lantern-t80",
  "item:skull-lantern-tier-70",
  "item:skull-lantern-tier-80",
  "item:skull-lantern-tier-90",
  "item:skull-lantern-t70",
  // Deathdealer / deathwarden: keep *-t90 residual only (5 pieces each).
  // Bare + -t70/-t80 = catalog short forms; *-tier-70/80 = wiki slugId re-scrape forms.
  "item:deathdealer-hood",
  "item:deathdealer-robe-top",
  "item:deathdealer-robe-bottom",
  "item:deathdealer-gloves",
  "item:deathdealer-boots",
  "item:deathdealer-hood-t70",
  "item:deathdealer-robe-top-t70",
  "item:deathdealer-robe-bottom-t70",
  "item:deathdealer-gloves-t70",
  "item:deathdealer-boots-t70",
  "item:deathdealer-hood-t80",
  "item:deathdealer-robe-top-t80",
  "item:deathdealer-robe-bottom-t80",
  "item:deathdealer-gloves-t80",
  "item:deathdealer-boots-t80",
  "item:deathdealer-hood-tier-70",
  "item:deathdealer-robe-top-tier-70",
  "item:deathdealer-robe-bottom-tier-70",
  "item:deathdealer-gloves-tier-70",
  "item:deathdealer-boots-tier-70",
  "item:deathdealer-hood-tier-80",
  "item:deathdealer-robe-top-tier-80",
  "item:deathdealer-robe-bottom-tier-80",
  "item:deathdealer-gloves-tier-80",
  "item:deathdealer-boots-tier-80",
  // re-scrape twins of t90 (if wiki slugId form reappears mid-catalog)
  "item:deathdealer-hood-tier-90",
  "item:deathdealer-robe-top-tier-90",
  "item:deathdealer-robe-bottom-tier-90",
  "item:deathdealer-gloves-tier-90",
  "item:deathdealer-boots-tier-90",
  "item:deathwarden-hood",
  "item:deathwarden-robe-top",
  "item:deathwarden-robe-bottom",
  "item:deathwarden-gloves",
  "item:deathwarden-boots",
  "item:deathwarden-hood-t70",
  "item:deathwarden-robe-top-t70",
  "item:deathwarden-robe-bottom-t70",
  "item:deathwarden-gloves-t70",
  "item:deathwarden-boots-t70",
  "item:deathwarden-hood-t80",
  "item:deathwarden-robe-top-t80",
  "item:deathwarden-robe-bottom-t80",
  "item:deathwarden-gloves-t80",
  "item:deathwarden-boots-t80",
  "item:deathwarden-hood-tier-70",
  "item:deathwarden-robe-top-tier-70",
  "item:deathwarden-robe-bottom-tier-70",
  "item:deathwarden-gloves-tier-70",
  "item:deathwarden-boots-tier-70",
  "item:deathwarden-hood-tier-80",
  "item:deathwarden-robe-top-tier-80",
  "item:deathwarden-robe-bottom-tier-80",
  "item:deathwarden-gloves-tier-80",
  "item:deathwarden-boots-tier-80",
  "item:deathwarden-hood-tier-90",
  "item:deathwarden-robe-top-tier-90",
  "item:deathwarden-robe-bottom-tier-90",
  "item:deathwarden-gloves-tier-90",
  "item:deathwarden-boots-tier-90",
  // duplicate bolt id (same display name)
  "item:enchanted-bakriminel-bolts",
  // pass7 — catalog consistency: progression-path / plural-family aggregates (not loadout wearables)
  // Forsaken amulet already catalogued; this row is Barrows→Archaeology→Berserker's Fury relic chain narrative.
  "item:amulet-of-the-forsaken-to-berserkers-fury",
  // Wiki family scrape "Limitless staves" — Invention Limitless ability category, not a single weapon.
  "item:limitless-staff",
  "item:limitless-staves", // scrape alias guard
  // pass9 — catalog hygiene: wiki-redirect phantom duplicate of a kept wearable
  // "Ancient rebounder" redirects to "Ancient lantern" (same item); pass6 inject invented a twin row.
  "item:ancient-rebounder",
]);

for (const rule of FAMILY) {
  const meta = {
    source: rule.source,
    hard: true,
    requirement: rule.requirement,
    note: "family-expansion",
  };
  for (const rec of records) {
    if (rule.test(rec)) addClaim(stripItemPrefix(rec.id), rule.regions, meta);
  }
}

// ─── 5) agent region maps (parallel corpus audits → durable hard claims) ─────
// Written by research agents under scraped-data/agent-region-map-*.json
// Pass-1 used some group hubs; expand to real equipment ids so byId matches.
const AGENT_GROUP_EXPAND = new Map([
  [
    "attuned-crystal-weapons",
    [
      "attuned-crystal-dagger", "off-hand-attuned-crystal-dagger", "attuned-crystal-halberd",
      "attuned-crystal-bow", "attuned-crystal-chakram", "off-hand-attuned-crystal-chakram",
      "attuned-crystal-wand", "attuned-crystal-orb", "attuned-crystal-staff", "attuned-crystal-deflector",
    ],
  ],
  [
    "style-boots-shadow-spike",
    [
      "laceration-boots", "fleeting-boots", "blast-diffusion-boots",
      "enhanced-laceration-boots", "enhanced-fleeting-boots", "enhanced-blast-diffusion-boots",
    ],
  ],
  [
    "glacor-tank-boots",
    ["steadfast-boots", "ragefire-boots", "glaiven-boots"],
  ],
  [
    "t90-glacor-upgraded-boots",
    ["emberkeen-boots", "hailfire-boots", "flarefrost-boots"],
  ],
  // Pass3 Fremennik densify — group hubs from pass1 maps + DK base quartet.
  [
    "dagannoth-kings-rings",
    ["berserker-ring", "warrior-ring", "archers-ring", "seers-ring"],
  ],
  [
    "dk-rings",
    ["berserker-ring", "warrior-ring", "archers-ring", "seers-ring"],
  ],
  [
    "fremennik-dk-rings",
    ["berserker-ring", "warrior-ring", "archers-ring", "seers-ring"],
  ],

  [
    "tokhaar-kal-family",
    ["tokhaar-kal-ket", "tokhaar-kal-xil", "tokhaar-kal-mej", "tokhaar-kal-mor"],
  ],
  [
    "igneous-kal-family",
    [
      "igneous-kal-ket", "igneous-kal-xil", "igneous-kal-mej", "igneous-kal-mor",
      "igneous-kal-zuk",
      // igneous-cape-progression removed pass4 (slotless progression shell)
    ],
  ],
  [
    // Pass3: expand set hubs claimed in pass1 misthalin map / pass3 karamja map.
    "obsidian-armour",
    [
      "obsidian-warrior-helm", "obsidian-ranger-helm", "obsidian-mage-helm",
      "obsidian-platebody", "obsidian-platelegs", "obsidian-gloves", "obsidian-boots",
      "obsidian-kiteshield",
    ],
  ],
  [
    // Shilo gemstone cavern hub → piece ids (USER_FORCE karamja wins over any stale anachronia claim).
    "gemstone-armour",
    [
      "gemstone-helm", "gemstone-hauberk", "gemstone-greaves",
      "gemstone-gauntlets", "gemstone-boots",
    ],
  ],
  ["channellers-ring", ["channelers-ring"]],
  // pass6 residual: t90 DW pair only (base/t80 stripped)
  ["death-guard-skull-lantern", ["deathguard-t90", "skull-lantern-t90"]],
]);

// agent-region-map-* + agent-region-gaps-* + agent-accessories-pass* + agent-slayer-midgear* (pass3)
const agentMapFiles = readdirSync(join(ROOT, "scraped-data"))
  .filter(
    (n) =>
      /^agent-region-map-.*\.json$/i.test(n) ||
      /^agent-region-gaps-.*\.json$/i.test(n) ||
      /^agent-accessories-pass\d+\.json$/i.test(n) ||
      /^agent-slayer-midgear.*\.json$/i.test(n),
  )
  .sort();
for (const file of agentMapFiles) {
  let pack;
  try {
    pack = read(`scraped-data/${file}`);
  } catch {
    continue;
  }
  // agent-accessories-passN may use verified[] as the stampable list (items preferred).
  // agent-region-gaps-passN may also expose clear[] (handled only via USER_FORCE empties).
  const agentItems = pack.items?.length ? pack.items : pack.verified || [];
  for (const it of agentItems) {
    if (!it?.id?.startsWith("item:")) continue;
    if (it.lockType === "soft" || it.lockType === "pressure" || it.lockType === "clear") continue;
    if (/pressure_not_hard/i.test(it.confidence || "")) continue;
    const bare = stripItemPrefix(it.id);
    // Pass2 intentional empties — never re-stamp from agent maps.
    if (isUserForceClear(bare)) continue;
    if (/scrimshaw/i.test(it.id) || /scrimshaw/i.test(it.name || "")) continue;
    if (/\baura\b/i.test(it.id) || /\baura\b/i.test(it.name || "")) continue;
    if (/^sirenic-(mask|hauberk|chaps)$/i.test(bare)) continue; // base only; elite is hard family
    if (it.id === "item:luck-of-the-dwarves") continue;
    // pass6: invent craft / global residual — never hard-lock from agent maps (EoF is explicit).
    if (/invent|gizmo|blueprint|turtling|pneumatic|static-glove|tracking-glove/i.test(`${it.id} ${it.name || ""}`)) {
      continue;
    }
    // pass6: strip stale false Asgarnia claims from pass1/pass2 maps (USER_FORCE also wins).
    // staff-of-light = ice strykewyrms Fremennik (pass2 wrongly listed under GWD1).
    // razorback = Airut/Durzag desert (not QBD). strykebow = dark bow + wyrm scalp.
    if (
      bare === "staff-of-light" ||
      bare === "staff-of-darkness" ||
      bare === "razorback-gauntlets" ||
      bare === "strykebow"
    ) {
      continue;
    }
    // pass6: hydrix residual necks are Misthalin craft — skip pass1 asgarnia EoF-ingredient claims.
    if (
      bare === "reaper-necklace" ||
      bare === "amulet-of-souls" ||
      bare === "ring-of-death" ||
      bare === "deathtouch-bracelet"
    ) {
      continue;
    }
    // Hard audit: gemstone is Karamja (Shilo cavern). Skip stale anachronia agent claims;
    // family + USER_FORCE apply the correct lock. Still accept karamja claims from pass3 maps.
    if (
      (/^gemstone-/.test(bare) || /^gemstone /i.test(it.name || "")) &&
      Array.isArray(it.regions) &&
      it.regions.map(normRegion).includes("anachronia") &&
      !it.regions.map(normRegion).includes("karamja")
    ) {
      addClaim(bare, ["karamja"], {
        source: `agent-map:${file}:gemstone-karamja-override`,
        hard: true,
        requirement: it.name || it.id,
        note: "wiki Gemstone cavern Shilo = Karamja; reject anachronia-only agent claim",
      });
      continue;
    }
    // pass6: Dracolich = Fort Forinthry / Vorkath → Forinthry. Reject stale Misthalin agent claims
    // (pass1–3 maps + misthalin-tirannwn pack still list misthalin).
    if (
      (/^dracolich-/.test(bare) || /^elite-dracolich-/.test(bare) || /dracolich/i.test(it.name || "")) &&
      Array.isArray(it.regions) &&
      it.regions.map(normRegion).includes("misthalin") &&
      !it.regions.map(normRegion).includes("forinthry")
    ) {
      addClaim(bare, ["forinthry"], {
        source: `agent-map:${file}:dracolich-forinthry-override`,
        hard: true,
        requirement: it.name || it.id,
        note: "Fort Forinthry / Vorkath = Forinthry; reject misthalin-only agent claim",
      });
      continue;
    }
    const regions = [...new Set((it.regions || []).map(normRegion).filter((r) => VALID.has(r)))];
    if (!regions.length) continue;
    const expand = AGENT_GROUP_EXPAND.get(bare) || [bare];
    for (const key of expand) {
      if (isUserForceClear(key)) continue;
      // USER_FORCE non-empty keys still get claims then force-replace — ok
      addClaim(key, regions, {
        source: `agent-map:${file}`,
        hard: true,
        requirement: it.name || it.id,
        note: it.confidence || (expand.length > 1 ? `group-expand:${bare}` : ""),
      });
    }
  }
}

// ─── apply stamps ────────────────────────────────────────────────────────────
let taggedBefore = 0;
let stamped = 0;
let unioned = 0;
let createdUnlock = 0;
let removed = 0;
const stampedIds = [];
const conflicts = [];
const unmatchedClaims = [];

// Drop unusable / unobtainable loadout junk before stamping.
{
  const before = records.length;
  const kept = records.filter((r) => !REMOVE_IDS.has(r.id));
  removed = before - kept.length;
  records.length = 0;
  records.push(...kept);
  // Catalog display hygiene (loadout scan).
  for (const rec of records) {
    // Masterwork Spear of Annihilation is T92 (wiki); stale scrap had tier 90 + phantom "trimmed" row.
    if (rec.id === "item:masterwork-spear-of-annihilation") rec.tier = 92;
    if (rec.id === "item:essence-of-finality") {
      if (rec.tier == null) rec.tier = 90;
      if (!rec.style) rec.style = "hybrid";
    }
    // Canonical spelling on kept residual (pass6: t90 only for death guard / skull lantern).
    if (rec.id === "item:deathguard-t90") rec.name = "Death guard (tier 90)";
    if (rec.id === "item:skull-lantern-t90") rec.name = "Skull lantern (tier 90)";
  }
  byId.clear();
  for (const rec of records) {
    const bare = stripItemPrefix(rec.id);
    byId.set(bare, rec);
    byId.set(rec.id, rec);
    // Never let kebab(name) overwrite a real bare id — "Deathguard (tier 90)"
    // kebab-collapses to "deathguard" and was stealing the base Deathguard stamp.
    const kn = kebab(rec.name);
    if (kn && !byId.has(kn)) byId.set(kn, rec);
  }
  eqFile.records = records;
}

for (const rec of records) {
  if (rec.unlock?.regions?.length) taggedBefore++;
}

for (const [key, claim] of claims) {
  // Prefer exact item: id, then bare id, then first record whose bare id matches.
  // Avoid kebab-name collisions (Deathguard tier rows vs base Deathguard).
  const rec =
    byId.get(`item:${key}`) ||
    byId.get(key) ||
    records.find((r) => stripItemPrefix(r.id) === key);
  if (!rec) {
    unmatchedClaims.push({ key, regions: [...claim.regions], sources: claim.sources.map((s) => s.source) });
    continue;
  }
  // USER_FORCE empty clear wins — do not union corpus claims onto intentional empties.
  if (isUserForceClear(key) || isUserForceClear(stripItemPrefix(rec.id))) continue;
  if (!claim.hard && !claim.regions.size) continue;
  const regions = [...claim.regions].filter((r) => VALID.has(r)).sort();
  if (!regions.length) continue;
  // USER_FORCE non-empty replace still applied after claims.

  if (claim.conflict?.length) {
    conflicts.push({
      id: rec.id,
      name: rec.name,
      conflicts: claim.conflict,
      resolvedUnion: regions,
    });
  }

  const prev = rec.unlock?.regions ? [...rec.unlock.regions] : [];
  const prevSet = new Set(regionList(prev));
  const next = regionList([...prevSet, ...regions]);
  const changed = next.length !== prevSet.size || next.some((r) => !prevSet.has(r));

  if (!rec.unlock) {
    rec.unlock = {
      type: "drop",
      requirement: claim.requirement || "regional combat corpus",
      regions: next,
    };
    createdUnlock++;
    stamped++;
    stampedIds.push(rec.id);
  } else {
    const had = (rec.unlock.regions || []).length > 0;
    rec.unlock.regions = next;
    if (!rec.unlock.type) rec.unlock.type = "drop";
    if (!rec.unlock.requirement && claim.requirement) rec.unlock.requirement = claim.requirement;
    if (changed) {
      stamped++;
      stampedIds.push(rec.id);
      if (had) unioned++;
    }
  }
}

// Force-replace user overrides (wins over prior stamps; empty = clear false locks).
let userForceCleared = 0;
let userForceSet = 0;
for (const [key, regions] of USER_FORCE) {
  // Prefer exact item: id then bare id — never kebab(name) first (Deathguard tier collision).
  const rec =
    byId.get(`item:${key}`) ||
    byId.get(key) ||
    records.find((r) => stripItemPrefix(r.id) === key) ||
    records.find((r) => kebab(r.name) === key && stripItemPrefix(r.id) === key);
  if (!rec) {
    console.warn(`USER_FORCE miss: ${key}`);
    continue;
  }
  const next = regionList(regions);
  const prev = rec.unlock?.regions ? [...rec.unlock.regions] : [];
  const prevSorted = [...prev].sort();
  const prevReq = rec.unlock?.requirement || "";
  const changed =
    next.length !== prevSorted.length ||
    next.some((r, i) => r !== prevSorted[i]) ||
    (!next.length && !rec.unlock); // create explicit empty unlock for intentional clears
  if (!next.length) {
    // Clear region tags — intentional empty / not region-gated (pass2 policy).
    const reason = userForceClearReason(key, rec);
    rec.unlock = {
      type: rec.unlock?.type || "drop",
      requirement: reason,
      regions: [],
    };
    userForceCleared++;
  } else {
    rec.unlock = {
      type: rec.unlock?.type || "drop",
      requirement: rec.unlock?.requirement || "user region ruling 2026-07-26",
      regions: next,
    };
    userForceSet++;
  }
  if (changed || prevReq !== (rec.unlock?.requirement || "")) {
    stamped++;
    stampedIds.push(rec.id);
  }
}

const taggedAfter = records.filter((r) => r.unlock?.regions?.length).length;

// still-empty high-tier samples
const stillEmpty = records
  .filter((r) => (r.tier ?? 0) >= 80 && !(r.unlock?.regions?.length))
  .map((r) => ({ id: r.id, name: r.name, tier: r.tier, slot: r.slot, style: r.style }))
  .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0) || a.name.localeCompare(b.name))
  .slice(0, 80);

// name→regions index for merge-equipment-sync reuse
const index = {
  snapshotDate: new Date().toISOString().slice(0, 10),
  purpose: "Equipment id/name → required regions map stamped from regional combat corpus. Reuse in merge-equipment-sync; never invent regions.",
  validRegions: [...VALID],
  count: 0,
  byId: {},
  byName: {},
};
for (const rec of records) {
  const regs = rec.unlock?.regions;
  if (!regs?.length) continue;
  index.byId[rec.id] = [...regs];
  index.byName[rec.name] = [...regs];
  index.count++;
}

// key BiS snapshot for console
const KEY_BIS = [
  "item:drygore-mace", "item:off-hand-drygore-mace", "item:noxious-scythe", "item:noxious-longbow", "item:noxious-staff",
  "item:zaros-godsword", "item:seren-godbow", "item:staff-of-sliske",
  "item:seismic-wand", "item:seismic-singularity", "item:tectonic-helm", "item:elite-tectonic-mask",
  "item:malevolent-body", "item:torva-platebody", "item:pernix-body", "item:virtus-robe-top",
  "item:bandos-chestplate", "item:armadyl-chestplate", "item:garb-of-subjugation",
  "item:chaotic-rapier", "item:ascension-crossbow", "item:blightbound-crossbow", "item:cinderbane-gloves",
  "item:cryptbloom-body", "item:dracolich-body", "item:vestments-of-havoc-robe-top",
  "item:dark-shard-of-leng", "item:fractured-staff-of-armadyl", "item:essence-of-finality",
  "item:igneous-kal-zuk", "item:tokhaar-kal-ket",
  "item:fire-cape", "item:tokkul-zo", "item:obsidian-platebody", "item:gemstone-hauberk",
  "item:abomination-cape", "item:tzhaar-ket-om",
  "item:laceration-boots", "item:enhanced-laceration-boots", "item:blast-diffusion-boots",
  "item:steadfast-boots", "item:emberkeen-boots", "item:hailfire-boots", "item:flarefrost-boots",
  "item:trimmed-masterwork-platebody", "item:masterwork-platebody",
  "item:wand-of-the-praesul", "item:imperium-core", "item:ek-zekkil", "item:bow-of-the-last-guardian",
  "item:reavers-ring", "item:channelers-ring", "item:champions-ring", "item:anima-core-body-of-zaros",
  "item:masterwork-staff", "item:masterwork-2h-sword", "item:masterwork-bow",
  // pass2/pass3 accessories densify snapshot
  "item:reaper-necklace", "item:amulet-of-souls", "item:ring-of-death", "item:luck-of-the-dwarves",
  "item:dragon-rider-amulet", "item:deathtouch-bracelet", "item:max-cape",
  "item:illuminated-book-of-law", "item:underworld-grimoire-4", "item:erethdors-grimoire",
  "item:mercenarys-gloves", "item:gloves-of-passage", "item:enhanced-gloves-of-passage",
  "item:nightmare-gauntlets", "item:razorback-gauntlets", "item:asylum-surgeons-ring",
  "item:tokhaar-kal-ket", "item:igneous-kal-zuk",
  "item:scripture-of-jas", "item:scripture-of-wen", "item:scripture-of-ful",
  "item:scripture-of-bik", "item:scripture-of-amascut", "item:scripture-of-elidinis",
  "item:fire-cape", "item:essence-of-finality", "item:holy-wrench",
  "item:tokhaar-kal-mor", "item:igneous-kal-ket", "item:tokkul-zo",
  // pass3 slayer / mid-gear densify
  "item:slayer-helmet-i", "item:hexhunter-bow", "item:black-salamander", "item:cinderbane-gloves",
  // pass6 BiS residual inject
  "item:occultists-ring", "item:ring-of-vigour", "item:guthix-staff", "item:spirit-cape",
  "item:chaotic-kiteshield", "item:farseer-kiteshield", "item:kalphite-rebounder",
  "item:ancient-lantern", "item:stalker-arrows", "item:dragon-claws", "item:off-hand-dragon-claw",
  "item:enhanced-excalibur", "item:nightmare-gauntlets", "item:enhanced-nightmare-gauntlets",
  "item:decimation", "item:obliteration", "item:annihilation", "item:off-hand-shadow-glaive",
  "item:orb-of-the-cywir-elders",
];
const keyBis = {};
for (const id of KEY_BIS) {
  const rec = byId.get(id);
  if (rec) keyBis[id] = { name: rec.name, regions: rec.unlock?.regions ?? [] };
}

const report = {
  snapshotDate: index.snapshotDate,
  purpose: "Report for stamp-equipment-regions.mjs — corpus-only region stamping.",
  sources: {
    regionalCombatUnlocks: COMBAT_UNLOCKS,
    majorUpgrades: MAJOR,
    enrichmentFiles: enrichFiles,
  },
  counts: {
    equipmentTotal: records.length,
    taggedBefore,
    taggedAfter,
    newlyStampedOrUnioned: stamped,
    unlockObjectsCreated: createdUnlock,
    unionedExisting: unioned,
    claimsBuilt: claims.size,
    unmatchedClaims: unmatchedClaims.length,
    conflicts: conflicts.length,
    stillEmptyHighTier: stillEmpty.length,
    userForceCleared,
    userForceSet,
  },
  keyBis,
  conflicts,
  stillEmptyHighTier: stillEmpty,
  unmatchedClaims: unmatchedClaims.slice(0, 100),
  stampedSample: stampedIds.slice(0, 120),
};

write(EQ_PATH, eqFile);
write(INDEX_OUT, index);
write(REPORT_OUT, report);

// Re-fill empty bonuses from scraped stats after injects (never invents; never touches regions).
{
  const merge = spawnSync(process.execPath, [join(ROOT, "scripts/merge-equipment-longtail-stats.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (merge.stdout?.trim()) console.log(merge.stdout.trim());
  if (merge.status !== 0) {
    console.warn(`[warn] bonus merge exit ${merge.status}: ${(merge.stderr || merge.stdout || "").slice(0, 400)}`);
  }
}

// pass6 BiS residual inject report
{
  const pass6Ids = [
    "item:occultists-ring",
    "item:ring-of-vigour",
    "item:guthix-staff",
    "item:spirit-cape",
    "item:chaotic-kiteshield",
    "item:farseer-kiteshield",
    "item:kalphite-rebounder",
    // pass9: ancient-rebounder dropped (phantom of ancient-lantern)
    "item:stalker-arrows",
    "item:dragon-claws",
  ];
  const alreadyNamed = {
    "item:hexhunter-bow": "already present (Forinthry stalker dungeon)",
    "item:decimation": "already present (Forinthry Wilderness T87 trio)",
    "item:obliteration": "already present (Forinthry Wilderness T87 trio)",
    "item:annihilation": "already present (Forinthry Wilderness T87 trio)",
    "item:enhanced-excalibur": "already present (Kandarin diary)",
    "item:nightmare-gauntlets": "already present (Kandarin / Freneskae)",
    "item:enhanced-nightmare-gauntlets": "already present (Misthalin Leng upgrade)",
    "item:shadow-glaive": "already present (Desert GWD2)",
    "item:off-hand-shadow-glaive": "already present (Desert GWD2 OH)",
    "item:wand-of-the-cywir-elders": "already present (Desert GWD2)",
    "item:orb-of-the-cywir-elders": "already present (Desert GWD2 OH)",
    "item:blade-of-avaryss": "already present (Desert GWD2 OH)",
    "item:blade-of-nymora": "already present (Desert GWD2 main)",
    "item:dragon-rider-lance": "already present (Desert GWD2)",
  };
  const pass6Recs = pass6Ids.map((id) => byId.get(stripItemPrefix(id)) || records.find((r) => r.id === id)).filter(Boolean);
  const added = pass6Recs.filter((r) => catalogInjectedThisRun.includes(r.id));
  const alreadyInCatalog = pass6Recs.filter((r) => !catalogInjectedThisRun.includes(r.id));
  const alreadyChecked = Object.entries(alreadyNamed).map(([id, note]) => {
    const rec = byId.get(stripItemPrefix(id)) || records.find((r) => r.id === id);
    return {
      id,
      name: rec?.name || id,
      regions: rec?.unlock?.regions ?? [],
      note,
    };
  });
  write("scraped-data/agent-missing-bis-pass6.json", {
    snapshotDate: index.snapshotDate,
    purpose:
      "Pass6 CATALOG_EXTRA inject: high-value BiS residual wearables still absent after pass1–5. Audit first (Hexhunter/Decimation/Obliteration/Excalibur/Nightmare/GWD2 OH already present). Inject only real wearables with slot + wiki sources; stamp regions via FAMILY + USER_FORCE.",
    audit: {
      hexhunterBow: "present",
      decimationObliterationAnnihilation: "present",
      gwd2Offhands: "present (off-hand shadow glaive, orb of the cywir elders, blade of avaryss OH)",
      enhancedExcalibur: "present",
      nightmareGauntlets: "present (base + enhanced)",
      gapsFilled: pass6Ids,
    },
    injectedThisRun: added.map((r) => ({
      id: r.id,
      name: r.name,
      slot: r.slot,
      style: r.style,
      tier: r.tier,
      regions: r.unlock?.regions ?? [],
      requirement: r.unlock?.requirement || "",
      sources: r.sources,
    })),
    alreadyPresentTargets: alreadyInCatalog.map((r) => ({
      id: r.id,
      name: r.name,
      regions: r.unlock?.regions ?? [],
      requirement: r.unlock?.requirement || "",
    })),
    alreadyPresentNamedBis: alreadyChecked,
    skipped: {
      croesusFoultorchSporehammer: "REMOVE_IDS — skilling off-hands, not combat wearables",
      memoryDowserRunicAttuner: "REMOVE_IDS — Gate of Elidinis skilling tools / codex residual",
      baseExcalibur: "Enhanced Excalibur already catalogs the diary path wearable",
      hexhunterAlready: "bow present; only arrows were missing",
    },
    counts: {
      injected: added.length,
      targetsAlreadyPresent: alreadyInCatalog.length,
      catalogInjectedThisRunTotal: catalogInjectedThisRun.length,
    },
  });
  console.log(`pass6 BiS inject report: +${added.length} new / ${alreadyInCatalog.length} targets already present`);
}

// pass9 BiS residual inject report
{
  const pass9Ids = [
    "item:custom-fit-trimmed-masterwork-melee-helm",
    "item:custom-fit-trimmed-masterwork-melee-platebody",
    "item:custom-fit-trimmed-masterwork-melee-platelegs",
    "item:custom-fit-trimmed-masterwork-melee-gloves",
    "item:custom-fit-trimmed-masterwork-melee-boots",
    "item:custom-fit-masterwork-magic-hat",
    "item:custom-fit-masterwork-magic-robe-top",
    "item:custom-fit-masterwork-magic-robe-bottom",
    "item:custom-fit-masterwork-magic-gloves",
    "item:custom-fit-masterwork-magic-boots",
    "item:custom-fit-masterwork-ranged-cowl",
    "item:custom-fit-masterwork-ranged-body",
    "item:custom-fit-masterwork-ranged-chaps",
    "item:custom-fit-masterwork-ranged-vambraces",
    "item:custom-fit-masterwork-ranged-boots",
    "item:morrigans-javelin",
    "item:morrigans-throwing-axe",
    "item:misalionars-death-mask",
    "item:visage-of-the-first-necromancer",
  ];
  const alreadyNamed = {
    "item:masterwork-magic-hat": "present (base MW magic set)",
    "item:masterwork-ranged-cowl": "present (base MW ranged set)",
    "item:trimmed-masterwork-helm": "present (trimmed MW melee; custom-fit is distinct id)",
    "item:kerapacs-wrist-wraps": "present",
    "item:enhanced-kerapacs-wrist-wraps": "present",
    "item:cryptbloom-gloves": "present (cryptbloom 5/5 complete)",
    "item:cryptbloom-boots": "present",
    "item:vestments-of-havoc-hood": "present (Vestments full 4-piece set — no gloves)",
    "item:vestments-of-havoc-boots": "present",
    "item:devourers-guard": "present (Amascut t95 necro MH)",
    "item:tumekens-light": "present",
    "item:superior-morrigans-javelin": "present (base Morrigan injected this pass)",
    "item:first-necromancer-helm": "present (crown; visage/death mask injected)",
    "item:shadow-glaive": "present (GWD2)",
    "item:orb-of-the-cywir-elders": "present (GWD2 OH)",
  };
  const pass9Recs = pass9Ids.map((id) => byId.get(stripItemPrefix(id)) || records.find((r) => r.id === id)).filter(Boolean);
  const added = pass9Recs.filter((r) => catalogInjectedThisRun.includes(r.id));
  const alreadyInCatalog = pass9Recs.filter((r) => !catalogInjectedThisRun.includes(r.id));
  const alreadyChecked = Object.entries(alreadyNamed).map(([id, note]) => {
    const rec = byId.get(stripItemPrefix(id)) || records.find((r) => r.id === id);
    return {
      id,
      name: rec?.name || id,
      regions: rec?.unlock?.regions ?? [],
      note,
    };
  });
  write("scraped-data/agent-missing-bis-pass9.json", {
    snapshotDate: index.snapshotDate,
    purpose:
      "Pass9 CATALOG_EXTRA inject: high-value BiS residual wearables still absent after pass1–8. Audit custom-fit MW / GWD2-Amascut / base Morrigan / Kerapac / Cryptbloom / Vestments. Inject only real wiki wearables with slot + bonuses; stamp regions via FAMILY + USER_FORCE.",
    audit: {
      masterworkMagicRangedBase: "present (5 magic + 5 ranged)",
      customFitTrimmedMw: "was missing — injected 5 melee custom-fit pieces",
      customFitMagicRanged: "was missing — injected 5 magic + 5 ranged custom-fit pieces",
      gwd2WeaponsAnima: "present (glaives, Cywir, Avaryss/Nymora, anima cores)",
      amascutCombat: "present (Devourer's Guard, Tumeken's Light, resplendence 5/5); Amascut's crown skipped (POH trophy)",
      superiorMorrigan: "present; base javelin + throwing axe were missing — injected",
      kerapacWraps: "present (base + enhanced)",
      cryptbloom: "complete (helm/body/legs/gloves/boots)",
      vestmentsOfHavoc: "complete 4/4 (hood/top/bottom/boots); gloves are not a real set piece (REMOVE_IDS)",
      firstNecromancer: "body set present; death mask + visage were missing — injected",
    },
    injectedThisRun: added.map((r) => ({
      id: r.id,
      name: r.name,
      slot: r.slot,
      style: r.style,
      tier: r.tier,
      regions: r.unlock?.regions ?? [],
      requirement: r.unlock?.requirement || "",
      bonuses: r.bonuses || {},
      sources: r.sources,
    })),
    alreadyPresentTargets: alreadyInCatalog.map((r) => ({
      id: r.id,
      name: r.name,
      regions: r.unlock?.regions ?? [],
      requirement: r.unlock?.requirement || "",
    })),
    alreadyPresentNamedBis: alreadyChecked,
    skipped: {
      amascutsCrown: "POH boss trophy — not a combat wearable",
      customFitSpiked: "cosmetic convert of custom-fit trimmed (same combat stats) — not catalogued",
      vestmentsGloves: "REMOVE_IDS — Vestments of Havoc has no gloves piece on wiki",
      gwd2Crests: "not combat armour pieces for loadout (insignia/crest craft mats if any)",
      offHandMorrigan: "wiki: Morrigan thrown weapons have no OH counterparts",
    },
    counts: {
      injected: added.length,
      targetsAlreadyPresent: alreadyInCatalog.length,
      catalogInjectedThisRunTotal: catalogInjectedThisRun.length,
      pass9TargetCount: pass9Ids.length,
    },
  });
  console.log(`pass9 BiS inject report: +${added.length} new / ${alreadyInCatalog.length} targets already present`);
}

// pass3 catalog-inject report (deathwarden / obsidian / gemstone / GWD1 residual)
{
  const pass3Prefixes = [
    "item:deathwarden-",
    "item:obsidian-",
    "item:gemstone-",
    "item:ward-of-subjugation",
    "item:bandos-warshield",
    "item:saradomins-",
  ];
  const pass3Recs = records.filter((r) => pass3Prefixes.some((p) => r.id === p || r.id.startsWith(p)));
  const added = pass3Recs.filter((r) => catalogInjectedThisRun.includes(r.id));
  const alreadyPresent = pass3Recs.filter((r) => !catalogInjectedThisRun.includes(r.id));
  const pass3Report = {
    snapshotDate: index.snapshotDate,
    purpose:
      "Pass3 CATALOG_EXTRA inject: Deathwarden residual, Obsidian/Gemstone Karamja armour (Shilo cavern), GWD1 residual shields/amulets. Only real wearables; wiki sources verifiedAt 2026-07-26.",
    injectedThisRun: added.map((r) => ({
      id: r.id,
      name: r.name,
      slot: r.slot,
      style: r.style,
      tier: r.tier,
      regions: r.unlock?.regions ?? [],
      requirement: r.unlock?.requirement || "",
      sources: r.sources,
    })),
    alreadyPresent: alreadyPresent.map((r) => ({
      id: r.id,
      name: r.name,
      regions: r.unlock?.regions ?? [],
      requirement: r.unlock?.requirement || "",
    })),
    skipped: {
      deathwardenTiersBelow70:
        "t10–t50 never injected; t60 REMOVE_IDS — craft base into deathdealer, not loadout residual",
      deathwardenKept: "T90 residual only (5 pieces); bare/t70/t80 + scrape *-tier-70/80/90 stripped by REMOVE_IDS",
      deathguardKept: "pass6: deathguard-t90 only (base + t80 + scrape aliases stripped)",
      skullLanternKept: "pass6: skull-lantern-t90 only (pairs death guard residual)",
      deathdealerKept: "T90 residual only (5 pieces); bare/t70/t80 + scrape *-tier-* stripped",
      obsidianPlateskirt: "legs alt of platelegs",
      toktzWeapons: "not armour; kiln/cape path already covered",
      gwd1AlreadyCatalogued: "bandos/armadyl/subjugation/torva/pernix/virtus + GWD2 anima-core present",
      gemstoneGolemOutfit: "skilling Mining outfit — not combat wearable residual",
    },
    counts: {
      injectedThisRun: added.length,
      alreadyPresent: alreadyPresent.length,
      pass3GroupTotal: pass3Recs.length,
    },
  };
  write("scraped-data/agent-catalog-inject-pass3.json", pass3Report);
  console.log(`pass3 inject report: +${added.length} new / ${alreadyPresent.length} already present → scraped-data/agent-catalog-inject-pass3.json`);
}

console.log(`EQUIPMENT REGION STAMP
  total equipment:     ${records.length}
  removed (junk):      ${removed}
  tagged before:       ${taggedBefore}
  tagged after:        ${taggedAfter}
  stamped/unioned:     ${stamped}
  unlocks created:     ${createdUnlock}
  unioned existing:    ${unioned}
  user force cleared:  ${userForceCleared}
  user force set:      ${userForceSet}
  claims built:        ${claims.size}
  unmatched claims:    ${unmatchedClaims.length}
  conflicts:           ${conflicts.length}
  still-empty t80+ :   ${stillEmpty.length} (sample in report)
  index:               ${INDEX_OUT} (${index.count} entries)
  report:              ${REPORT_OUT}
`);
console.log("Key BiS → regions:");
for (const [id, v] of Object.entries(keyBis)) {
  console.log(`  ${id}  ${v.regions.join("+") || "(empty)"}  ${v.name}`);
}
if (conflicts.length) {
  console.log("\nConflicts (union applied):");
  for (const c of conflicts.slice(0, 20)) {
    console.log(`  ${c.id}: ${JSON.stringify(c.resolvedUnion)}`);
  }
}
