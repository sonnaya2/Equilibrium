/**
 * April 2026 Aura Overhaul truth for Equilibrium planner:
 *
 * Combat auras (Berserker / Maniacal / Reckless / Mahjarrat / Equilibrium / Dark Magic /
 * Vampyrism as *aura*, etc.) were REMOVED without a 1:1 replacement — not store items.
 * This script DELETES those equipment records (do not re-insert for loadout math).
 *
 * Useful aura effects moved to in-game unlocks. Assign elective regions for those that
 * have a real place gate; leave skill/tool passives with empty hard regions.
 *
 * Official: https://secure.runescape.com/m=news/patch-notes-aura-overhaul
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const write = (p, v) => writeFileSync(join(ROOT, p), `${JSON.stringify(v, null, 2)}\n`);

const SOURCE =
  "https://secure.runescape.com/m=news/patch-notes-aura-overhaul";
const VERIFIED = "2026-04-13";

/** Historical combat aura equipment ids — deleted from the corpus, never re-stamped. */
const REMOVED_COMBAT_AURA_IDS = new Set([
  "item:berserker-aura",
  "item:reckless-aura",
  "item:maniacal-aura",
  "item:mahjarrat-aura",
  "item:equilibrium-aura",
  "item:dark-magic-aura",
  "item:vampyrism-aura",
]);

/**
 * Progression redistributed unlocks → hard required_regions (or empty = global skill/tool).
 * Place gates only.
 */
const REDISTRIBUTED = {
  "aura-overhaul:greenfingers-passive": {
    required_regions: ["desert"],
    region_hint: "desert",
    region_requirement_type: "acquisition_region",
    location_note:
      "Sydekix's Shop of Balance, Garden of Kharid (Desert) — 30,000 Crux Eqal favour",
  },
  "aura-overhaul:focused-siphoning-passive": {
    required_regions: ["misthalin"],
    region_hint: "misthalin",
    region_requirement_type: "acquisition_region",
    region_status: "shop_misthalin_runespan_points_global",
    location_note:
      "Wizard Rinsit's Runecrafting Shop, Wizards' Tower roof (Misthalin) — 20,000 Runespan points",
  },
  "aura-overhaul:five-finger-discount-passive": {
    required_regions: ["misthalin"],
    region_hint: "misthalin",
    region_requirement_type: "acquisition_region",
    location_note: "Thieves' Guild (Misthalin) — pilfer points; also from Heists",
  },
  "aura-overhaul:divination-enrichment-progression": {
    required_regions: [],
    region_hint: "global_skill",
    region_requirement_type: "none",
    location_note: "Divination level passive (39 / 59 / 79 / 99) — not region-gated",
  },
  "aura-overhaul:mining-critical-progression": {
    required_regions: [],
    region_hint: "global_skill",
    region_requirement_type: "none",
    location_note: "Mining level passive (59 / 85) — not region-gated",
  },
  "aura-overhaul:resourceful-material-cache-rule": {
    required_regions: [],
    region_hint: "global_skill",
    region_requirement_type: "none",
    location_note: "Archaeology material-cache rule (global skill) — not region-gated",
  },
  "aura-overhaul:sunspear-prayer-sustain": {
    required_regions: ["morytania"],
    region_hint: "morytania",
    region_requirement_type: "acquisition_region",
    location_note:
      "Sunspear Vyre cremation / Columbarium (Morytania) — Harmony/Corruption/Salvation replacement",
  },
  "aura-overhaul:vampyrism-aspect": {
    required_regions: ["desert"],
    region_hint: "desert",
    region_requirement_type: "spellbook_region",
    location_note:
      "Ancient Magicks Aspect (Magic 69) — requires Ancient Magicks (Desert Treasure / desert spellbook path)",
  },
  "aura-overhaul:penance-aspect": {
    required_regions: [],
    region_hint: "global_skill",
    region_requirement_type: "none",
    location_note: "Standard spellbook Aspect (Magic 67) — not elective-region gated",
  },
  "aura-overhaul:fishing-catch-replacements": {
    required_regions: [],
    region_hint: "global_tools",
    region_requirement_type: "none",
    location_note: "Call of the Sea folded into Fishing tools / familiars — not region-gated",
  },
  "aura-overhaul:hatchet-chopping-bonuses": {
    required_regions: [],
    region_hint: "global_tools",
    region_requirement_type: "none",
    location_note: "Lumberjack folded into hatchet tiers — not region-gated",
  },
  "aura-overhaul:antipoison-totem": {
    required_regions: [],
    region_hint: "global_item",
    region_requirement_type: "none",
    location_note: "Poison Purge replacement — 100% poison immunity pocket item (craft/global item)",
  },
  "anachronia:totem-of-vitality": {
    required_regions: ["anachronia"],
    region_hint: "anachronia",
    region_requirement_type: "acquisition_region",
    location_note: "Might of Het → Totem of Vitality (Anachronia totems)",
  },
};

const eqPath = "data/combat/equipment.json";
const eq = read(eqPath);
const beforeEq = (eq.records || []).length;
eq.records = (eq.records || []).filter(
  (row) => row.slot !== "aura" && !REMOVED_COMBAT_AURA_IDS.has(row.id),
);
const eqDeleted = beforeEq - eq.records.length;
write(eqPath, eq);

// Drop the historical auras catalogue if a sync reintroduced it.
const aurasPath = join(ROOT, "data/combat/auras.json");
let aurasDeleted = false;
if (existsSync(aurasPath)) {
  unlinkSync(aurasPath);
  aurasDeleted = true;
}

const iconsPath = "data/combat/equipment-icons.json";
let iconN = 0;
try {
  const icons = read(iconsPath);
  const bag = icons.icons || icons.records || icons;
  for (const id of REMOVED_COMBAT_AURA_IDS) {
    if (bag && bag[id]) {
      delete bag[id];
      iconN++;
    }
  }
  write(iconsPath, icons);
} catch {
  /* optional */
}

const slugsPath = "data/combat/equipment-icon-slugs.json";
let slugN = 0;
try {
  const slugs = read(slugsPath);
  const slugSet = new Set([...REMOVED_COMBAT_AURA_IDS].map((id) => id.replace(/^item:/, "")));
  if (Array.isArray(slugs)) {
    const next = slugs.filter((s) => {
      if (slugSet.has(s)) {
        slugN++;
        return false;
      }
      return true;
    });
    write(slugsPath, next);
  } else if (Array.isArray(slugs.slugs)) {
    slugs.slugs = slugs.slugs.filter((s) => {
      if (slugSet.has(s)) {
        slugN++;
        return false;
      }
      return true;
    });
    write(slugsPath, slugs);
  }
} catch {
  /* optional */
}

const idxPath = "data/research/equipment-region-index.json";
let idxN = 0;
try {
  const idx = read(idxPath);
  if (idx.byId && typeof idx.byId === "object") {
    for (const id of REMOVED_COMBAT_AURA_IDS) {
      if (id in idx.byId) {
        delete idx.byId[id];
        idxN++;
      }
    }
    if (typeof idx.count === "number") idx.count = Object.keys(idx.byId).length;
    write(idxPath, idx);
  } else if (idx.records && typeof idx.records === "object") {
    for (const id of REMOVED_COMBAT_AURA_IDS) {
      if (id in idx.records) {
        delete idx.records[id];
        idxN++;
      }
    }
    write(idxPath, idx);
  } else if (idx && typeof idx === "object") {
    for (const id of REMOVED_COMBAT_AURA_IDS) {
      if (id in idx) {
        delete idx[id];
        idxN++;
      }
    }
    write(idxPath, idx);
  }
} catch {
  /* optional file */
}

const progPath = "data/reference/progression-unlocks.json";
const prog = read(progPath);
let progN = 0;
for (const section of Object.keys(prog)) {
  if (!Array.isArray(prog[section])) continue;
  for (const row of prog[section]) {
    const patch = REDISTRIBUTED[row.id];
    if (!patch) continue;
    row.required_regions = [...patch.required_regions];
    if (patch.region_hint) row.region_hint = patch.region_hint;
    if (patch.region_requirement_type) row.region_requirement_type = patch.region_requirement_type;
    if (patch.region_status) row.region_status = patch.region_status;
    if (patch.location_note) row.location_note = patch.location_note;
    row.source_url = row.source_url || SOURCE;
    row.confidence = row.confidence || "confirmed_official_2026";
    progN++;
  }
}
write(progPath, prog);

const skPath = "data/research/regional-skilling-unlocks.json";
const sk = read(skPath);
let skN = 0;
for (const row of sk.records || []) {
  if (row.id !== "invention:augmentor" && row.id !== "asgarnia:augmentor") continue;
  row.id = "invention:augmentor";
  row.requiredRegions = [];
  row.regionHints = [];
  row.regionRequirementType = "single";
  row.comboLabel = "";
  row.isRegionCombo = false;
  if (typeof row.detail === "string" && !/not region-locked|global \(not/i.test(row.detail)) {
    row.detail = `${row.detail} · Invention workbench craft is global (not region-locked).`;
  }
  skN++;
}
write(skPath, sk);

// catalog: invent augmentor is global — not hosted under any elective region
const catPath = "data/research/catalog.json";
const cat = read(catPath);
let catN = 0;
for (const region of cat.regions || []) {
  const before = region.upgrades?.length || 0;
  region.upgrades = (region.upgrades || []).filter((u) => {
    if (!/augmentor/i.test(u.name || "")) return true;
    catN++;
    return false;
  });
  void before;
}
write(catPath, cat);

/** Player-facing rows for the Data workbench region rail. */
const BROWSE_ROWS = [
  {
    id: "desert:greenfingers-passive",
    name: "Greenfingers passive (ex-aura)",
    region: "desert",
    category: "Aura Overhaul — permanent Farming unlock",
    detail:
      "7% chance to increase herb, allotment, hops, mushroom and nightshade crop yields. Bought from Sydekix's Shop of Balance in the Garden of Kharid for 30,000 Crux Eqal favour. Replaces the old Greenfingers aura.",
    requirements: ["30,000 Crux Eqal favour", "Garden of Kharid access (Desert)"],
  },
  {
    id: "misthalin:focused-siphoning-passive",
    name: "Focused Siphoning passive (ex-aura)",
    region: "misthalin",
    category: "Aura Overhaul — permanent Runespan unlock",
    detail:
      "7.5% increased Runespan siphoning success. Bought from Wizard Rinsit's Runecrafting Shop on the Wizards' Tower roof for 20,000 Runespan points. Replaces the old Focused Siphoning aura.",
    requirements: ["20,000 Runespan points", "Wizards' Tower (Misthalin)"],
  },
  {
    id: "misthalin:five-finger-discount-passive",
    name: "Five-Finger Discount passive (ex-aura)",
    region: "misthalin",
    category: "Aura Overhaul — permanent Thieving unlock",
    detail:
      "Up to five ranks (+2% pickpocket success each, max +10%) from the Thieves' Guild for pilfer points (also from Heists). Replaces the old Five-Finger Discount aura.",
    requirements: ["Thieves' Guild (Misthalin)", "1,000 pilfer points per rank"],
  },
  {
    id: "desert:vampyrism-aspect",
    name: "Vampyrism Aspect (ex-aura)",
    region: "desert",
    category: "Aura Overhaul — Ancient Magicks combat Aspect",
    detail:
      "Ancient Magicks Aspect (Magic 69): heals 5% of damage dealt (cap 50 LP per hit) for 12 minutes. Only one Aspect can be active. Replaces the Vampyrism combat aura — requires Ancient Magicks.",
    requirements: ["69 Magic", "Ancient Magicks spellbook (Desert Treasure path)"],
  },
  {
    id: "global:penance-aspect",
    name: "Penance Aspect (ex-aura)",
    region: null,
    category: "Aura Overhaul — Standard spellbook combat Aspect",
    detail:
      "Standard spellbook Aspect (Magic 67): restores Prayer equal to 5% of damage taken (cap 100) for 12 minutes. Only one Aspect can be active. Replaces the Penance combat aura — not elective-region gated.",
    requirements: ["67 Magic", "Standard spellbook"],
  },
  {
    id: "morytania:sunspear-prayer-sustain",
    name: "Sunspear Vyre prayer sustain (ex-aura)",
    region: "morytania",
    category: "Aura Overhaul — Morytania combat passive",
    detail:
      "Cremating Vyres with Sunspear unlocks prayer restore on Vyre kills (1–5% by cremation ladder). Replaces Harmony / Corruption / Salvation aura prayer sustain.",
    requirements: ["Sunspear", "Vyre cremation / Columbarium (Morytania)"],
  },
  {
    id: "anachronia:totem-of-vitality-browse",
    name: "Totem of Vitality (ex-Might of Het aura)",
    region: "anachronia",
    category: "Aura Overhaul — Anachronia totem",
    detail:
      "+25% maximum life points (cap +1,500). Replaces the Desert Pantheon / Might of Het aura effect. Anachronia totems no longer need weekly charging.",
    requirements: ["Anachronia base camp / totem system"],
  },
  {
    id: "global:divination-enrichment-progression",
    name: "Enriched memory chance (ex-Enrichment aura)",
    region: null,
    category: "Aura Overhaul — Divination level passive",
    detail:
      "Enriched memory chance scales with Divination level: 2% at 39, 4% at 59, 7% at 79, 10% at 99. Not region-gated.",
    requirements: ["Divination level thresholds"],
  },
  {
    id: "global:mining-critical-progression",
    name: "Mining critical chance (ex-Quarrymaster aura)",
    region: null,
    category: "Aura Overhaul — Mining level passive",
    detail: "+5% Mining critical chance at 59, another +5% at 85 (10% total). Not region-gated.",
    requirements: ["Mining 59 / 85"],
  },
  {
    id: "global:material-cache-consistency",
    name: "Material cache consistency (ex-Resourceful aura)",
    region: null,
    category: "Aura Overhaul — Archaeology gathering passive",
    detail:
      "An Archaeology material cache cannot expire on the first two gathers. Not region-gated.",
    requirements: ["Archaeology material caches"],
  },
  {
    id: "global:aura-system-removed",
    name: "Combat auras removed (Berserker / Maniacal / Reckless…)",
    region: null,
    category: "Aura Overhaul — system removal",
    detail:
      "The aura equipment slot's timed combat powers were removed on 13 April 2026. Berserker, Maniacal, Reckless, Mahjarrat, Equilibrium, Dark Magic and many others have no 1:1 replacement. Plan Equilibrium combat without those auras.",
    requirements: [],
  },
];

function toSkillingRecord(row) {
  const req = row.region ? [row.region] : [];
  return {
    id: row.id,
    name: row.name,
    recordType: "activity",
    regionHints: req.length ? req : [],
    requiredRegions: req,
    regionRequirementType: req.length ? "single" : "single",
    comboLabel: "",
    isRegionCombo: false,
    category: row.category,
    detail: row.detail,
    requirements: row.requirements || [],
    confidence: "confirmed_official_2026",
    source: {
      source: "jagex",
      url: SOURCE,
      title: "Patch Notes: Aura Overhaul",
      verifiedAt: VERIFIED,
    },
    sourceFile: "fix-aura-regions-2026.mjs",
  };
}

// Re-read sk after augmentor patch
const sk2 = read(skPath);
const keepIds = new Set(BROWSE_ROWS.map((r) => r.id));
sk2.records = (sk2.records || []).filter(
  (r) =>
    !String(r.id || "").includes("greenfingers-passive") &&
    !String(r.id || "").includes("focused-siphoning-passive") &&
    !String(r.id || "").includes("five-finger-discount") &&
    !String(r.id || "").includes("vampyrism-aspect") &&
    !String(r.id || "").includes("penance-aspect") &&
    !String(r.id || "").includes("sunspear-prayer-sustain") &&
    !String(r.id || "").includes("totem-of-vitality-browse") &&
    !String(r.id || "").includes("divination-enrichment") &&
    !String(r.id || "").includes("mining-critical") &&
    !String(r.id || "").includes("material-cache-consistency") &&
    !String(r.id || "").includes("aura-system-removed") &&
    !keepIds.has(r.id),
);
for (const row of BROWSE_ROWS) sk2.records.push(toSkillingRecord(row));
write(skPath, sk2);

// Catalog: host under hard region, or skip global-only (still on Unlocks tab)
const cat2 = read(catPath);
let browseCat = 0;
for (const row of BROWSE_ROWS) {
  if (!row.region) continue;
  const region = (cat2.regions || []).find((r) => r.id === row.region);
  if (!region) continue;
  region.upgrades ||= [];
  region.upgrades = region.upgrades.filter((u) => u.name !== row.name);
  region.upgrades.push({
    name: row.name,
    category: row.category,
    detail: row.detail,
    requirements: row.requirements || [],
    confidence: "confirmed_official_2026",
    source: {
      source: "jagex",
      url: SOURCE,
      title: "Patch Notes: Aura Overhaul",
      verifiedAt: VERIFIED,
    },
    regionId: row.region,
    regionHints: [row.region],
    requiredRegions: [row.region],
    regionRequirementType: "single",
    comboLabel: "",
    isRegionCombo: false,
  });
  browseCat++;
}
write(catPath, cat2);

// Enrich system-removal-guard notes for Unlocks tab
for (const section of Object.keys(prog)) {
  if (!Array.isArray(prog[section])) continue;
  const guard = prog[section].find((r) => r.id === "aura-overhaul:system-removal-guard");
  if (guard) {
    guard.notes =
      "Timed combat auras and the worn aura power slot were removed on 13 April 2026. Useful skilling/combat effects moved to passives, tools, Aspects, Sunspear, and Anachronia totems — see Aura Overhaul account unlocks.";
    guard.effect =
      "No Berserker / Maniacal / Reckless / Mahjarrat / Equilibrium / Dark Magic combat aura path. Plan without those slots.";
    guard.category = "Aura Overhaul — system removal";
  }
}
write(progPath, prog);

console.log(
  JSON.stringify(
    {
      equipmentAurasDeleted: eqDeleted,
      aurasJsonDeleted: aurasDeleted,
      equipmentIconsRemoved: iconN,
      equipmentSlugsRemoved: slugN,
      regionIndexKeysDropped: idxN,
      progressionRedistributedPatched: progN,
      augmentorRows: skN,
      catalogAugmentorDropped: catN,
      browseRowsEmitted: BROWSE_ROWS.length,
      catalogRegionHosts: browseCat,
      mapping: {
        deletedCombatAuraIds: [...REMOVED_COMBAT_AURA_IDS],
        desert: ["Greenfingers (Garden of Kharid)", "Vampyrism Aspect (Ancient Magicks)"],
        misthalin: ["Focused Siphoning (Wizards' Tower)", "Five-Finger Discount (Thieves' Guild)"],
        morytania: ["Sunspear Vyre prayer sustain"],
        anachronia: ["Totem of Vitality (Might of Het)"],
        globalSkillOrTool: [
          "Divination enrichment",
          "Mining crit",
          "Material cache rule",
          "Penance Aspect",
          "Fishing/hatchet replacements",
          "Antipoison totem",
        ],
      },
    },
    null,
    2,
  ),
);
