import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Integrity audit for the canonical combat store (data/combat/*.json).
 * Enforces the data-sync provenance contract: unique stable ids, a usable
 * SourceReference on every record, valid League region tags, enum sanity.
 * Exits non-zero on any failure. Run: node scripts/audit-combat-data.mjs
 */

const ROOT = process.cwd();
const readJson = async (path) => JSON.parse(await readFile(join(ROOT, path), "utf8"));

const SOURCE_KINDS = new Set(["runescape-wiki", "jagex", "rs-analysis", "pvme", "derived"]);
const ABILITY_CATEGORIES = new Set(["basic", "enhanced", "ultimate", "utility"]);
const COMBAT_STYLES = new Set(["melee", "ranged", "magic", "necromancy"]);
const EQUIPMENT_SLOTS = new Set([
  "mainhand", "offhand", "twohand", "helmet", "body", "legs", "gloves", "boots",
  "cape", "amulet", "ring", "pocket", "ammo", "aura",
]);
const EFFECT_KINDS = new Set(["passive", "set-bonus", "special-attack", "buff", "debuff", "prayer-effect", "perk-effect"]);
const PRAYER_BOOKS = new Set(["standard", "ancient"]);
const ID_PATTERN = /^[a-z]+:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

function auditSources(record, kind) {
  check(Array.isArray(record.sources) && record.sources.length > 0, `${kind}:${record.id} has no SourceReference`);
  for (const source of record.sources ?? []) {
    check(SOURCE_KINDS.has(source.source), `${kind}:${record.id} unknown source kind "${source.source}"`);
    check(typeof source.url === "string" && source.url.startsWith("https://"), `${kind}:${record.id} non-https source url`);
    check(DATE_PATTERN.test(source.verifiedAt ?? ""), `${kind}:${record.id} source missing verifiedAt date`);
  }
}

function auditBase(record, kind, regionIds) {
  check(ID_PATTERN.test(record.id ?? ""), `${kind}: bad id "${record.id}"`);
  check(typeof record.name === "string" && record.name.length > 0, `${kind}:${record.id} empty name`);
  auditSources(record, kind);
  for (const region of record.unlock?.regions ?? []) {
    check(regionIds.has(region), `${kind}:${record.id} tags unknown region "${region}"`);
  }
}

const regions = await readJson("data/league/regions.json");
const regionIds = new Set(regions.records.map((record) => record.id));

const datasets = {
  abilities: await readJson("data/combat/abilities.json"),
  equipment: await readJson("data/combat/equipment.json"),
  prayers: await readJson("data/combat/prayers.json"),
  perks: await readJson("data/combat/perks.json"),
  effects: await readJson("data/combat/effects.json"),
};

for (const [kind, dataset] of Object.entries(datasets)) {
  check(dataset.trackedSince === "2024-03-04", `${kind}: envelope trackedSince drifted`);
  check(DATE_PATTERN.test(dataset.lastSynced ?? ""), `${kind}: envelope lastSynced missing`);
  check(Array.isArray(dataset.records) && dataset.records.length > 0, `${kind}: zero records`);
  const seen = new Set();
  for (const record of dataset.records) {
    check(!seen.has(record.id), `${kind}: duplicate id "${record.id}"`);
    seen.add(record.id);
    auditBase(record, kind, regionIds);
  }
}

for (const record of datasets.abilities.records) {
  check(ABILITY_CATEGORIES.has(record.category), `abilities:${record.id} bad category "${record.category}"`);
  check(COMBAT_STYLES.has(record.style), `abilities:${record.id} bad style "${record.style}"`);
  check(record.adrenaline?.percent >= 0, `abilities:${record.id} negative adrenaline`);
  if (record.damagePercent) {
    check(record.damagePercent[0] <= record.damagePercent[1], `abilities:${record.id} inverted damage range`);
  }
}
const effectIds = new Set(datasets.effects.records.map((record) => record.id));
for (const record of datasets.abilities.records) {
  for (const effectId of record.effects ?? []) {
    check(effectIds.has(effectId), `abilities:${record.id} references missing effect "${effectId}"`);
  }
}
for (const record of datasets.equipment.records) {
  if (record.slot != null) check(EQUIPMENT_SLOTS.has(record.slot), `equipment:${record.id} bad slot "${record.slot}"`);
  if (record.tier != null) check(record.tier >= 1 && record.tier <= 99, `equipment:${record.id} implausible tier ${record.tier}`);
}
for (const record of datasets.effects.records) {
  check(EFFECT_KINDS.has(record.kind), `effects:${record.id} bad kind "${record.kind}"`);
  check(Array.isArray(record.facts) && record.facts.length > 0, `effects:${record.id} no facts`);
}
for (const record of datasets.perks.records) {
  check(record.maxRank >= 1, `perks:${record.id} maxRank < 1`);
  check(Array.isArray(record.facts) && record.facts.length > 0, `perks:${record.id} no facts`);
}
for (const record of datasets.prayers.records) {
  check(PRAYER_BOOKS.has(record.book), `prayers:${record.id} bad book "${record.book}"`);
  if (record.level != null) check(record.level >= 1 && record.level <= 99, `prayers:${record.id} implausible level ${record.level}`);
}

const counts = Object.entries(datasets)
  .map(([kind, dataset]) => `${kind} ${dataset.records.length}`)
  .join(", ");
if (failures.length) {
  console.error(`COMBAT DATA AUDIT FAILED — ${failures.length} problem(s) [${counts}]`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`COMBAT DATA AUDIT OK [${counts}] — provenance, ids, regions, enums verified`);
}
