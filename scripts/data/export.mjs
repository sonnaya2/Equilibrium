import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import {
  DATA_CATALOG,
  DOCUMENTS_PREFIX,
  DOMAIN_TABLES,
  EXPORT_ROOT,
  EXPORT_VERSION,
  REGION_IDS,
  REPORTS,
  ROOT,
  SCHEMA_VERSION,
  SHARD_LIMIT_BYTES,
  SHARD_TARGET_BYTES,
  TRANSFORM_BY_NAME,
} from "./config.mjs";
import { prepared, recordTransform } from "./database.mjs";
import { documentOutputs } from "./ingest.mjs";
import { researchExport, researchParity } from "./research.mjs";
import { atomicWrite, hash, jsonLine, slash, slugify, walkFiles } from "./utilities.mjs";

function rowsByEntity(rows) {
  const grouped = new Map();
  for (const { entity_id, ...row } of rows) {
    const values = grouped.get(entity_id) ?? [];
    values.push(row);
    grouped.set(entity_id, values);
  }
  return grouped;
}

function entityExport(entity, regionsByEntity, sourcesByEntity) {
  return {
    id: entity.id,
    type: entity.entity_type,
    name: entity.name,
    description: entity.short_description || entity.detailed_description,
    verifiedAt: entity.verified_at,
    status: entity.status,
    regions: regionsByEntity.get(entity.id) ?? [],
    sources: sourcesByEntity.get(entity.id) ?? [],
  };
}

// Shards are filled to a byte target rather than a record count so a domain of
// long records still downloads in predictable chunks.
function chunkDomain(domain, rows) {
  const chunks = [];
  let current = [];
  for (const row of rows) {
    const candidate = [...current, row];
    const body = jsonLine({ schemaVersion: EXPORT_VERSION, domain, records: candidate });
    if (current.length && Buffer.byteLength(body) > SHARD_TARGET_BYTES) {
      chunks.push(current);
      current = [row];
    } else current = candidate;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function domainShards(outputs, manifest, entities, regionsByEntity, sourcesByEntity) {
  const idMap = {};
  for (const domain of [...new Set(entities.map(({ entity_type }) => entity_type))].sort()) {
    const records = entities
      .filter(({ entity_type }) => entity_type === domain)
      .map((entity) => entityExport(entity, regionsByEntity, sourcesByEntity));
    const shards = [];
    for (const [index, chunk] of chunkDomain(domain, records).entries()) {
      const body = jsonLine({ schemaVersion: EXPORT_VERSION, domain, records: chunk });
      const path = `domains/${slugify(domain)}-${String(index + 1).padStart(2, "0")}.json`;
      outputs.set(path, body);
      const entry = { href: `/data/v2/${path}`, sha256: hash(body), bytes: Buffer.byteLength(body), records: chunk.length };
      shards.push(entry);
      for (const record of chunk) idMap[record.id] = entry.href;
    }
    manifest.domains[domain] = { records: records.length, shards };
  }
  return idMap;
}

// Bounded ID shards let a page resolve one stable ID without downloading a
// whole-database index.
function idIndexShards(outputs, manifest, idMap) {
  let chunk = {};
  const flush = () => {
    const entries = Object.entries(chunk);
    if (!entries.length) return;
    const body = jsonLine({ schemaVersion: EXPORT_VERSION, ids: chunk });
    const path = `indexes/entities-${String(manifest.idIndexes.length + 1).padStart(2, "0")}.json`;
    outputs.set(path, body);
    manifest.idIndexes.push({
      firstId: entries[0][0],
      lastId: entries.at(-1)[0],
      href: `/data/v2/${path}`,
      sha256: hash(body),
      bytes: Buffer.byteLength(body),
      records: entries.length,
    });
    chunk = {};
  };
  for (const [id, href] of Object.entries(idMap).sort(([a], [b]) => a.localeCompare(b))) {
    const candidate = { ...chunk, [id]: href };
    if (
      Object.keys(chunk).length &&
      Buffer.byteLength(jsonLine({ schemaVersion: EXPORT_VERSION, ids: candidate })) > SHARD_TARGET_BYTES
    ) {
      flush();
    }
    chunk[id] = href;
  }
  flush();
}

export function buildOutputs(db) {
  const outputs = new Map();
  const research = researchExport(db);
  for (const [path, body] of research.outputs) outputs.set(path, body);
  const entities = db
    .prepare(
      "SELECT id, entity_type, name, short_description, detailed_description, verified_at, status FROM entities ORDER BY entity_type, id",
    )
    .all();
  const regionsByEntity = rowsByEntity(
    db
      .prepare(
        "SELECT entity_id, region_id, relation, ordinal FROM entity_regions ORDER BY entity_id, relation, ordinal, region_id",
      )
      .all(),
  );
  const sourcesByEntity = rowsByEntity(
    db
      .prepare(
        `SELECT entity_sources.entity_id, sources.id, sources.url, sources.page_title AS title,
                sources.verified_at AS verifiedAt, entity_sources.role
         FROM entity_sources JOIN sources ON sources.id = entity_sources.source_id
         ORDER BY entity_sources.entity_id, entity_sources.ordinal, sources.id`,
      )
      .all(),
  );
  const documents = {};
  for (const [path, body] of documentOutputs(db)) {
    outputs.set(path, body);
    documents[`data/${path.slice(DOCUMENTS_PREFIX.length + 1)}`] = {
      href: `/data/v2/${path}`,
      sha256: hash(body),
      bytes: Buffer.byteLength(body),
    };
  }
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    exportVersion: EXPORT_VERSION,
    databaseInputHash: db.prepare("SELECT input_hash FROM transform_runs WHERE name = 'seed-ingest'").get().input_hash,
    recordCount: entities.length,
    documents,
    domains: {},
    regions: Object.fromEntries(research.index.regions.map((region) => [region.id, region])),
    idIndexes: [],
  };
  const idMap = domainShards(outputs, manifest, entities, regionsByEntity, sourcesByEntity);
  idIndexShards(outputs, manifest, idMap);
  for (const region of REGION_IDS) {
    const records = prepared(
      db,
      `SELECT entities.id, entities.entity_type AS type, entities.name, entity_regions.relation
       FROM entity_regions JOIN entities ON entities.id = entity_regions.entity_id
       WHERE entity_regions.region_id = ? ORDER BY entities.entity_type, entities.id`,
    ).all(region);
    const body = jsonLine({ schemaVersion: EXPORT_VERSION, region, records });
    const path = `regions/${region}.json`;
    outputs.set(path, body);
    manifest.regions[region] = {
      ...(manifest.regions[region] ?? { id: region }),
      indexHref: `/data/v2/${path}`,
      indexSha256: hash(body),
      indexBytes: Buffer.byteLength(body),
      indexedRecords: records.length,
    };
  }
  outputs.set("manifest.json", jsonLine(manifest));
  return { outputs, manifest, idMap };
}

export function compareOutputs(outputs) {
  const stale = walkFiles(EXPORT_ROOT, () => true)
    .map((path) => slash(relative(EXPORT_ROOT, path)))
    .filter((path) => !outputs.has(path));
  const changed = [];
  for (const [path, body] of outputs) {
    const destination = join(EXPORT_ROOT, path);
    if (!existsSync(destination) || readFileSync(destination, "utf8") !== body) changed.push(path);
  }
  return { changed, stale };
}

export function gitDataStatus() {
  try {
    return execFileSync("git", ["status", "--short", "--", "public/data/v2", "reports", "docs/data-catalog.md"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return ["Git status unavailable"];
  }
}

function writeCatalog(db, manifest) {
  const counts = db
    .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
    .all();
  const lines = [
    "# Data catalog",
    "",
    "Generated by `npm run data:export`. Edit records through `data/patches/`, never through this file or generated exports.",
    "",
    "## Domains",
    "",
    "| Domain | Records | Frontend shards |",
    "| --- | ---: | ---: |",
    ...counts.map(
      ({ entity_type, count }) => `| ${entity_type} | ${count} | ${manifest.domains[entity_type]?.shards.length ?? 0} |`,
    ),
    "",
    "## Normal workflow",
    "",
    '1. `npm run data:find -- --query "name"`',
    "2. `npm run data:context -- --id stable:id`",
    "3. `npm run data:impact -- --id stable:id`",
    "4. Add one JSONL operation under `data/patches/`.",
    "5. `npm run data:apply -- data/patches/file.jsonl`",
    "6. `npm run data:validate:changed && npm run data:export:changed`",
    "",
    "Schema: [`data/migrations/001-data-core.sql`](../data/migrations/001-data-core.sql). Architecture: [`docs/data-platform.md`](data-platform.md).",
    "",
  ];
  atomicWrite(DATA_CATALOG, lines.join("\n"));
}

const countOf = (db, sql, ...params) => Number(prepared(db, sql).get(...params).count);

function parityReport(db, parity) {
  return {
    schemaVersion: SCHEMA_VERSION,
    researchRegions: parity,
    exactRegionParity: parity.every(({ equal }) => equal),
    entityCounts: Object.fromEntries(
      db
        .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
        .all()
        .map(({ entity_type, count }) => [entity_type, Number(count)]),
    ),
    explicitSeedIds: countOf(
      db,
      "SELECT count(DISTINCT stable_id) AS count FROM source_records WHERE stable_id IS NOT NULL",
    ),
    mappedSeedRecords: countOf(db, "SELECT count(*) AS count FROM source_records WHERE entity_id IS NOT NULL"),
    quarantinedRecords: countOf(db, "SELECT count(*) AS count FROM quarantine"),
    unmappedStableRecordsWithoutQuarantine: countOf(
      db,
      `SELECT count(*) AS count FROM source_records
       WHERE stable_id IS NOT NULL AND entity_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM quarantine
           WHERE quarantine.source_file = source_records.source_file
             AND quarantine.record_path = source_records.record_path
         )`,
    ),
    sourceUrls: countOf(db, "SELECT count(*) AS count FROM sources"),
    relationships: countOf(db, "SELECT count(*) AS count FROM relationships"),
    crossRegionEntities: countOf(
      db,
      `SELECT count(*) AS count FROM (
         SELECT entity_id FROM entity_regions WHERE relation = 'required'
         GROUP BY entity_id HAVING count(DISTINCT region_id) > 1
       )`,
    ),
    recordsByRegion: Object.fromEntries(
      db
        .prepare(
          `SELECT region_id, count(DISTINCT entity_id) AS count
           FROM entity_regions GROUP BY region_id ORDER BY region_id`,
        )
        .all()
        .map(({ region_id, count }) => [region_id, Number(count)]),
    ),
    domainTables: Object.fromEntries(
      [...DOMAIN_TABLES].map(([domain, table]) => [domain, countOf(db, `SELECT count(*) AS count FROM ${table}`)]),
    ),
    // Spot checks across the domains most likely to break on an ID change.
    representativeIds: Object.fromEntries(
      ["item:seismic-wand", "magic:sonic-wave", "prayer:clarity-of-thought", "perk:biting", "wiki:462"].map((id) => [
        id,
        Boolean(prepared(db, "SELECT 1 FROM entities WHERE id = ?").get(id)),
      ]),
    ),
  };
}

export function exportData(db, checkOnly = false) {
  const { outputs, manifest } = buildOutputs(db);
  const parity = researchParity(db, outputs);
  const mismatch = parity.filter(({ equal }) => !equal);
  const comparison = compareOutputs(outputs);
  // Documents are build inputs, not browser payloads; data:audit is what fails
  // if one becomes reachable from a client component.
  const oversized = [...outputs].filter(
    ([path, body]) =>
      !path.startsWith(`${DOCUMENTS_PREFIX}/`) && Buffer.byteLength(body) > SHARD_LIMIT_BYTES,
  );
  if (oversized.length) {
    throw new Error(`Frontend shards exceed 500 KiB: ${oversized.map(([path]) => path).join(", ")}`);
  }
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(join(REPORTS, "data-migration-parity.json"), `${JSON.stringify(parityReport(db, parity), null, 2)}\n`);
  if (mismatch.length) {
    throw new Error(`Research compatibility parity failed: ${mismatch.map(({ region }) => region).join(", ")}`);
  }
  if (checkOnly) return { ...comparison, written: [] };
  mkdirSync(EXPORT_ROOT, { recursive: true });
  for (const path of comparison.stale) rmSync(join(EXPORT_ROOT, path), { force: true });
  for (const path of comparison.changed) atomicWrite(join(EXPORT_ROOT, path), outputs.get(path));
  writeCatalog(db, manifest);
  recordTransform(db, TRANSFORM_BY_NAME.get("frontend-shards"), hash(outputs.get("manifest.json")), manifest.recordCount);
  return { ...comparison, written: comparison.changed };
}
