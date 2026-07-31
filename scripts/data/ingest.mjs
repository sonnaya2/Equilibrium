import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  DOCUMENTS_PREFIX,
  DOCUMENT_EXTRA_CONSUMERS,
  DOCUMENT_SKIP,
  REGION_IDS,
  ROOT,
  SEED,
  TRANSFORM_BY_NAME,
} from "./config.mjs";
import { prepared, recordTransform, requireEntity, transaction } from "./database.mjs";
import {
  addDomainRow,
  addEffects,
  addRegions,
  addRequirements,
  addTags,
  entityCandidate,
  entityFields,
  insertEntity,
  linkSource,
  normalizeRegion,
  sourceObjects,
} from "./normalize.mjs";
import { asArray, hash, scalar, slash, slugify, stableJson, walkFiles } from "./utilities.mjs";

// Documents keep their original role so provenance survives consolidation:
// overlays and evidence files are not treated as primary seed content.
function fileClassification(file) {
  if (file.startsWith("data/research/planner-") || /regional-|region-combos|equipment-region-index/.test(file)) {
    return "snapshot-overlay";
  }
  if (/audit|review|unknowns|update-index/.test(file)) return "reference-evidence";
  if (file.startsWith("data/map/")) return "map-source";
  return "seed-content";
}

// File-level metadata is kept only where it stays small; large nested blobs
// belong to the records that own them.
function compactMetadata(value) {
  const metadata = {};
  for (const [key, child] of Object.entries(value ?? {})) {
    if (child == null || ["string", "number", "boolean"].includes(typeof child)) metadata[key] = child;
    else if (Array.isArray(child) && child.every((item) => item == null || typeof item !== "object")) {
      metadata[key] = child;
    } else if (child && !Array.isArray(child) && typeof child === "object") {
      const body = stableJson(child);
      if (Buffer.byteLength(body) <= 4096) metadata[key] = child;
    }
  }
  return metadata;
}

// Every object inside an array is a candidate record, at any depth, tagged with
// the JSON path that can write it back into the compatibility document and with
// the nearest enclosing record, which is sometimes the only thing that tells
// two same-named records apart.
function collectArrayRecords(value, path = "$", key = "root", parent = null, records = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        const recordPath = `${path}[${index}]`;
        records.push({ row: child, path: recordPath, key, parent });
        collectArrayRecords(child, recordPath, key, child, records);
      }
    });
    return records;
  }
  if (!value || typeof value !== "object") return records;
  for (const [childKey, child] of Object.entries(value)) {
    collectArrayRecords(child, `${path}.${childKey}`, childKey, parent, records);
  }
  return records;
}

export function seedDocuments() {
  if (!existsSync(SEED)) throw new Error("Data seed is missing: data/seed-v1.json.gz");
  let seed;
  try {
    seed = JSON.parse(gunzipSync(readFileSync(SEED)));
  } catch (error) {
    throw new Error(`Invalid data seed: ${error.message}`);
  }
  if (seed.schemaVersion !== 1 || !Array.isArray(seed.files) || seed.files.length === 0) {
    throw new Error("Unsupported or empty data seed");
  }
  const paths = new Set();
  return seed.files.map((entry) => {
    const file = slash(entry.path ?? "");
    if (!/^data\/[a-z0-9/_-]+\.json$/i.test(file) || paths.has(file)) {
      throw new Error(`Invalid or duplicate seed path: ${file}`);
    }
    paths.add(file);
    const text = stableJson(entry.data);
    return { file, text, data: entry.data, records: collectArrayRecords(entry.data) };
  });
}

function setRecordAtPath(document, recordPath, value) {
  const tokens = [...recordPath.matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map((match) =>
    match[1] === undefined ? Number(match[2]) : match[1],
  );
  let target = document;
  for (const token of tokens.slice(0, -1)) target = target[token];
  target[tokens.at(-1)] = value;
}

// A document is only worth writing if something loads it. Everything else is
// reachable through the database or the bounded shards, so emitting it would
// just park a copy of the seed in the deploy.
function documentConsumers() {
  const wanted = new Set(DOCUMENT_EXTRA_CONSUMERS);
  for (const path of walkFiles(join(ROOT, "app"), (file) => /\.tsx?$/.test(file)).concat(
    walkFiles(join(ROOT, "src"), (file) => /\.tsx?$/.test(file)),
  )) {
    for (const match of readFileSync(path, "utf8").matchAll(/#shard\/([a-zA-Z0-9/_.-]+\.json)/g)) {
      wanted.add(match[1]);
    }
  }
  return wanted;
}

// Replays normalized records back over the seed shape for the modules that load
// a whole document. The research catalog is excluded — it is served from
// relational tables instead. Returned as export outputs so the same byte
// comparison and stale sweep covers them.
export function documentOutputs(db) {
  const wanted = documentConsumers();
  const documents = seedDocuments().filter(
    // data/combat/equipment.json -> combat/equipment.json
    ({ file }) => !DOCUMENT_SKIP.has(file) && wanted.has(file.slice("data/".length)),
  );
  const missing = [...wanted].filter(
    (name) => !documents.some(({ file }) => file === `data/${name}`),
  );
  if (missing.length) {
    throw new Error(`#shard imports name documents the seed does not contain: ${missing.join(", ")}`);
  }
  const byFile = new Map(documents.map((document) => [document.file, document]));
  for (const row of prepared(
    db,
    "SELECT source_file, record_path, raw_json FROM source_records ORDER BY source_file, record_path",
  ).all()) {
    const document = byFile.get(row.source_file);
    if (!document) continue;
    setRecordAtPath(document.data, row.record_path, JSON.parse(row.raw_json));
  }
  return new Map(
    documents.map((document) => [
      `${DOCUMENTS_PREFIX}/${document.file.slice("data/".length)}`,
      `${stableJson(document.data)}\n`,
    ]),
  );
}

function seedRegions(db, documents) {
  const regionDocument = documents.find(({ file }) => file === "data/league/regions.json");
  if (!regionDocument) throw new Error("Missing data/league/regions.json");
  const rows = regionDocument.data.records ?? [];
  if (rows.length !== REGION_IDS.length) {
    throw new Error(`Expected ${REGION_IDS.length} canonical regions, got ${rows.length}`);
  }
  rows.forEach((row, index) => {
    const id = normalizeRegion(row.id);
    if (!id || id === "global") throw new Error(`Unknown canonical region: ${row.id}`);
    const entityId = `region:${id}`;
    prepared(
      db,
      `INSERT INTO entities
       (id, slug, entity_type, name, short_description, detailed_description, verified_at,
        status, sort_key, created_source, updated_source, extra_json)
       VALUES (?, ?, 'region', ?, '', '', ?, 'active', ?, ?, ?, ?)`,
    ).run(
      entityId,
      slugify(entityId),
      row.name,
      row.source?.verifiedAt ?? null,
      String(index).padStart(2, "0"),
      regionDocument.file,
      regionDocument.file,
      stableJson(row),
    );
    prepared(
      db,
      "INSERT INTO regions(id, entity_id, name, availability, verified, taxonomy_order) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, entityId, row.name, scalar(row.availability, "unknown"), row.verified ? 1 : 0, index);
    asArray(row.aliases).forEach((alias) => {
      if (typeof alias === "string" && alias.trim()) {
        prepared(db, "INSERT OR IGNORE INTO aliases(entity_id, alias, kind) VALUES (?, ?, 'region')").run(
          entityId,
          alias.trim(),
        );
      }
    });
    sourceObjects(row).forEach((source, ordinal) =>
      linkSource(db, entityId, source, ordinal, { file: regionDocument.file, path: `$.records[${index}]`, row }),
    );
  });
  // Records that apply everywhere hang off a synthetic global region.
  db.prepare(
    `INSERT INTO entities
     (id, slug, entity_type, name, status, sort_key, created_source, updated_source)
     VALUES ('region:global', 'region-global', 'region', 'Global', 'active', '99', 'schema', 'schema')`,
  ).run();
  db.prepare(
    "INSERT INTO regions(id, entity_id, name, availability, verified, taxonomy_order) VALUES ('global', 'region:global', 'Global', 'global', 1, 99)",
  ).run();
}

function addMapPoints(db, documents) {
  const seeds = documents.find(({ file }) => file === "data/map/region-seeds.json")?.data?.seeds ?? {};
  for (const region of Object.keys(seeds).sort()) {
    const regionId = normalizeRegion(region);
    if (!regionId) continue;
    asArray(seeds[region]).forEach((point, index) => {
      if (!Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite)) return;
      prepared(
        db,
        `INSERT INTO map_points(id, region_id, label, x, y, z, point_type, extra_json)
         VALUES (?, ?, ?, ?, ?, ?, 'region-seed', '{}')`,
      ).run(
        `map:${regionId}:seed:${String(index + 1).padStart(3, "0")}`,
        regionId,
        `${regionId} seed ${index + 1}`,
        point[0],
        point[1],
        Number.isFinite(point[2]) ? point[2] : null,
      );
    });
  }
}

// Prerequisites are stored as free text. Only an unambiguous single name match
// becomes a relationship; anything else stays text so nothing is invented.
function resolveRelationships(db, imported) {
  const byName = new Map();
  for (const row of db.prepare("SELECT id, name FROM entities ORDER BY id").all()) {
    const key = row.name.toLocaleLowerCase("en");
    const values = byName.get(key) ?? [];
    values.push(row.id);
    byName.set(key, values);
  }
  for (const { entityId, row } of imported) {
    for (const [ordinal, name] of asArray(row.direct_prerequisites).entries()) {
      if (typeof name !== "string") continue;
      const matches = byName.get(name.toLocaleLowerCase("en")) ?? [];
      if (matches.length === 1) {
        prepared(
          db,
          "INSERT OR IGNORE INTO relationships(subject_id, predicate, object_id, ordinal) VALUES (?, 'requires', ?, ?)",
        ).run(entityId, matches[0], ordinal);
      }
    }
  }
}

function importResearchCatalog(db, documents) {
  const catalog = documents.find(({ file }) => file === "data/research/catalog.json")?.data;
  if (!catalog) throw new Error("Research catalog is missing from the seed");

  prepared(
    db,
    `INSERT INTO research_catalog
     (id, snapshot_date, source_policy_json, coverage_json, hard_rules_json, datasets_json)
     VALUES (1, ?, ?, ?, ?, ?)`,
  ).run(
    scalar(catalog.snapshotDate),
    stableJson(catalog.sourcePolicy ?? {}),
    stableJson(catalog.coverage ?? {}),
    stableJson(asArray(catalog.hardRules)),
    stableJson(catalog.datasets ?? {}),
  );

  const sourceEntity = db.prepare(
    "SELECT entity_id FROM source_records WHERE source_file = 'data/research/catalog.json' AND record_path = ?",
  );
  const entityAt = (path) => {
    const entityId = sourceEntity.get(path)?.entity_id;
    if (!entityId) throw new Error(`Research catalog record has no normalized entity: ${path}`);
    return entityId;
  };

  asArray(catalog.regions).forEach((region, regionIndex) => {
    const regionId = normalizeRegion(region.id);
    if (!regionId) throw new Error(`Research catalog has unknown region: ${region.id}`);
    prepared(
      db,
      `INSERT INTO research_regions
       (region_id, ordinal, areas_json, hard_rules_json, warnings_json, source_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      regionId,
      regionIndex,
      stableJson(asArray(region.areas)),
      stableJson(asArray(region.hardRules)),
      stableJson(asArray(region.warnings)),
      stableJson(region.source ?? null),
    );

    for (const section of ["content", "upgrades"]) {
      asArray(region[section]).forEach((_, ordinal) => {
        prepared(
          db,
          "INSERT INTO research_region_entries(region_id, entity_id, section, ordinal) VALUES (?, ?, ?, ?)",
        ).run(regionId, entityAt(`$.regions[${regionIndex}].${section}[${ordinal}]`), section, ordinal);
      });
    }

    asArray(region.skills).forEach((skill, ordinal) => {
      const entityId = `skill:${slugify(skill)}`;
      requireEntity(db, entityId, `research region ${regionId}`);
      prepared(db, "INSERT INTO research_region_skills(region_id, skill_entity_id, ordinal) VALUES (?, ?, ?)").run(
        regionId,
        entityId,
        ordinal,
      );
    });

    asArray(region.trainingMethodIds).forEach((methodId, ordinal) => {
      requireEntity(db, methodId, `research region ${regionId}`);
      prepared(db, "INSERT INTO research_region_training(region_id, method_entity_id, ordinal) VALUES (?, ?, ?)").run(
        regionId,
        methodId,
        ordinal,
      );
    });
  });

  asArray(catalog.skills).forEach((skill, skillIndex) => {
    const skillEntityId = entityAt(`$.skills[${skillIndex}]`);
    asArray(skill.methods).forEach((_, ordinal) => {
      prepared(
        db,
        "INSERT INTO research_skill_methods(skill_entity_id, method_entity_id, ordinal) VALUES (?, ?, ?)",
      ).run(skillEntityId, entityAt(`$.skills[${skillIndex}].methods[${ordinal}]`), ordinal);
    });
  });
}

// When several records resolve to one entity the first one imported wins its
// scalar fields, and the rest contribute only relations. That "first" used to
// mean whatever order the seed happened to store, so 682 entities were a blend
// nobody chose. Importing in authority order makes the winner the source the
// project actually trusts most, per docs/legacy-data-stage0.md.
const AUTHORITY = [
  [/^data\/league\//, 0], // official Jagex League material
  [/^data\/combat\//, 1], // RuneScape Wiki game data
  [/^data\/reference\//, 1],
  [/^data\/research\/catalog\.json$/, 2], // specialized verified research
  [/^data\/map\//, 3],
  [/^data\/research\//, 4], // overlays: snapshots and project inference
];
const authorityRank = (file) => AUTHORITY.find(([pattern]) => pattern.test(file))?.[1] ?? 5;

// Ties break on path so the order is total and a rebuild is reproducible.
const byAuthority = (a, b) =>
  authorityRank(a.file) - authorityRank(b.file) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0);

export function importSeed(db) {
  const documents = seedDocuments();
  const inputHash = hash(documents.map(({ file, text }) => `${file}:${hash(text)}`).join("\n"));
  transaction(db, () => {
    for (const document of documents) {
      prepared(
        db,
        "INSERT INTO source_files(path, classification, content_hash, bytes, metadata_json) VALUES (?, ?, ?, ?, ?)",
      ).run(
        document.file,
        fileClassification(document.file),
        hash(document.text),
        Buffer.byteLength(document.text),
        stableJson(compactMetadata(document.data)),
      );
    }
    seedRegions(db, documents);
    const imported = [];
    for (const document of [...documents].sort(byAuthority)) {
      const inheritedSources = sourceObjects(document.data);
      for (const record of document.records) {
        const candidate = entityCandidate(document.file, record);
        let entityId = null;
        if (candidate) {
          const fields = entityFields(candidate, record.row, document.file);
          entityId = insertEntity(db, fields, record);
          if (entityId) {
            // Regions are already seeded relationally by seedRegions.
            if (candidate.type !== "region") addDomainRow(db, entityId, candidate.type, record.row, record.parent);
            addRegions(db, entityId, record.row);
            addRequirements(db, entityId, record.row);
            addEffects(db, entityId, record.row);
            addTags(db, entityId, record.row);
            asArray(record.row.aliases).forEach((alias) => {
              if (typeof alias === "string" && alias.trim()) {
                prepared(db, "INSERT OR IGNORE INTO aliases(entity_id, alias) VALUES (?, ?)").run(
                  entityId,
                  alias.trim(),
                );
              }
            });
            [...sourceObjects(record.row), ...inheritedSources].forEach((source, ordinal) =>
              linkSource(db, entityId, source, ordinal, { file: document.file, path: record.path, row: record.row }),
            );
            imported.push({ entityId, row: record.row });
          }
        }
        prepared(
          db,
          `INSERT INTO source_records(source_file, record_path, stable_id, entity_id, record_hash, raw_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          document.file,
          record.path,
          candidate ? (typeof record.row.id === "string" ? record.row.id : candidate.id) : null,
          entityId,
          hash(stableJson(record.row)),
          stableJson(record.row),
        );
      }
    }
    importResearchCatalog(db, documents);
    addMapPoints(db, documents);
    resolveRelationships(db, imported);
    recordTransform(db, TRANSFORM_BY_NAME.get("seed-ingest"), inputHash, documents.length);
    recordTransform(
      db,
      TRANSFORM_BY_NAME.get("relational-core"),
      inputHash,
      Number(db.prepare("SELECT count(*) AS count FROM entities").get().count),
    );
  });
  return {
    inputHash,
    files: documents.length,
    bytes: documents.reduce((sum, document) => sum + Buffer.byteLength(document.text), 0),
  };
}

export function rebuildSearch(db) {
  transaction(db, () => {
    db.exec("DELETE FROM entity_search");
    const aliases = db.prepare("SELECT alias FROM aliases WHERE entity_id = ? ORDER BY alias");
    const insert = db.prepare(
      "INSERT INTO entity_search(id, name, short_description, detailed_description, aliases) VALUES (?, ?, ?, ?, ?)",
    );
    const entities = db
      .prepare("SELECT id, name, short_description, detailed_description FROM entities ORDER BY id")
      .all();
    for (const entity of entities) {
      insert.run(
        entity.id,
        entity.name,
        entity.short_description,
        entity.detailed_description,
        aliases
          .all(entity.id)
          .map(({ alias }) => alias)
          .join(" "),
      );
    }
    recordTransform(db, TRANSFORM_BY_NAME.get("search-index"), hash(String(entities.length)), entities.length);
  });
}
