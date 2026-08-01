import { EXPORT_VERSION, REGION_IDS } from "./config.mjs";
import { prepared } from "./database.mjs";
import { asArray, hash, jsonLine, stableJson } from "./utilities.mjs";

// Research rows were authored across several passes with different key names.
// A hard requirement wins outright; otherwise the record's host region, or its
// ID prefix, decides which region panel shows it.
const HARD_REGION_KEYS = [
  "requiredRegions",
  "required_regions",
  "required_region",
  "required_regions_for_collection_loop",
];
const HOST_REGION_KEYS = [
  "region",
  "regionId",
  "region_hint",
  "region_hints",
  "regionHints",
  "regions",
  "working_region",
  "geographic_region",
  "acquisition_region",
  "acquisition_regions",
  "collector_region",
  "collector_regions",
];
// ID prefixes that name a domain rather than a place.
const NON_REGION_ID_PREFIXES = new Set([
  "invention",
  "crossregion",
  "cross-region",
  "multiregion",
  "multi-region",
  "global",
  "combat",
  "boss",
  "item",
  "prifddinas",
]);

const UNLOCK_SECTIONS = [
  "quest_unlocks",
  "ability_unlocks",
  "prayer_unlocks",
  "account_unlocks",
  "activity_unlocks",
  "equipment_models",
  "consumable_unlocks",
];
// Later passes added these without merging them back into the base document.
const EQUIPMENT_MODEL_SUPPLEMENTS = [
  "data/reference/progression-support-items-2026-07-25.json",
  "data/reference/progression-container-bags-2026-07-25.json",
];

function collectRegionScope(value, out) {
  if (typeof value === "string" && value.trim()) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectRegionScope(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectRegionScope(item, out));
}

const normalizeRegionScope = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function rowMatchesRegion(row, region) {
  if (row.region_requirement_type === "no_region_requirement") return true;
  const aliases = [region.id, region.name, ...asArray(region.aliases)].map(normalizeRegionScope).filter(Boolean);
  const matches = (scope) => {
    const normalized = scope.map(normalizeRegionScope).filter(Boolean);
    const concrete = normalized.filter(
      (value) => !value.includes("global") && !value.includes("allregions") && !value.includes("anyregion"),
    );
    if (!concrete.length) return normalized.length > 0;
    return concrete.some((value) => aliases.some((alias) => value.includes(alias) || alias.includes(value)));
  };
  const hard = [];
  HARD_REGION_KEYS.forEach((key) => collectRegionScope(row[key], hard));
  if (hard.length) return matches(hard);
  const host = [];
  HOST_REGION_KEYS.forEach((key) => collectRegionScope(row[key], host));
  if (typeof row.id === "string" && row.id.includes(":")) {
    const prefix = row.id.split(":", 1)[0];
    const normalized = normalizeRegionScope(prefix);
    if (normalized && !NON_REGION_ID_PREFIXES.has(normalized) && !NON_REGION_ID_PREFIXES.has(prefix)) host.push(prefix);
  }
  return matches(host);
}

// Panels render source rows, but a row whose entity was retired as a duplicate
// is the same record the survivor already shows. Joining through
// source_records.entity_id is what lets an adjudication reach these panels; a
// row that never became an entity has no survivor to defer to and stays.
function sourceSection(db, file, section) {
  const pattern = new RegExp(`^\\$\\.${section}\\[\\d+\\]$`);
  return prepared(
    db,
    `SELECT source_records.record_path, source_records.raw_json
     FROM source_records
     LEFT JOIN entities ON entities.id = source_records.entity_id
     WHERE source_records.source_file = ?
       AND (source_records.entity_id IS NULL OR entities.status <> 'removed')
     ORDER BY source_records.record_path`,
  )
    .all(file)
    .filter(({ record_path }) => pattern.test(record_path))
    .sort(
      (a, b) =>
        Number(a.record_path.match(/\[(\d+)\]$/)?.[1] ?? 0) - Number(b.record_path.match(/\[(\d+)\]$/)?.[1] ?? 0),
    )
    .map(({ raw_json }) => JSON.parse(raw_json));
}

// Supplements can restate a base row; the first stable key wins so a record
// never appears twice in one panel.
function rowKey(row, index, prefix) {
  if (row.id != null && row.id !== "") return String(row.id);
  if (typeof row.name === "string" && row.name) return `${prefix}:${row.name}`;
  if (typeof row.quest === "string" && row.quest) return `${prefix}:${row.quest}`;
  return `${prefix}:${index}`;
}

function researchPanels(db, region) {
  const skilling = sourceSection(db, "data/research/regional-skilling-unlocks.json", "records");
  const combat = sourceSection(db, "data/research/regional-combat-unlocks.json", "records");
  const inRegion = (rows, recordType) =>
    rows.filter((row) => row.recordType === recordType && rowMatchesRegion(row, region));
  const regional = {
    skillingActivities: inRegion(skilling, "activity"),
    skillingEquipment: inRegion(skilling, "equipment"),
    combatAccounts: inRegion(combat, "account"),
    combatActivities: inRegion(combat, "activity"),
    combatEquipment: inRegion(combat, "equipment"),
  };
  const unlocks = {};
  for (const section of UNLOCK_SECTIONS) {
    const rows = new Map();
    sourceSection(db, "data/reference/progression-unlocks.json", section).forEach((row, index) =>
      rows.set(rowKey(row, index, "base"), row),
    );
    if (section === "equipment_models") {
      EQUIPMENT_MODEL_SUPPLEMENTS.forEach((file) =>
        sourceSection(db, file, section).forEach((row, index) => rows.set(rowKey(row, index, "supplement"), row)),
      );
    }
    unlocks[section] = [...rows.values()].filter((row) => rowMatchesRegion(row, region));
  }
  return { regional, unlocks };
}

// Reconstructs the catalog document shape from relational tables. Export refuses
// to ship unless this matches the shipped shards exactly, so it is also the parity source.
export function readResearchCatalog(db) {
  const metadata = db.prepare("SELECT * FROM research_catalog WHERE id = 1").get();
  if (!metadata) throw new Error("Normalized research catalog is missing");
  const regions = REGION_IDS.map((regionId) => {
    const row = prepared(
      db,
      `SELECT regions.entity_id, regions.name, regions.availability, regions.verified,
              research_regions.areas_json, research_regions.hard_rules_json,
              research_regions.warnings_json, research_regions.source_json,
              entities.extra_json
       FROM research_regions
       JOIN regions ON regions.id = research_regions.region_id
       JOIN entities ON entities.id = regions.entity_id
       WHERE research_regions.region_id = ?`,
    ).get(regionId);
    if (!row) throw new Error(`Normalized research region is missing: ${regionId}`);
    const base = JSON.parse(row.extra_json);
    const entries = (section) =>
      prepared(
        db,
        `SELECT entities.extra_json
         FROM research_region_entries
         JOIN entities ON entities.id = research_region_entries.entity_id
         WHERE research_region_entries.region_id = ? AND research_region_entries.section = ?
         ORDER BY research_region_entries.ordinal`,
      )
        .all(regionId, section)
        .map(({ extra_json }) => JSON.parse(extra_json));
    return {
      id: regionId,
      name: row.name,
      availability: row.availability,
      aliases: asArray(base.aliases),
      areas: JSON.parse(row.areas_json),
      skills: prepared(
        db,
        `SELECT entities.name
         FROM research_region_skills
         JOIN entities ON entities.id = research_region_skills.skill_entity_id
         WHERE research_region_skills.region_id = ? ORDER BY research_region_skills.ordinal`,
      )
        .all(regionId)
        .map(({ name }) => name),
      content: entries("content"),
      upgrades: entries("upgrades"),
      trainingMethodIds: prepared(
        db,
        `SELECT method_entity_id AS id FROM research_region_training
         WHERE region_id = ? ORDER BY ordinal`,
      )
        .all(regionId)
        .map(({ id }) => id),
      hardRules: JSON.parse(row.hard_rules_json),
      warnings: JSON.parse(row.warnings_json),
      source: JSON.parse(row.source_json),
      verified: Boolean(row.verified),
    };
  });
  const skills = prepared(
    db,
    `SELECT entities.id, entities.extra_json
     FROM entities
     WHERE entities.entity_type = 'skill'
       AND EXISTS (SELECT 1 FROM research_skill_methods WHERE skill_entity_id = entities.id)
     ORDER BY entities.id`,
  )
    .all()
    .map(({ id, extra_json }) => ({
      ...JSON.parse(extra_json),
      methods: prepared(
        db,
        `SELECT entities.extra_json
         FROM research_skill_methods
         JOIN entities ON entities.id = research_skill_methods.method_entity_id
         WHERE research_skill_methods.skill_entity_id = ? ORDER BY research_skill_methods.ordinal`,
      )
        .all(id)
        .map(({ extra_json: method }) => JSON.parse(method)),
    }));
  return {
    snapshotDate: metadata.snapshot_date,
    sourcePolicy: JSON.parse(metadata.source_policy_json),
    coverage: JSON.parse(metadata.coverage_json),
    hardRules: JSON.parse(metadata.hard_rules_json),
    datasets: JSON.parse(metadata.datasets_json),
    regions,
    skills,
  };
}

const methodsById = (skills) =>
  new Map(asArray(skills).flatMap((skill) => asArray(skill.methods).map((method) => [method.id, method])));

export function researchExport(db) {
  const catalog = readResearchCatalog(db);
  const { regions, skills } = catalog;
  const methods = methodsById(skills);
  const outputs = new Map();
  const regionIndex = [];
  for (const region of regions) {
    const { trainingMethodIds = [], ...base } = region;
    const panels = researchPanels(db, base);
    const regionalPath = `research/panels/regional/${region.id}.json`;
    const regionalBody = jsonLine({ schemaVersion: EXPORT_VERSION, region: region.id, ...panels.regional });
    outputs.set(regionalPath, regionalBody);
    const unlocks = {};
    const unlockManifest = {};
    for (const [section, records] of Object.entries(panels.unlocks)) {
      const path = `research/panels/unlocks/${region.id}/${section}.json`;
      const panelBody = jsonLine({ schemaVersion: EXPORT_VERSION, region: region.id, section, records });
      outputs.set(path, panelBody);
      unlocks[section] = `/data/v2/${path}`;
      unlockManifest[section] = {
        href: unlocks[section],
        bytes: Buffer.byteLength(panelBody),
        sha256: hash(panelBody),
        records: records.length,
      };
    }
    const body = jsonLine({
      ...base,
      training: trainingMethodIds.map((id) => methods.get(id)).filter(Boolean),
      panelHrefs: { regional: `/data/v2/${regionalPath}`, unlocks },
    });
    const path = `research/regions/${region.id}.json`;
    outputs.set(path, body);
    regionIndex.push({
      id: region.id,
      name: region.name,
      availability: region.availability,
      training: trainingMethodIds.length,
      href: `/data/v2/${path}`,
      bytes: Buffer.byteLength(body),
      sha256: hash(body),
      panels: {
        regional: {
          href: `/data/v2/${regionalPath}`,
          bytes: Buffer.byteLength(regionalBody),
          sha256: hash(regionalBody),
          records: Object.values(panels.regional).reduce((sum, rows) => sum + rows.length, 0),
        },
        unlocks: unlockManifest,
      },
    });
  }
  const index = {
    schemaVersion: EXPORT_VERSION,
    snapshotDate: catalog.snapshotDate,
    regions: regionIndex,
    skills: skills.map(({ id, name }) => ({ id, name })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  outputs.set("research/index.json", jsonLine(index));
  return { outputs, index };
}

export function researchParity(db, outputs) {
  const catalog = readResearchCatalog(db);
  const methods = methodsById(catalog.skills);
  const regions = [];
  for (const region of REGION_IDS) {
    const source = asArray(catalog.regions).find(({ id }) => id === region);
    const nextBody = outputs.get(`research/regions/${region}.json`);
    if (!source || !nextBody) {
      regions.push({ region, equal: false, reason: "missing shard" });
      continue;
    }
    const { trainingMethodIds = [], ...base } = source;
    const expected = { ...base, training: trainingMethodIds.map((id) => methods.get(id)).filter(Boolean) };
    const newValue = JSON.parse(nextBody);
    // panelHrefs are export-only addressing, not source content.
    const comparable = { ...newValue };
    delete comparable.panelHrefs;
    regions.push({
      region,
      equal: stableJson(expected) === stableJson(comparable),
      sourceHash: hash(stableJson(expected)),
      newHash: hash(stableJson(comparable)),
      sourceTraining: expected.training.length,
      newTraining: newValue.training?.length ?? 0,
    });
  }
  return regions;
}
