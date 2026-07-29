import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Builds data/combat/abilities.json from the curated corpus:
 *   scraped-data/combat-ability-audit-2026-07-24.json  (post-modernisation Magic/Ranged seed)
 *   scraped-data/combat-2026.json                      (modernisation melee, engine-verified)
 *
 * Facts are carried faithfully; range strings are parsed mechanically and anything
 * prose-shaped is preserved in displayDescription instead of being guessed at.
 * Run: node scripts/sync-combat-records.mjs
 */

const ROOT = process.cwd();
const TICK_SECONDS = 0.6;
const VERIFIED_AT = "2026-07-25";
const MODERNISATION_SOURCE = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Combat_Style_Modernisation",
  title: "Combat Style Modernisation",
  verifiedAt: "2026-07-24",
};

const kebab = (name) =>
  name
    .split(" / ")[0]
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const CATEGORY_BY_AUDIT_TYPE = {
  basic: "basic",
  enhanced: "enhanced",
  ultimate: "ultimate",
  utility_interaction: "utility",
  greater_basic_upgrade: "basic",
  ultimate_upgrade: "ultimate",
};

const ticks = (seconds) => Math.round(seconds / TICK_SECONDS);

/** Parses "90-110" / "520-570%" into [min, max], and single stated values like
 *  "315" or "70%" into the degenerate band [v, v] — exactly what the page states. */
function parseRange(text) {
  const match = /^(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?%?$/.exec(String(text).trim());
  if (!match) return null;
  const min = Number(match[1]);
  return [min, match[2] != null ? Number(match[2]) : min];
}

/** Extracts a per-hit range from prose like "8 bleed hits at 25-35% each" or
 *  "4 channelled hits at 130-150% each; at 4 Bloodlust, 170-190% each". */
function parseHitProse(text) {
  const match = /(\d+) (?:bleed |channelled )?hits? at (\d+)-(\d+)% each/.exec(String(text));
  return match ? { hits: Number(match[1]), range: [Number(match[2]), Number(match[3])] } : null;
}

/** Extracts the direct-damage range from "110-130% initial hit plus 6 bleed hits…". */
function parseInitialHit(text) {
  const match = /^(\d+)-(\d+)% initial hit/.exec(String(text).trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function auditRecord(style, entry, verifiedAt = "2026-07-24") {
  const category = CATEGORY_BY_AUDIT_TYPE[entry.type];
  if (!category) throw new Error(`Unknown audit type "${entry.type}" on ${entry.name}`);
  const adrenaline = entry.adrenaline_cost_percent != null
    ? { kind: "cost", percent: entry.adrenaline_cost_percent }
    : entry.adrenaline_delta_percent != null
      ? { kind: "gain", percent: entry.adrenaline_delta_percent }
      : category === "basic"
        ? { kind: "gain", percent: 9 }
        : undefined;
  const rangeSource = entry.damage_range_percent ?? entry.damage_per_hit_percent ?? entry.damage_percent;
  const range = rangeSource ? parseRange(rangeSource) : null;
  const notes = [];
  if (entry.name.startsWith("Greater ")) notes.push(`Upgrade of ${entry.name.slice(8)}`);
  for (const line of [entry.effect, ...(entry.effects ?? [])].filter(Boolean)) notes.push(line);
  if (entry.post_launch_patch) notes.push(`Post-launch patch ${entry.post_launch_patch}`);
  if (rangeSource && !range) notes.push(`Damage: ${rangeSource}`);

  const record = {
    id: `${style}:${kebab(entry.name)}`,
    name: entry.name.split(" / ")[0],
    style,
    category,
    level: entry.level,
    unlock: { type: "level", requirement: String(entry.level), regions: [] },
    sources: [
      { source: "runescape-wiki", url: entry.source_url, verifiedAt },
    ],
  };
  if (adrenaline) record.adrenaline = adrenaline;
  if (entry.cooldown_seconds != null) record.cooldownTicks = ticks(entry.cooldown_seconds);
  if (entry.channel_seconds != null) record.channelTicks = ticks(entry.channel_seconds);
  if (entry.hits != null) record.hits = entry.hits;
  if (range) record.damagePercent = range;
  if (entry.average_damage_percent != null) record.averageDamagePercent = entry.average_damage_percent;
  if (notes.length) record.displayDescription = notes.map((n) => n.replace(/\.$/, "")).join("; ");
  return record;
}

const MELEE_CATEGORY = {
  Attack: "basic",
  "Adaptive Strike": "basic",
  Rend: "basic",
  Dismember: "basic",
  Punish: "basic",
  "Chaos Roar": "basic",
  Slaughter: "enhanced",
  Massacre: "enhanced",
  Assault: "enhanced",
  Overpower: "ultimate",
  Berserk: "ultimate",
  "Meteor Strike": "ultimate",
};

const MELEE_BASIC_GAIN_OVERRIDE = { "Adaptive Strike": 12, Dismember: 0 };

function meleeAdrenaline(entry, category) {
  if (entry.adrenaline_cost_percent != null) return { kind: "cost", percent: entry.adrenaline_cost_percent };
  if (entry.adrenaline_gain_percent != null) return { kind: "gain", percent: entry.adrenaline_gain_percent };
  if (category === "basic") {
    return { kind: "gain", percent: MELEE_BASIC_GAIN_OVERRIDE[entry.name] ?? 9 };
  }
  return undefined;
}

function meleeRecord(entry) {
  const name = entry.name;
  const notes = [];
  const record = {
    id: `melee:${kebab(name)}`,
    name,
    style: "melee",
    category: MELEE_CATEGORY[name] ?? entry.type ?? "basic",
    level: entry.unlock_level ?? 1,
    unlock: entry.unlock_level != null
      ? { type: "level", requirement: String(entry.unlock_level), regions: [] }
      : { type: "level", requirement: "1", regions: [] },
    sources: [MODERNISATION_SOURCE],
  };
  const adrenaline = meleeAdrenaline(entry, record.category);
  if (adrenaline) record.adrenaline = adrenaline;
  if (entry.cooldown_seconds != null) record.cooldownTicks = ticks(entry.cooldown_seconds);
  if (entry.bloodlust_gain != null) notes.push(`+${entry.bloodlust_gain} Bloodlust`);
  if (entry.healing_percent != null) notes.push(`Heals ${entry.healing_percent}%`);
  if (entry.chain) notes.push(entry.chain);
  if (entry.movement) notes.push(entry.movement);
  if (entry.special_rule) notes.push(entry.special_rule);
  if (entry.summary) notes.push(entry.summary);
  if (entry.other) notes.push(entry.other);
  if (entry.duration_seconds != null) notes.push(`Lasts ${entry.duration_seconds}s`);
  if (entry.damage_multiplier != null) notes.push(`${entry.damage_multiplier}x damage`);
  if (entry.incoming_damage_multiplier != null)
    notes.push(`Takes ${entry.incoming_damage_multiplier}x incoming damage`);
  if (typeof entry.bloodlust === "string") notes.push(`Bloodlust: ${entry.bloodlust}`);
  if (entry.igneous_variant) notes.push(`Igneous variant: ${entry.igneous_variant}`);
  if (entry.two_handed) notes.push(`Two-handed: ${entry.two_handed}`);
  if (entry.dual_wield) notes.push(`Dual wield: ${entry.dual_wield}`);

  const damageText = entry.damage_percent ?? entry.damage;
  if (damageText) {
    const range = parseRange(damageText) ?? parseInitialHit(damageText);
    const prose = range ? null : parseHitProse(damageText);
    if (range) record.damagePercent = range;
    else if (prose) {
      record.hits = prose.hits;
      record.damagePercent = prose.range;
    }
    if (!range || damageText.includes("plus")) notes.push(`Damage: ${damageText}`);
  }
  if (notes.length) record.displayDescription = notes.map((n) => n.replace(/\.$/, "")).join("; ");
  return record;
}

const readJson = async (path) => JSON.parse(await readFile(join(ROOT, path), "utf8"));

const audit = await readJson("scraped-data/combat-ability-audit-2026-07-24.json");
const modernisation = await readJson("scraped-data/combat-2026.json");
const unlocks = await readJson("scraped-data/progression-unlocks.json");
const inventionPerks = await readJson("scraped-data/planner-expansions-invention-perks.json");
const majorUpgrades = await readJson("scraped-data/major-upgrades-by-region.json");
const quests = await readJson("data/league/quests.json");
const prayerCatalogue = await readJson("data/reference/prayers.json");
const regionalCombat = await readJson("data/research/regional-combat-unlocks.json");
const abilitySupplement = await readJson("scraped-data/combat-ability-supplement-2026-07-25.json");
const revolutionBars = await readJson("scraped-data/combat-revolution-bars-2026-07-25.json");

/** Joins sourced regional unlocks onto existing ability records. */
function applyAbilityRegionJoins(records) {
  const byName = new Map(records.map((r) => [r.name.toLowerCase(), r]));
  const joins = [];
  const stamp = (rec, unlock) => {
    const regions = [...new Set([...(rec.unlock?.regions ?? []), ...unlock.regions])];
    const requirement = rec.unlock?.requirement && rec.unlock.requirement !== unlock.requirement && rec.unlock.type !== "level"
      ? `${rec.unlock.requirement} / ${unlock.requirement}`
      : unlock.requirement;
    rec.unlock = { ...unlock, regions, requirement };
    joins.push(`${rec.id} <- ${unlock.type}: ${unlock.requirement} [${regions.join(", ") || "unresolved"}]`);
  };
  for (const pkg of unlocks.ability_unlocks ?? []) {
    for (const u of pkg.unlocks) {
      const rec = byName.get(u.name.toLowerCase());
      if (rec) stamp(rec, { type: "codex", requirement: u.source ?? pkg.name, regions: pkg.region_hint ? regionList(pkg.region_hint) : [] });
    }
  }
  for (const [region, entries] of Object.entries(majorUpgrades.regions)) {
    for (const e of entries) {
      if (!/abilit|codex/i.test(e.category)) continue;
      for (const ex of e.examples ?? []) {
        const rec = byName.get(ex.toLowerCase());
        if (rec) stamp(rec, { type: "codex", requirement: e.name, regions: regionList(region) });
      }
    }
  }
  const questRegion = new Map((quests.quests ?? []).map((q) => [q.title.toLowerCase(), q.primary_region]));
  for (const g of unlocks.quest_unlocks ?? []) {
    for (const e of g.unlocks) {
      if (e.type !== "ability") continue;
      const rec = byName.get(e.name.toLowerCase());
      const region = questRegion.get(g.quest.toLowerCase());
      if (rec) stamp(rec, { type: "quest", requirement: g.quest, regions: region ? regionList(region) : [] });
    }
  }
  return joins;
}

const REGION_ID_SET = new Set([
  "misthalin", "havenhythe", "karamja", "asgarnia", "kandarin", "fremennik",
  "forinthry", "desert", "morytania", "tirannwn", "anachronia",
]);
const regionList = (id) => {
  if (!REGION_ID_SET.has(id)) throw new Error(`Unknown region id in corpus: ${id}`);
  return [id];
};
const wikiSources = (urls, verifiedAt) =>
  (Array.isArray(urls) ? urls : [urls]).filter(Boolean).map((url) => ({
    source: "runescape-wiki",
    url,
    verifiedAt,
  }));

const abilities = [
  ...audit.magic.map((entry) => auditRecord("magic", entry)),
  ...audit.ranged.map((entry) => auditRecord("ranged", entry)),
  ...modernisation.melee.important_abilities_after_initial_patches.map(meleeRecord),
  ...(abilitySupplement.abilities ?? []).map((entry) => auditRecord(entry.style, entry, abilitySupplement.snapshot_date)),
];
const regionJoins = applyAbilityRegionJoins(abilities);

/** Prayers: the full catalogue from data/reference/prayers.json (46 standard, 45 ancient
 *  curses, 7 Seren), with the progression-unlocks codex overlay merged by name. Effects are
 *  the catalogue's own normalized text; levels stay absent where the catalogue has none. */
const BOOK_MAP = {
  "standard-prayers": { book: "standard", prefix: "prayer" },
  "ancient-curses": { book: "ancient", prefix: "curse" },
  "seren-prayers": { book: "seren", prefix: "seren" },
};
const prayers = [];
for (const bookEntry of prayerCatalogue.books ?? []) {
  const mapped = BOOK_MAP[bookEntry.id];
  if (!mapped) throw new Error(`Unknown prayer book ${bookEntry.id}`);
  for (const entry of bookEntry.prayers ?? []) {
    const regionless = entry.region_requirement_type === "no_region_requirement";
    prayers.push({
      id: `${mapped.prefix}:${kebab(entry.name)}`,
      name: entry.name,
      book: mapped.book,
      facts: [entry.category, entry.effect].filter(Boolean),
      unlock: {
        type: regionless ? "level" : "quest",
        requirement: entry.unlock_requirements?.[0] ?? entry.category,
        regions: regionless ? [] : (entry.required_regions ?? []).map((id) => regionList(id)[0]),
      },
      sources: wikiSources(prayerCatalogue.source_urls, prayerCatalogue.snapshot_date),
    });
  }
}
/** Codex overlay: progression-unlocks carries the drop unlock and explicit levels the
 *  catalogue lacks (Praesul codex, 99 Prayer). Merge by name, never duplicate. */
for (const group of unlocks.prayer_unlocks ?? []) {
  for (const entry of group.unlocks) {
    const record = prayers.find((p) => p.name.toLowerCase() === entry.name.toLowerCase());
    const facts = [];
    if (group.prerequisite) facts.push(`Requires ${group.prerequisite}`);
    if (entry.necromancy_requirement != null) facts.push(`Also requires ${entry.necromancy_requirement} Necromancy`);
    if (record) {
      record.level = entry.prayer_requirement;
      record.facts = [...new Set([...record.facts, ...facts])];
      record.unlock = {
        type: "drop",
        requirement: `${group.name} (${group.id.split(":")[0]})`,
        regions: record.unlock.regions.length ? record.unlock.regions : regionList(group.region_hint),
      };
    } else {
      prayers.push({
        id: `curse:${kebab(entry.name)}`,
        name: entry.name,
        book: "ancient",
        level: entry.prayer_requirement,
        facts,
        unlock: { type: "drop", requirement: `${group.name} (${group.id.split(":")[0]})`, regions: regionList(group.region_hint) },
        sources: wikiSources(group.source_urls, unlocks.snapshot_date),
      });
    }
  }
}

/** Perks: current PvME recipes. PvME is discovery-grade here, never numeric ground truth. */
const perks = (inventionPerks.current_armour_perk_recipes ?? []).map((entry) => {
  const rankMatch = /(\d+)$/.exec(entry.perk);
  return {
    id: `perk:${kebab(entry.perk.replace(/\s*\d+$/, ""))}`,
    name: entry.perk.replace(/\s*\d+$/, ""),
    maxRank: rankMatch ? Number(rankMatch[1]) : 1,
    facts: [
      entry.role,
      `Representative recipe: ${entry.representative_recipe.join(" + ")}`,
      entry.recipe_result,
      entry.planner_value,
    ].filter(Boolean),
    unlock: { type: "level", requirement: "Invention", regions: [] },
    sources: [{ source: "pvme", url: entry.source_url, verifiedAt: inventionPerks.snapshot_date }],
  };
});

/** Effects: named mechanics the corpus states explicitly ("Applies Flow"), plus Bloodlust. */
const effects = [];
for (const [style, list] of [["magic", audit.magic], ["ranged", audit.ranged]]) {
  for (const ability of list) {
    for (const line of [ability.effect, ...(ability.effects ?? [])].filter(Boolean)) {
      const match = /^Applies ([A-Z][A-Za-z ]+?)(?: for (\d+(?:\.\d+)?) seconds)?$/.exec(line);
      if (!match) continue;
      const name = match[1];
      const facts = [line];
      const followup = (ability.effects ?? []).find((l) => l !== line && l.includes(name));
      if (followup) facts.push(followup);
      effects.push({
        id: `${style}:${kebab(name)}`,
        name,
        kind: "buff",
        facts,
        sources: wikiSources(ability.source_url, audit.snapshot_date),
      });
    }
  }
}
effects.push({
  id: "melee:bloodlust",
  name: "Bloodlust",
  kind: "buff",
  facts: [
    `Normal cap ${modernisation.melee.bloodlust.normal_max_stacks} stacks`,
    `Berserk cap ${modernisation.melee.bloodlust.berserk_max_stacks} stacks`,
    modernisation.melee.bloodlust.summary,
  ],
  sources: [MODERNISATION_SOURCE],
});

/** Regional account/activity passives from the composed regional combat unlocks feed. */
for (const record of regionalCombat.records ?? []) {
  if (record.recordType === "equipment") continue;
  effects.push({
    id: `passive:${kebab(record.name)}`,
    name: record.name,
    kind: "passive",
    facts: [record.category, record.detail].filter(Boolean),
    unlock: {
      type: "activity",
      requirement: record.name,
      regions: (record.requiredRegions ?? []).map((id) => regionList(id)[0]),
    },
    sources: [record.source],
  });
}

/** Equipment: region-tagged unlock records from major upgrades. No sourced stats exist in
 *  the corpus yet, so bonuses stay empty and slot/tier appear only when the entry states them. */
const COMBAT_CATEGORY = /weapon|armour|cape|boots|gloves|scripture|amulet|ring|combat gear|combat uniques|combat upgrades/i;
const SLOT_KEYWORDS = [
  [/cape/i, "cape"], [/boots/i, "boots"], [/gloves/i, "gloves"],
  [/amulet/i, "amulet"], [/scripture/i, "pocket"], [/ring/i, "ring"],
];
const STYLE_KEYWORDS = [
  [/melee/i, "melee"], [/ranged/i, "ranged"], [/magic/i, "magic"], [/necromancy/i, "necromancy"],
];
const equipment = [];
for (const [region, entries] of Object.entries(majorUpgrades.regions)) {
  for (const entry of entries) {
    if (!COMBAT_CATEGORY.test(entry.category) || !entry.source_url) continue;
    for (const itemName of entry.examples ?? []) {
      const tierMatch = /tier[ -](\d+)/i.exec(`${entry.category} ${itemName}`);
      const slot = SLOT_KEYWORDS.find(([re]) => re.test(itemName))?.[1];
      const style = STYLE_KEYWORDS.find(([re]) => re.test(entry.category))?.[1];
      equipment.push({
        id: `item:${kebab(itemName)}`,
        name: itemName,
        slot,
        tier: tierMatch ? Number(tierMatch[1]) : undefined,
        style,
        bonuses: {},
        unlock: { type: "drop", requirement: entry.name, regions: regionList(region) },
        sources: wikiSources(entry.source_url, majorUpgrades.snapshot_date ?? VERIFIED_AT),
        displayDescription: entry.notes ?? entry.category,
      });
    }
  }
}
for (const model of unlocks.equipment_models ?? []) {
  equipment.push({
    id: `item:${kebab(model.name.split(" stored")[0])}`,
    name: model.name.split(" stored")[0],
    slot: /amulet/i.test(model.source_url) ? "amulet" : undefined,
    bonuses: {},
    sources: wikiSources(model.source_url, unlocks.snapshot_date),
    displayDescription: model.rules.join("; "),
  });
}
/** Regional combat equipment (salve amulet (e) and kin) from the composed feed. */
for (const record of regionalCombat.records ?? []) {
  if (record.recordType !== "equipment") continue;
  equipment.push({
    id: `item:${kebab(record.name)}`,
    name: record.name,
    slot: /amulet/i.test(record.name) ? "amulet" : undefined,
    bonuses: {},
    unlock: {
      type: "quest",
      requirement: (record.requirements ?? []).join("; ") || record.detail,
      regions: (record.requiredRegions ?? []).map((id) => regionList(id)[0]),
    },
    sources: [record.source],
    displayDescription: record.detail,
  });
}

/** Revolution++ bars: wiki slot names mapped to our record ids at build time; an
 *  unmapped name means no sourced record exists and the slot is unmodelled. */
const RECORD_ID_BY_WIKI_NAME = new Map(abilities.map((r) => [r.name.toLowerCase(), r.id]));
const ENGINE_SLOT_IDS = {
  "attack (ability)": "attack",
  "ranged (ability)": "ranged_attack",
  "magic (ability)": "magic_attack",
  "necromancy (ability)": "necromancy_basic",
  "volley of souls": "volley_of_souls",
};
const barRecords = (revolutionBars.bars ?? []).map((bar) => ({
  id: bar.id,
  style: bar.style,
  setup: bar.setup,
  revolutionSize: bar.revolution_size,
  slots: bar.slots.map((name) => {
    const recordId = RECORD_ID_BY_WIKI_NAME.get(name.toLowerCase()) ?? ENGINE_SLOT_IDS[name.toLowerCase()] ?? null;
    return { name, abilityId: recordId };
  }),
  replacements: bar.replacements ?? [],
  supported: bar.supported ?? true,
  unsupportedReason: bar.unsupported_reason,
  sources: wikiSources([revolutionBars.source.url, revolutionBars.source.parent_url], revolutionBars.snapshot_date),
}));

const datasets = { abilities, equipment, prayers, perks, effects, "revolution-bars": barRecords };
for (const [kind, records] of Object.entries(datasets)) {
  const seen = new Set();
  const clean = records.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  for (const record of clean) {
    if (!record.sources?.length) throw new Error(`${kind}:${record.id} has no SourceReference`);
  }
  const dataset = { lastSynced: VERIFIED_AT, trackedSince: "2024-03-04", records: clean };
  await writeFile(join(ROOT, `data/combat/${kind}.json`), `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(`${kind}: ${clean.length} records${clean.length !== records.length ? ` (${records.length - clean.length} duplicate ids dropped)` : ""}`);
}
console.log("COMBAT RECORDS SYNC complete -> data/combat/");
console.log(`ability region joins: ${regionJoins.length}`);
for (const join of regionJoins) console.log(`  ${join}`);
