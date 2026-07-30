import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";

const ROOT = process.cwd();
const CACHE = join(ROOT, ".cache");
const DATABASE = join(CACHE, "equilibrium.sqlite");
const CHANGED = join(CACHE, "data-changed.json");
const COMPAT_DATA = join(CACHE, "data");
const SEED = join(ROOT, "data/seed-v1.json.gz");
const MIGRATIONS = join(ROOT, "data/migrations");
const PATCHES = join(ROOT, "data/patches");
const EXPORT_ROOT = join(ROOT, "public/data/v2");
const REPORTS = join(ROOT, "reports");
const SCHEMA_VERSION = 1;
const EXPORT_VERSION = 2;
const SHARD_TARGET_BYTES = 220 * 1024;
const DEFAULT_MAX_BYTES = 16_000;
const DEFAULT_LIMIT = 20;
const FIXED_TIME = "1970-01-01T00:00:00.000Z";

const REGION_IDS = [
  "misthalin",
  "havenhythe",
  "asgarnia",
  "kandarin",
  "karamja",
  "desert",
  "morytania",
  "fremennik",
  "tirannwn",
  "forinthry",
  "anachronia",
];
const REGION_SET = new Set([...REGION_IDS, "global"]);
const REGION_ALIASES = new Map([
  ["wilderness", "forinthry"],
  ["the wilderness", "forinthry"],
  ["troll country", "asgarnia"],
  ["troll-country", "asgarnia"],
]);
const DOMAIN_TABLES = new Map([
  ["ability", "abilities"],
  ["activity", "activities"],
  ["equipment", "equipment"],
  ["invention-perk", "invention_perks"],
  ["prayer", "prayers"],
  ["quest", "quests"],
  ["spell", "spells"],
  ["task", "tasks"],
  ["training-method", "training_methods"],
  ["unlock", "unlocks"],
]);
const TRANSFORMS = [
  {
    name: "seed-ingest",
    stage: "ingest",
    version: 1,
    inputs: ["data/seed-v1.json.gz"],
    outputs: ["source_files", "source_records", ".cache/data/**"],
    dependencies: [],
    incremental: false,
    validation: "parseable JSON and stable file hashes",
  },
  {
    name: "relational-core",
    stage: "normalize",
    version: 1,
    inputs: ["source_records"],
    outputs: ["entities", "domain tables", "normalized relationships"],
    dependencies: ["seed-ingest"],
    incremental: false,
    validation: "constraints, taxonomy, and conflict quarantine",
  },
  {
    name: "search-index",
    stage: "enrich",
    version: 1,
    inputs: ["entities", "aliases"],
    outputs: ["entity_search"],
    dependencies: ["relational-core"],
    incremental: true,
    validation: "one search row per entity",
  },
  {
    name: "relational-validation",
    stage: "validate",
    version: 1,
    inputs: ["normalized database"],
    outputs: ["reports/data-validation.json"],
    dependencies: ["search-index"],
    incremental: true,
    validation: "foreign keys, IDs, sources, cycles, regions, counts",
  },
  {
    name: "frontend-shards",
    stage: "export",
    version: 1,
    inputs: ["validated database"],
    outputs: ["public/data/v2/**"],
    dependencies: ["relational-validation"],
    incremental: true,
    validation: "content hashes, size budgets, exact research parity",
  },
];

const slash = (value) => value.replaceAll("\\", "/");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const slugify = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "unnamed";
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
const jsonLine = (value) => `${stableJson(value)}\n`;
const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const scalar = (value, fallback = "") =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : fallback;
const parseBoolean = (value) =>
  value === true || String(value).toLowerCase() === "yes"
    ? 1
    : value === false || String(value).toLowerCase() === "no"
      ? 0
      : null;

function walkFiles(directory, predicate) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(path, predicate) : predicate(path) ? [path] : [];
    })
    .sort((a, b) => slash(relative(ROOT, a)).localeCompare(slash(relative(ROOT, b))));
}

function atomicWrite(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  writeFileSync(temporary, body);
  rmSync(path, { force: true });
  renameSync(temporary, path);
}

function openDatabase(path = DATABASE, mustExist = true) {
  if (mustExist && !existsSync(path)) throw new Error("Data database is missing; run npm run data:rebuild");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE;");
  return db;
}

function transaction(db, work) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function migrationTime(filename) {
  const date = filename.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  return date ? `${date[1]}-${date[2]}-${date[3]}T00:00:00.000Z` : FIXED_TIME;
}

function migrate(db) {
  const files = walkFiles(MIGRATIONS, (path) => extname(path) === ".sql");
  for (const path of files) {
    const filename = basename(path);
    const version = Number.parseInt(filename, 10);
    if (!Number.isInteger(version)) throw new Error(`Migration filename needs a numeric prefix: ${filename}`);
    const sql = readFileSync(path, "utf8");
    const contentHash = hash(sql);
    let applied = null;
    try {
      applied = db
        .prepare("SELECT content_hash FROM schema_migrations WHERE version = ?")
        .get(version);
    } catch {
      applied = null;
    }
    if (applied?.content_hash === contentHash) continue;
    if (applied) throw new Error(`Migration ${version} changed after application: ${filename}`);
    transaction(db, () => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations(version, filename, content_hash, applied_at) VALUES (?, ?, ?, ?)",
      ).run(version, filename, contentHash, migrationTime(filename));
    });
  }
  return files.length;
}

function fileClassification(file) {
  if (file.startsWith("data/research/planner-") || /regional-|region-combos|equipment-region-index/.test(file)) {
    return "snapshot-overlay";
  }
  if (/audit|review|unknowns|update-index/.test(file)) return "reference-evidence";
  if (file.startsWith("data/map/")) return "map-source";
  return "seed-content";
}

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

function collectArrayRecords(value, path = "$", key = "root", records = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        const recordPath = `${path}[${index}]`;
        records.push({ row: child, path: recordPath, key });
        collectArrayRecords(child, recordPath, key, records);
      }
    });
    return records;
  }
  if (!value || typeof value !== "object") return records;
  for (const [childKey, child] of Object.entries(value)) {
    collectArrayRecords(child, `${path}.${childKey}`, childKey, records);
  }
  return records;
}

function typeFor(file, key, row, path) {
  const lowerKey = key.toLowerCase();
  if (["sources", "source_urls", "source_ids", "requirements", "facts", "effects"].includes(lowerKey)) {
    return null;
  }
  if (file === "data/combat/equipment.json") return "equipment";
  if (file === "data/combat/abilities.json") return "ability";
  if (file === "data/combat/prayers.json") return "prayer";
  if (file === "data/combat/perks.json") return "invention-perk";
  if (file === "data/combat/effects.json") return "effect";
  if (file === "data/league/regions.json") return "region";
  if (file.endsWith("catalyst-tasks-snapshot.json") || file.endsWith("/tasks.json")) return "task";
  if (file === "data/league/quests.json") return "quest";
  if (file === "data/league/relics.json") return "relic";
  if (file === "data/league/blessings.json") return "blessing";
  if (file === "data/research/catalog.json") {
    if (path.includes(".methods[")) return "training-method";
    if (path.includes(".skills[") && !path.includes(".methods[")) return "skill";
    if (path.startsWith("$.regions[") && !path.slice("$.regions[".length).includes("].")) return "region";
    if (path.includes(".upgrades[")) return "unlock";
    if (path.includes(".content[")) return "activity";
  }
  if (/regional-(?:skilling|combat)-unlocks/.test(file)) {
    if (row.recordType === "equipment") return "equipment";
    if (row.recordType === "activity") return "activity";
    return "unlock";
  }
  if (lowerKey.includes("training") || lowerKey.includes("method")) return "training-method";
  if (lowerKey.includes("equipment")) return "equipment";
  if (lowerKey.includes("ability")) return "ability";
  if (lowerKey.includes("prayer")) return "prayer";
  if (lowerKey.includes("spell")) return "spell";
  if (lowerKey.includes("perk")) return "invention-perk";
  if (lowerKey.includes("quest")) return "quest";
  if (lowerKey.includes("task")) return "task";
  if (lowerKey.includes("activit")) return "activity";
  if (lowerKey.includes("unlock")) return "unlock";
  if (row.recordType) return slugify(row.recordType);
  if (row.id && (row.name || row.title || row.summary)) return "reference";
  return null;
}

function recordName(row) {
  return [row.name, row.title, row.method, row.quest, row.tool, row.perk, row.component, row.collection, row.summary]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}

function entityCandidate(file, record) {
  const type = typeFor(file, record.key, record.row, record.path);
  const name = recordName(record.row);
  if (!type || !name) return null;
  let id = typeof record.row.id === "string" && record.row.id.trim() ? record.row.id.trim() : "";
  if (type === "region") id = `region:${slugify(id || name)}`;
  else if (!id) {
    const scope =
      record.row.regionId ??
      record.row.region_id ??
      record.row.primary_region ??
      record.row.skill ??
      record.key ??
      basename(file, ".json");
    id = `${type}:${slugify(scope)}:${slugify(name)}`;
  } else if (!id.includes(":")) id = `${type}:${slugify(id)}`;
  if (id.length > 220) id = `${id.slice(0, 195)}-${hash(id).slice(0, 16)}`;
  return { id, type, name };
}

function normalizeRegion(value) {
  const raw = scalar(value).trim();
  if (!raw) return null;
  const slug = slugify(raw);
  return REGION_ALIASES.get(raw.toLowerCase()) ?? REGION_ALIASES.get(slug) ?? (REGION_SET.has(slug) ? slug : null);
}

function regionLinks(row) {
  const links = [];
  const add = (values, relation) => {
    asArray(values).forEach((value, ordinal) => {
      const region = normalizeRegion(value);
      if (region) links.push({ region, relation: region === "global" ? "global" : relation, ordinal });
    });
  };
  add(row.primary_region ?? row.primaryRegion ?? row.regionId ?? row.region_id, "primary");
  add(row.requiredRegions ?? row.required_regions, "required");
  add(row.regionHints ?? row.region_hints ?? row.region_hint, "hint");
  add(row.optionalRegions ?? row.optional_regions ?? row.region_options, "optional");
  add(row.excludedRegions ?? row.excluded_regions, "excluded");
  add(row.regions ?? row.unlock?.regions, "required");
  return [...new Map(links.map((link) => [`${link.region}:${link.relation}`, link])).values()];
}

function sourceObjects(value) {
  const candidates = [];
  const add = (source, role = "verification") => {
    if (typeof source === "string" && /^https?:\/\//i.test(source)) candidates.push({ url: source, role });
    else if (source && typeof source === "object") candidates.push({ ...source, role: source.role ?? role });
  };
  asArray(value?.sources).forEach((source) => add(source));
  add(value?.source);
  add(value?.source_url);
  add(value?.sourceUrl);
  asArray(value?.source_urls).forEach((source) => add(source));
  asArray(value?.official_source_urls).forEach((source) => add(source));
  add(value?.primary_source_url, "primary");
  add(value?.primarySourceUrl, "primary");
  asArray(value?.secondary_source_urls).forEach((source) => add(source, "secondary"));
  asArray(value?.secondarySourceUrls).forEach((source) => add(source, "secondary"));
  add(value?.secondary_source_url, "secondary");
  return candidates.filter((source) => typeof source.url === "string" && source.url.trim());
}

function sourceFamily(source) {
  if (source.source) return slugify(source.source);
  try {
    const host = new URL(source.url).hostname.replace(/^www\./, "");
    if (host === "runescape.wiki") return "runescape-wiki";
    if (host.endsWith("runescape.com")) return "jagex";
    if (host.includes("pvme")) return "pvme";
    return slugify(host);
  } catch {
    return "unknown";
  }
}

function entityFields(candidate, row, file) {
  const short = scalar(row.displayDescription ?? row.summary ?? row.note ?? row.warning);
  const detail = scalar(row.detail ?? row.description ?? row.league_treatment ?? row.purpose, short);
  return {
    id: candidate.id,
    slug: slugify(candidate.id),
    type: candidate.type,
    name: candidate.name,
    short,
    detail,
    confidence: scalar(row.confidence, "unspecified"),
    verifiedAt: scalar(row.verifiedAt ?? row.verified_at ?? row.snapshotDate ?? row.snapshot_date) || null,
    status: scalar(row.status, "active"),
    sortKey: scalar(row.sortKey ?? row.sort_key, candidate.name.toLocaleLowerCase("en")),
    file,
    extra: stableJson(row),
  };
}

function insertEntity(db, fields, record) {
  const existing = db.prepare("SELECT id, entity_type, name FROM entities WHERE id = ?").get(fields.id);
  if (existing) {
    if (existing.entity_type === fields.type && existing.name.toLocaleLowerCase("en") === fields.name.toLocaleLowerCase("en")) {
      return fields.id;
    }
    db.prepare(
      `INSERT OR IGNORE INTO quarantine
       (source_file, record_path, stable_id, error, conflicting_record, suggested_resolution, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      fields.file,
      record.path,
      fields.id,
      `Stable ID conflicts with ${existing.entity_type}:${existing.name}`,
      stableJson(existing),
      "Resolve the seed ID collision with an explicit content patch; no fuzzy merge was attempted.",
      fields.extra,
    );
    return null;
  }
  db.prepare(
    `INSERT INTO entities
     (id, slug, entity_type, name, short_description, detailed_description, confidence, verified_at,
      status, sort_key, created_source, updated_source, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    fields.id,
    fields.slug,
    fields.type,
    fields.name,
    fields.short,
    fields.detail,
    fields.confidence,
    fields.verifiedAt,
    fields.status,
    fields.sortKey,
    fields.file,
    fields.file,
    fields.extra,
  );
  return fields.id;
}

function linkSource(db, entityId, source, ordinal, context) {
  let parsed;
  try {
    parsed = new URL(source.url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("URL must use HTTP or HTTPS");
  } catch (error) {
    db.prepare(
      `INSERT OR IGNORE INTO quarantine
       (source_file, record_path, stable_id, error, conflicting_record, suggested_resolution, raw_json)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    ).run(
      context.file,
      context.path,
      entityId,
      `Invalid source URL: ${source.url} (${error.message})`,
      "Correct the URL in a content patch.",
      stableJson(context.row),
    );
    return;
  }
  const url = parsed.href;
  const family = sourceFamily({ ...source, url });
  const existing = db.prepare("SELECT id FROM sources WHERE url = ?").get(url);
  const sourceId = existing?.id ?? `source:${family}:${hash(url).slice(0, 16)}`;
  db.prepare(
    `INSERT OR IGNORE INTO sources
     (id, url, page_title, publisher, source_family, verified_at, retrieved_at, confidence, source_role, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sourceId,
    url,
    scalar(source.title ?? source.page_title),
    scalar(source.publisher ?? source.source),
    family,
    scalar(source.verifiedAt ?? source.verified_at) || null,
    scalar(source.retrievedAt ?? source.retrieved_at) || null,
    scalar(source.confidence, "unspecified"),
    scalar(source.role, "verification"),
    scalar(source.content_hash) || null,
  );
  db.prepare(
    "INSERT OR IGNORE INTO entity_sources(entity_id, source_id, role, ordinal) VALUES (?, ?, ?, ?)",
  ).run(entityId, sourceId, scalar(source.role, "verification"), ordinal);
}

function addRequirements(db, entityId, row) {
  const values = [...asArray(row.requirements), ...asArray(row.access_requirements)];
  if (row.unlock?.requirement) values.push(row.unlock.requirement);
  values.forEach((value, ordinal) => {
    const description = typeof value === "string" ? value : stableJson(value);
    if (!description) return;
    const levelMatch = description.match(/\b(\d{1,3})\b/);
    db.prepare(
      `INSERT OR IGNORE INTO requirements
       (entity_id, kind, skill, level, target_entity_id, description, ordinal)
       VALUES (?, 'text', NULL, ?, NULL, ?, ?)`,
    ).run(entityId, levelMatch ? Number(levelMatch[1]) : null, description, ordinal);
  });
}

function addEffects(db, entityId, row) {
  [...asArray(row.effects), ...asArray(row.facts)].forEach((value, ordinal) => {
    const description = typeof value === "string" ? value : stableJson(value);
    if (!description) return;
    db.prepare(
      `INSERT OR IGNORE INTO effects
       (entity_id, effect_key, description, value_text, ordinal, metadata_json)
       VALUES (?, ?, ?, '', ?, '{}')`,
    ).run(entityId, `effect-${ordinal + 1}`, description, ordinal);
  });
}

function addTags(db, entityId, row) {
  const values = [row.style, row.category, row.skill, ...asArray(row.target_tags), ...asArray(row.tags)];
  [...new Set(values.filter((value) => typeof value === "string" && value.trim()))].forEach((value) => {
    const id = slugify(value);
    db.prepare("INSERT OR IGNORE INTO tags(id, name) VALUES (?, ?)").run(id, value.trim());
    db.prepare("INSERT OR IGNORE INTO entity_tags(entity_id, tag_id) VALUES (?, ?)").run(entityId, id);
  });
}

function addDomainRow(db, entityId, type, row) {
  const extra = stableJson(row);
  if (type === "equipment") {
    db.prepare(
      "INSERT OR IGNORE INTO equipment(entity_id, style, slot, tier, category, extra_json) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(entityId, scalar(row.style), scalar(row.slot), Number.isFinite(row.tier) ? row.tier : null, scalar(row.category), extra);
    for (const [stat, value] of Object.entries(row.bonuses ?? {})) {
      if (typeof value === "number") {
        db.prepare("INSERT OR IGNORE INTO equipment_stats(entity_id, stat, value) VALUES (?, ?, ?)").run(
          entityId,
          stat,
          value,
        );
      }
    }
  } else if (type === "ability") {
    db.prepare(
      "INSERT OR IGNORE INTO abilities(entity_id, style, category, level, cooldown_ticks, extra_json) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(entityId, scalar(row.style), scalar(row.category), Number.isFinite(row.level) ? row.level : null, Number.isFinite(row.cooldownTicks) ? row.cooldownTicks : null, extra);
  } else if (type === "prayer") {
    db.prepare("INSERT OR IGNORE INTO prayers(entity_id, book, level, extra_json) VALUES (?, ?, ?, ?)").run(
      entityId,
      scalar(row.book ?? row.book_type),
      Number.isFinite(row.level ?? row.prayer_requirement) ? (row.level ?? row.prayer_requirement) : null,
      extra,
    );
  } else if (type === "spell") {
    db.prepare("INSERT OR IGNORE INTO spells(entity_id, spellbook, level, extra_json) VALUES (?, ?, ?, ?)").run(
      entityId,
      scalar(row.spellbook ?? row.book ?? row.book_type),
      Number.isFinite(row.level) ? row.level : null,
      extra,
    );
  } else if (type === "invention-perk") {
    db.prepare(
      "INSERT OR IGNORE INTO invention_perks(entity_id, max_rank, category, extra_json) VALUES (?, ?, ?, ?)",
    ).run(entityId, Number.isFinite(row.maxRank) ? row.maxRank : null, scalar(row.category), extra);
  } else if (type === "activity") {
    db.prepare("INSERT OR IGNORE INTO activities(entity_id, category, location, extra_json) VALUES (?, ?, ?, ?)").run(
      entityId,
      scalar(row.category),
      scalar(row.location),
      extra,
    );
  } else if (type === "unlock") {
    db.prepare("INSERT OR IGNORE INTO unlocks(entity_id, category, unlock_type, extra_json) VALUES (?, ?, ?, ?)").run(
      entityId,
      scalar(row.category),
      scalar(row.type ?? row.recordType),
      extra,
    );
  } else if (type === "task") {
    const region = normalizeRegion(row.regionId ?? row.region);
    db.prepare(
      "INSERT OR IGNORE INTO tasks(entity_id, tier, points, region_id, source_league, extra_json) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(entityId, scalar(row.tier), Number.isFinite(row.points) ? row.points : null, region, scalar(row.sourceLeague), extra);
  } else if (type === "quest") {
    const region = normalizeRegion(row.primary_region);
    db.prepare(
      "INSERT OR IGNORE INTO quests(entity_id, quest_type, series, primary_region_id, members, release_date, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      entityId,
      scalar(row.quest_type),
      scalar(row.series),
      region,
      parseBoolean(row.members),
      scalar(row.release),
      extra,
    );
  } else if (type === "training-method") {
    db.prepare(
      `INSERT OR IGNORE INTO training_methods
       (entity_id, skill, level_range, xp_rate, intensity, location, hard_region_requirement, extra_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entityId,
      scalar(row.skill),
      scalar(row.levelRange ?? row.level_range),
      scalar(row.xpRate ?? row.xp_rate),
      scalar(row.intensity),
      scalar(row.location),
      row.hardRegionRequirement ?? row.hard_region_requirement ? 1 : 0,
      extra,
    );
  } else if (type === "effect") {
    db.prepare(
      "INSERT OR IGNORE INTO effects(entity_id, effect_key, description, value_text, ordinal, metadata_json) VALUES (?, 'record', ?, '', 0, ?)",
    ).run(entityId, scalar(row.displayDescription ?? row.description ?? row.name), extra);
  }
}

function addRegions(db, entityId, row) {
  for (const link of regionLinks(row)) {
    db.prepare(
      `INSERT OR IGNORE INTO entity_regions
       (entity_id, region_id, relation, ordinal, requirement_group) VALUES (?, ?, ?, ?, ?)`,
    ).run(
      entityId,
      link.region,
      link.relation,
      link.ordinal,
      scalar(row.regionRequirementType ?? row.region_requirement_type),
    );
  }
}

function seedRegions(db, documents) {
  const regionDocument = documents.find(({ file }) => file === "data/league/regions.json");
  if (!regionDocument) throw new Error("Missing data/league/regions.json");
  const rows = regionDocument.data.records ?? [];
  if (rows.length !== REGION_IDS.length) throw new Error(`Expected ${REGION_IDS.length} canonical regions, got ${rows.length}`);
  rows.forEach((row, index) => {
    const id = normalizeRegion(row.id);
    if (!id || id === "global") throw new Error(`Unknown canonical region: ${row.id}`);
    const entityId = `region:${id}`;
    db.prepare(
      `INSERT INTO entities
       (id, slug, entity_type, name, short_description, detailed_description, confidence, verified_at,
        status, sort_key, created_source, updated_source, extra_json)
       VALUES (?, ?, 'region', ?, '', '', ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      entityId,
      slugify(entityId),
      row.name,
      row.verified ? "verified" : "provisional",
      row.source?.verifiedAt ?? null,
      String(index).padStart(2, "0"),
      regionDocument.file,
      regionDocument.file,
      stableJson(row),
    );
    db.prepare(
      "INSERT INTO regions(id, entity_id, name, availability, verified, taxonomy_order) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, entityId, row.name, scalar(row.availability, "unknown"), row.verified ? 1 : 0, index);
    asArray(row.aliases).forEach((alias) => {
      if (typeof alias === "string" && alias.trim()) {
        db.prepare("INSERT OR IGNORE INTO aliases(entity_id, alias, kind) VALUES (?, ?, 'region')").run(entityId, alias.trim());
      }
    });
    sourceObjects(row).forEach((source, ordinal) =>
      linkSource(db, entityId, source, ordinal, { file: regionDocument.file, path: `$.records[${index}]`, row }),
    );
  });
  db.prepare(
    `INSERT INTO entities
     (id, slug, entity_type, name, confidence, status, sort_key, created_source, updated_source)
     VALUES ('region:global', 'region-global', 'region', 'Global', 'taxonomy', 'active', '99', 'schema', 'schema')`,
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
      db.prepare(
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
        db.prepare(
          "INSERT OR IGNORE INTO relationships(subject_id, predicate, object_id, ordinal) VALUES (?, 'requires', ?, ?)",
        ).run(entityId, matches[0], ordinal);
      }
    }
  }
}

function recordTransform(db, transform, inputHash, outputCount) {
  db.prepare(
    `INSERT OR REPLACE INTO transform_runs(name, version, stage, input_hash, output_count, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(transform.name, transform.version, transform.stage, inputHash, outputCount, FIXED_TIME);
}

function seedDocuments() {
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

function materializeCompatibilityData(db) {
  const documents = seedDocuments();
  const byFile = new Map(documents.map((document) => [document.file, document]));
  for (const row of db
    .prepare("SELECT source_file, record_path, raw_json FROM source_records ORDER BY source_file, record_path")
    .all()) {
    const document = byFile.get(row.source_file);
    if (!document) throw new Error(`Seed document disappeared: ${row.source_file}`);
    setRecordAtPath(document.data, row.record_path, JSON.parse(row.raw_json));
  }
  const target = resolve(COMPAT_DATA);
  if (dirname(target) !== resolve(CACHE) || basename(target) !== "data") {
    throw new Error(`Refusing to replace unexpected compatibility path: ${target}`);
  }
  mkdirSync(target, { recursive: true });
  const expected = new Set();
  for (const document of documents) {
    const path = join(CACHE, document.file);
    expected.add(resolve(path));
    atomicWrite(path, `${stableJson(document.data)}\n`);
  }
  for (const path of walkFiles(target, () => true)) {
    if (!expected.has(resolve(path))) rmSync(path, { force: true });
  }
}

function importSeed(db) {
  const documents = seedDocuments();
  const inputHash = hash(documents.map(({ file, text }) => `${file}:${hash(text)}`).join("\n"));
  transaction(db, () => {
    for (const document of documents) {
      db.prepare(
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
    for (const document of documents) {
      const inheritedSources = sourceObjects(document.data);
      for (const record of document.records) {
        const candidate = entityCandidate(document.file, record);
        let entityId = null;
        if (candidate) {
          const fields = entityFields(candidate, record.row, document.file);
          entityId = insertEntity(db, fields, record);
          if (entityId) {
            const existingRegion = candidate.type === "region";
            if (!existingRegion) addDomainRow(db, entityId, candidate.type, record.row);
            addRegions(db, entityId, record.row);
            addRequirements(db, entityId, record.row);
            addEffects(db, entityId, record.row);
            addTags(db, entityId, record.row);
            asArray(record.row.aliases).forEach((alias) => {
              if (typeof alias === "string" && alias.trim()) {
                db.prepare("INSERT OR IGNORE INTO aliases(entity_id, alias) VALUES (?, ?)").run(entityId, alias.trim());
              }
            });
            [...sourceObjects(record.row), ...inheritedSources].forEach((source, ordinal) =>
              linkSource(db, entityId, source, ordinal, { file: document.file, path: record.path, row: record.row }),
            );
            imported.push({ entityId, row: record.row });
          }
        }
        db.prepare(
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
    addMapPoints(db, documents);
    resolveRelationships(db, imported);
    recordTransform(db, TRANSFORMS[0], inputHash, documents.length);
    recordTransform(
      db,
      TRANSFORMS[1],
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

function rebuildSearch(db) {
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
        aliases.all(entity.id).map(({ alias }) => alias).join(" "),
      );
    }
    recordTransform(db, TRANSFORMS[2], hash(String(entities.length)), entities.length);
  });
}

function parsePatch(path) {
  const body = readFileSync(path, "utf8");
  if (Buffer.byteLength(body) > 1024 * 1024) throw new Error(`${path}: patch exceeds the 1 MiB safety limit`);
  const operations = body
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => text && !text.startsWith("#"))
    .map(({ line, text }) => {
      try {
        return { line, operation: JSON.parse(text) };
      } catch (error) {
        throw new Error(`${path}:${line}: ${error.message}`);
      }
    });
  if (operations.length > 1000) throw new Error(`${path}: patch exceeds the 1,000-operation safety limit`);
  return { body, operations };
}

function requireEntity(db, id, context) {
  const entity = db.prepare("SELECT id, entity_type FROM entities WHERE id = ?").get(id);
  if (!entity) throw new Error(`${context}: entity not found: ${id}`);
  return entity;
}

function syncSourceEntityFields(db, id, fields) {
  const keyChoices = {
    name: ["name", "title", "label", "item", "ability", "quest", "activity", "method", "perk"],
    short_description: ["shortDescription", "summary", "description"],
    detailed_description: ["detailedDescription", "detail", "description"],
    verified_at: ["verifiedAt", "verified_at"],
    sort_key: ["sortKey", "sort_key"],
  };
  const select = db.prepare("SELECT source_file, record_path, raw_json FROM source_records WHERE entity_id = ?");
  const update = db.prepare(
    "UPDATE source_records SET raw_json = ?, record_hash = ? WHERE source_file = ? AND record_path = ?",
  );
  for (const record of select.all(id)) {
    const row = JSON.parse(record.raw_json);
    for (const [field, value] of Object.entries(fields)) {
      if (field === "entity_type") continue;
      const candidates = keyChoices[field] ?? [field];
      const key = candidates.find((candidate) => Object.hasOwn(row, candidate)) ?? candidates[0];
      row[key] = value;
    }
    const raw = stableJson(row);
    update.run(raw, hash(raw), record.source_file, record.record_path);
  }
}

function applyOperation(db, operation, context, changed) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    throw new Error(`${context}: operation must be an object`);
  }
  const id = scalar(operation.entity);
  if (operation.op === "upsert") {
    const allowed = new Set([
      "name",
      "entity_type",
      "short_description",
      "detailed_description",
      "confidence",
      "verified_at",
      "status",
      "sort_key",
    ]);
    if (!id || !operation.set || typeof operation.set !== "object" || Array.isArray(operation.set)) {
      throw new Error(`${context}: upsert requires entity and scalar set fields`);
    }
    const unknown = Object.keys(operation.set).filter((key) => !allowed.has(key));
    if (unknown.length) throw new Error(`${context}: unsupported upsert fields: ${unknown.join(", ")}`);
    if (Object.values(operation.set).some((value) => value != null && typeof value === "object")) {
      throw new Error(`${context}: upsert cannot replace arrays or objects; use a narrow operation`);
    }
    const existing = db.prepare("SELECT * FROM entities WHERE id = ?").get(id);
    if (!existing) {
      if (!operation.set.name || !operation.set.entity_type) {
        throw new Error(`${context}: new entity requires name and entity_type`);
      }
      const name = scalar(operation.set.name);
      db.prepare(
        `INSERT INTO entities
         (id, slug, entity_type, name, short_description, detailed_description, confidence, verified_at,
          status, sort_key, created_source, updated_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        slugify(id),
        operation.set.entity_type,
        name,
        scalar(operation.set.short_description),
        scalar(operation.set.detailed_description),
        scalar(operation.set.confidence, "unspecified"),
        operation.set.verified_at ?? null,
        scalar(operation.set.status, "active"),
        scalar(operation.set.sort_key, name.toLocaleLowerCase("en")),
        `patch:${context.split(":")[0]}`,
        `patch:${context.split(":")[0]}`,
      );
    } else {
      if (operation.set.entity_type && operation.set.entity_type !== existing.entity_type) {
        throw new Error(`${context}: changing entity_type requires a new stable ID`);
      }
      const assignments = Object.keys(operation.set);
      if (!assignments.length) throw new Error(`${context}: upsert set cannot be empty`);
      db.prepare(
        `UPDATE entities SET ${assignments.map((key) => `${key} = ?`).join(", ")}, updated_source = ? WHERE id = ?`,
      ).run(...assignments.map((key) => operation.set[key]), `patch:${context.split(":")[0]}`, id);
      syncSourceEntityFields(db, id, operation.set);
    }
  } else if (operation.op === "upsert-source") {
    const allowed = new Set([
      "url",
      "page_title",
      "publisher",
      "source_family",
      "verified_at",
      "retrieved_at",
      "confidence",
      "source_role",
      "content_hash",
    ]);
    const sourceId = scalar(operation.source);
    if (!sourceId || !operation.set || typeof operation.set !== "object" || Array.isArray(operation.set)) {
      throw new Error(`${context}: upsert-source requires source and scalar set fields`);
    }
    const unknown = Object.keys(operation.set).filter((key) => !allowed.has(key));
    if (unknown.length) throw new Error(`${context}: unsupported source fields: ${unknown.join(", ")}`);
    if (Object.values(operation.set).some((value) => value != null && typeof value === "object")) {
      throw new Error(`${context}: source fields must be scalar`);
    }
    const existing = db.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId);
    if (!existing && (!operation.set.url || !operation.set.source_family)) {
      throw new Error(`${context}: new source requires url and source_family`);
    }
    if (operation.set.url) {
      const url = new URL(operation.set.url);
      if (!/^https?:$/.test(url.protocol)) throw new Error(`${context}: source URL must use HTTP or HTTPS`);
      operation.set.url = url.href;
    }
    if (existing) {
      const assignments = Object.keys(operation.set);
      if (!assignments.length) throw new Error(`${context}: source set cannot be empty`);
      db.prepare(`UPDATE sources SET ${assignments.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`).run(
        ...assignments.map((key) => operation.set[key]),
        sourceId,
      );
    } else {
      db.prepare(
        `INSERT INTO sources
         (id, url, page_title, publisher, source_family, verified_at, retrieved_at, confidence, source_role, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        sourceId,
        operation.set.url,
        scalar(operation.set.page_title),
        scalar(operation.set.publisher),
        operation.set.source_family,
        operation.set.verified_at ?? null,
        operation.set.retrieved_at ?? null,
        scalar(operation.set.confidence, "unspecified"),
        scalar(operation.set.source_role, "reference"),
        operation.set.content_hash ?? null,
      );
    }
    db.prepare("SELECT entity_id FROM entity_sources WHERE source_id = ?").all(sourceId).forEach(({ entity_id }) => changed.add(entity_id));
  } else if (operation.op === "link-region" || operation.op === "unlink-region") {
    requireEntity(db, id, context);
    const region = normalizeRegion(operation.region);
    if (!region) throw new Error(`${context}: unknown region: ${operation.region}`);
    const relation = scalar(operation.relation, "required");
    if (!["primary", "required", "optional", "hint", "excluded", "global"].includes(relation)) {
      throw new Error(`${context}: invalid region relation: ${relation}`);
    }
    if (operation.op === "link-region") {
      db.prepare(
        `INSERT INTO entity_regions(entity_id, region_id, relation, ordinal, requirement_group)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(entity_id, region_id, relation) DO UPDATE SET
           ordinal = excluded.ordinal, requirement_group = excluded.requirement_group`,
      ).run(id, region, region === "global" ? "global" : relation, operation.order ?? 0, scalar(operation.group));
    } else {
      db.prepare("DELETE FROM entity_regions WHERE entity_id = ? AND region_id = ? AND relation = ?").run(
        id,
        region,
        relation,
      );
    }
  } else if (operation.op === "link-source" || operation.op === "unlink-source") {
    requireEntity(db, id, context);
    const sourceId = scalar(operation.source);
    if (!db.prepare("SELECT 1 FROM sources WHERE id = ?").get(sourceId)) {
      throw new Error(`${context}: source not found: ${sourceId}`);
    }
    const role = scalar(operation.role, "verification");
    if (operation.op === "link-source") {
      db.prepare(
        "INSERT OR REPLACE INTO entity_sources(entity_id, source_id, role, ordinal) VALUES (?, ?, ?, ?)",
      ).run(id, sourceId, role, operation.order ?? 0);
    } else {
      db.prepare("DELETE FROM entity_sources WHERE entity_id = ? AND source_id = ? AND role = ?").run(
        id,
        sourceId,
        role,
      );
    }
  } else if (operation.op === "relate" || operation.op === "unrelate") {
    requireEntity(db, id, context);
    const target = scalar(operation.target);
    requireEntity(db, target, context);
    const predicate = scalar(operation.relation);
    if (!predicate) throw new Error(`${context}: relationship predicate is required`);
    if (operation.op === "relate") {
      db.prepare(
        "INSERT OR REPLACE INTO relationships(subject_id, predicate, object_id, ordinal) VALUES (?, ?, ?, ?)",
      ).run(id, predicate, target, operation.order ?? 0);
    } else {
      db.prepare("DELETE FROM relationships WHERE subject_id = ? AND predicate = ? AND object_id = ?").run(
        id,
        predicate,
        target,
      );
    }
  } else if (operation.op === "remove") {
    requireEntity(db, id, context);
    if (!scalar(operation.reason)) throw new Error(`${context}: remove requires a reason`);
    db.prepare("UPDATE entities SET status = 'removed', updated_source = ? WHERE id = ?").run(
      `patch:${context.split(":")[0]}`,
      id,
    );
    syncSourceEntityFields(db, id, { status: "removed" });
  } else {
    throw new Error(`${context}: unsupported operation: ${operation.op}`);
  }
  if (id) changed.add(id);
}

function applyPatch(db, path, allowApplied = true) {
  const filename = basename(path);
  const patchId = filename.replace(/\.jsonl$/i, "");
  const { body, operations } = parsePatch(path);
  const contentHash = hash(body);
  const ledger = db.prepare("SELECT content_hash FROM patch_ledger WHERE patch_id = ?").get(patchId);
  if (ledger) {
    if (ledger.content_hash !== contentHash) {
      throw new Error(`${filename}: patch identity was already applied with a different content hash`);
    }
    if (allowApplied) return new Set();
    throw new Error(`${filename}: patch is already applied`);
  }
  const changed = new Set();
  transaction(db, () => {
    for (const { line, operation } of operations) {
      try {
        const before = new Set(changed);
        applyOperation(db, operation, `${filename}:${line}`, changed);
        for (const entityId of [...changed].filter((entityId) => !before.has(entityId))) {
          db.prepare(
            "INSERT INTO patch_changes(patch_id, entity_id, operation, line) VALUES (?, ?, ?, ?)",
          ).run(patchId, entityId, operation.op, line);
        }
      } catch (error) {
        throw new Error(`${filename}:${line}:${operation.entity ?? "unknown"}: ${error.message}`);
      }
    }
    const count = Number(db.prepare("SELECT count(*) AS count FROM entities").get().count);
    db.prepare(
      `INSERT INTO patch_ledger
       (patch_id, filename, content_hash, applied_at, schema_version, resulting_entity_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(patchId, filename, contentHash, migrationTime(filename), SCHEMA_VERSION, count);
  });
  return changed;
}

function applyAllPatches(db) {
  const changed = new Set();
  for (const path of walkFiles(PATCHES, (file) => extname(file) === ".jsonl")) {
    for (const id of applyPatch(db, path)) changed.add(id);
  }
  return changed;
}

function writeChanged(db, changed) {
  const entities = [...changed].sort().map((id) => {
    const entity = db.prepare("SELECT entity_type FROM entities WHERE id = ?").get(id);
    const regions = [
      ...new Set(
        db
          .prepare("SELECT region_id FROM entity_regions WHERE entity_id = ? ORDER BY region_id")
          .all(id)
          .map(({ region_id }) => region_id),
      ),
    ];
    return { id, type: entity?.entity_type ?? "removed", regions };
  });
  atomicWrite(CHANGED, jsonLine({ schemaVersion: SCHEMA_VERSION, entities }));
}

function checkRows(db, sql) {
  return db.prepare(sql).all();
}

function validate(db, changedOnly = false) {
  const changed = changedOnly && existsSync(CHANGED) ? JSON.parse(readFileSync(CHANGED, "utf8")).entities : [];
  const changedIds = new Set(changed.map(({ id }) => id));
  const failures = [];
  const warnings = [];
  const addFailure = (name, rows) => rows.length && failures.push({ name, count: rows.length, samples: rows.slice(0, 20) });
  const addWarning = (name, rows) => rows.length && warnings.push({ name, count: rows.length, samples: rows.slice(0, 20) });
  addFailure("foreign keys", checkRows(db, "PRAGMA foreign_key_check"));
  addFailure(
    "forbidden Troll Country taxonomy",
    checkRows(db, "SELECT id, name FROM regions WHERE lower(id) LIKE '%troll%' OR lower(name) LIKE '%troll country%'"),
  );
  addFailure(
    "invalid source URLs",
    checkRows(db, "SELECT id, url FROM sources WHERE url NOT GLOB 'https://*' AND url NOT GLOB 'http://*'"),
  );
  addFailure(
    "orphan search rows",
    checkRows(db, "SELECT id FROM entity_search EXCEPT SELECT id FROM entities"),
  );
  addFailure(
    "missing search rows",
    checkRows(db, "SELECT id FROM entities EXCEPT SELECT id FROM entity_search"),
  );
  addFailure(
    "requires cycles",
    checkRows(
      db,
      `WITH RECURSIVE path(root, node, seen, cycle) AS (
         SELECT subject_id, object_id, '|' || subject_id || '|' || object_id || '|', subject_id = object_id
         FROM relationships WHERE predicate = 'requires'
         UNION ALL
         SELECT path.root, relationships.object_id, path.seen || relationships.object_id || '|', relationships.object_id = path.root
         FROM path JOIN relationships ON relationships.subject_id = path.node
         WHERE relationships.predicate = 'requires'
           AND path.cycle = 0
           AND (relationships.object_id = path.root OR instr(path.seen, '|' || relationships.object_id || '|') = 0)
       )
       SELECT DISTINCT root FROM path WHERE cycle = 1 LIMIT 20`,
    ),
  );
  addFailure(
    "schema version mismatch",
    checkRows(db, `SELECT max(version) AS version FROM schema_migrations HAVING version != ${SCHEMA_VERSION}`),
  );
  addFailure(
    "unmapped stable seed records without quarantine",
    checkRows(
      db,
      `SELECT source_records.source_file, source_records.record_path, source_records.stable_id
       FROM source_records
       WHERE source_records.stable_id IS NOT NULL
         AND source_records.entity_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM quarantine
           WHERE quarantine.source_file = source_records.source_file
             AND quarantine.record_path = source_records.record_path
         )
       ORDER BY source_records.source_file, source_records.record_path`,
    ),
  );
  const missingSources = checkRows(
    db,
    `SELECT id, entity_type FROM entities
     WHERE status = 'active'
       AND entity_type IN ('equipment','ability','prayer','spell','invention-perk','quest','task','training-method','unlock')
       AND NOT EXISTS (SELECT 1 FROM entity_sources WHERE entity_id = entities.id)
     ORDER BY id`,
  );
  addWarning(
    "active factual entities without a normalized source",
    changedOnly ? missingSources.filter(({ id }) => changedIds.has(id)) : missingSources,
  );
  const quarantined = checkRows(
    db,
    "SELECT source_file, record_path, stable_id, error FROM quarantine ORDER BY source_file, record_path",
  );
  addWarning(
    "quarantined seed records",
    changedOnly ? quarantined.filter(({ stable_id }) => changedIds.has(stable_id)) : quarantined,
  );
  const counts = Object.fromEntries(
    db
      .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
      .all()
      .map(({ entity_type, count }) => [entity_type, Number(count)]),
  );
  const report = {
    schemaVersion: SCHEMA_VERSION,
    scope: changedOnly ? "changed" : "full",
    changed,
    valid: failures.length === 0,
    failures,
    warnings,
    counts,
    foreignKeysEnabled: Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys) === 1,
  };
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(join(REPORTS, "data-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(
    join(REPORTS, "data-quarantine.json"),
    `${JSON.stringify(
      db
        .prepare(
          "SELECT source_file, record_path, stable_id, error, conflicting_record, suggested_resolution FROM quarantine ORDER BY source_file, record_path",
        )
        .all(),
      null,
      2,
    )}\n`,
  );
  if (failures.length) throw new Error(`Data validation failed: ${failures.map(({ name, count }) => `${name} (${count})`).join(", ")}`);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  recordTransform(db, TRANSFORMS[3], hash(stableJson(counts)), total);
  return report;
}

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
    confidence: entity.confidence,
    verifiedAt: entity.verified_at,
    status: entity.status,
    regions: regionsByEntity.get(entity.id) ?? [],
    sources: sourcesByEntity.get(entity.id) ?? [],
  };
}

const HARD_REGION_KEYS = ["requiredRegions", "required_regions", "required_region", "required_regions_for_collection_loop"];
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

function collectRegionScope(value, out) {
  if (typeof value === "string" && value.trim()) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectRegionScope(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectRegionScope(item, out));
}

function normalizeRegionScope(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function rowMatchesRegion(row, region) {
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

function sourceRows(db, file, pattern) {
  return db
    .prepare("SELECT record_path, raw_json FROM source_records WHERE source_file = ? ORDER BY record_path")
    .all(file)
    .filter(({ record_path }) => pattern.test(record_path))
    .sort((a, b) => Number(a.record_path.match(/\[(\d+)\]$/)?.[1] ?? 0) - Number(b.record_path.match(/\[(\d+)\]$/)?.[1] ?? 0))
    .map(({ raw_json }) => JSON.parse(raw_json));
}

function sourceSection(db, file, section) {
  return sourceRows(db, file, new RegExp(`^\\$\\.${section}\\[\\d+\\]$`));
}

function rowKey(row, index, prefix) {
  if (row.id != null && row.id !== "") return String(row.id);
  if (typeof row.name === "string" && row.name) return `${prefix}:${row.name}`;
  if (typeof row.quest === "string" && row.quest) return `${prefix}:${row.quest}`;
  return `${prefix}:${index}`;
}

function researchPanels(db, region) {
  const skilling = sourceSection(db, "data/research/regional-skilling-unlocks.json", "records");
  const combat = sourceSection(db, "data/research/regional-combat-unlocks.json", "records");
  const regional = {
    skillingActivities: skilling.filter((row) => row.recordType === "activity" && rowMatchesRegion(row, region)),
    skillingEquipment: skilling.filter((row) => row.recordType === "equipment" && rowMatchesRegion(row, region)),
    combatAccounts: combat.filter((row) => row.recordType === "account" && rowMatchesRegion(row, region)),
    combatActivities: combat.filter((row) => row.recordType === "activity" && rowMatchesRegion(row, region)),
    combatEquipment: combat.filter((row) => row.recordType === "equipment" && rowMatchesRegion(row, region)),
  };
  const unlocks = {};
  for (const section of [
    "quest_unlocks",
    "ability_unlocks",
    "prayer_unlocks",
    "account_unlocks",
    "activity_unlocks",
    "equipment_models",
    "consumable_unlocks",
  ]) {
    const rows = new Map();
    sourceSection(db, "data/reference/progression-unlocks.json", section).forEach((row, index) =>
      rows.set(rowKey(row, index, "base"), row),
    );
    if (section === "equipment_models") {
      [
        "data/reference/progression-support-items-2026-07-25.json",
        "data/reference/progression-container-bags-2026-07-25.json",
      ].forEach((file) =>
        sourceSection(db, file, section).forEach((row, index) => rows.set(rowKey(row, index, "supplement"), row)),
      );
    }
    unlocks[section] = [...rows.values()].filter((row) => rowMatchesRegion(row, region));
  }
  return { regional, unlocks };
}

function researchExport(db) {
  const raw = (pattern) =>
    db
      .prepare(
        "SELECT record_path, raw_json FROM source_records WHERE source_file = 'data/research/catalog.json' ORDER BY record_path",
      )
      .all()
      .filter(({ record_path }) => pattern.test(record_path))
      .sort((a, b) => {
        const left = Number(a.record_path.match(/\[(\d+)\]$/)?.[1] ?? 0);
        const right = Number(b.record_path.match(/\[(\d+)\]$/)?.[1] ?? 0);
        return left - right;
      })
      .map(({ raw_json }) => JSON.parse(raw_json));
  const regions = raw(/^\$\.regions\[\d+\]$/).filter((region) => region.id);
  const skills = raw(/^\$\.skills\[\d+\]$/).filter((skill) => skill.id && Array.isArray(skill.methods));
  const methods = new Map(skills.flatMap((skill) => skill.methods.map((method) => [method.id, method])));
  const metadata = JSON.parse(
    db.prepare("SELECT metadata_json FROM source_files WHERE path = 'data/research/catalog.json'").get().metadata_json,
  );
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
    snapshotDate: metadata.snapshotDate,
    regions: regionIndex,
    skills: skills.map(({ id, name }) => ({ id, name })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  outputs.set("research/index.json", jsonLine(index));
  return { outputs, index };
}

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

function buildOutputs(db) {
  const outputs = new Map();
  const research = researchExport(db);
  for (const [path, body] of research.outputs) outputs.set(path, body);
  const entities = db
    .prepare(
      "SELECT id, entity_type, name, short_description, detailed_description, confidence, verified_at, status FROM entities ORDER BY entity_type, id",
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
                sources.verified_at AS verifiedAt, sources.confidence, entity_sources.role
         FROM entity_sources JOIN sources ON sources.id = entity_sources.source_id
         ORDER BY entity_sources.entity_id, entity_sources.ordinal, sources.id`,
      )
      .all(),
  );
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    exportVersion: EXPORT_VERSION,
    databaseInputHash: db.prepare("SELECT input_hash FROM transform_runs WHERE name = 'seed-ingest'").get().input_hash,
    recordCount: entities.length,
    domains: {},
    regions: Object.fromEntries(research.index.regions.map((region) => [region.id, region])),
    idIndexes: [],
  };
  const idMap = {};
  for (const domain of [...new Set(entities.map(({ entity_type }) => entity_type))].sort()) {
    const records = entities
      .filter(({ entity_type }) => entity_type === domain)
      .map((entity) => entityExport(entity, regionsByEntity, sourcesByEntity));
    const shards = [];
    for (const [index, chunk] of chunkDomain(domain, records).entries()) {
      const body = jsonLine({ schemaVersion: EXPORT_VERSION, domain, records: chunk });
      const digest = hash(body);
      const path = `domains/${slugify(domain)}-${String(index + 1).padStart(2, "0")}.json`;
      outputs.set(path, body);
      const entry = { href: `/data/v2/${path}`, sha256: digest, bytes: Buffer.byteLength(body), records: chunk.length };
      shards.push(entry);
      for (const record of chunk) idMap[record.id] = entry.href;
    }
    manifest.domains[domain] = { records: records.length, shards };
  }
  let idChunk = {};
  const flushIdChunk = () => {
    const entries = Object.entries(idChunk);
    if (!entries.length) return;
    const body = jsonLine({ schemaVersion: EXPORT_VERSION, ids: idChunk });
    const digest = hash(body);
    const path = `indexes/entities-${String(manifest.idIndexes.length + 1).padStart(2, "0")}.json`;
    outputs.set(path, body);
    manifest.idIndexes.push({
      firstId: entries[0][0],
      lastId: entries.at(-1)[0],
      href: `/data/v2/${path}`,
      sha256: digest,
      bytes: Buffer.byteLength(body),
      records: entries.length,
    });
    idChunk = {};
  };
  for (const [id, href] of Object.entries(idMap).sort(([a], [b]) => a.localeCompare(b))) {
    const candidate = { ...idChunk, [id]: href };
    if (Object.keys(idChunk).length && Buffer.byteLength(jsonLine({ schemaVersion: EXPORT_VERSION, ids: candidate })) > SHARD_TARGET_BYTES) {
      flushIdChunk();
    }
    idChunk[id] = href;
  }
  flushIdChunk();
  for (const region of REGION_IDS) {
    const records = db
      .prepare(
        `SELECT entities.id, entities.entity_type AS type, entities.name, entity_regions.relation
         FROM entity_regions JOIN entities ON entities.id = entity_regions.entity_id
         WHERE entity_regions.region_id = ? ORDER BY entities.entity_type, entities.id`,
      )
      .all(region);
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

function listDiskFiles(root) {
  return walkFiles(root, () => true).map((path) => slash(relative(root, path)));
}

function compareOutputs(outputs) {
  const changed = [];
  const stale = listDiskFiles(EXPORT_ROOT).filter((path) => !outputs.has(path));
  for (const [path, body] of outputs) {
    const destination = join(EXPORT_ROOT, path);
    if (!existsSync(destination) || readFileSync(destination, "utf8") !== body) changed.push(path);
  }
  return { changed, stale };
}

function gitDataStatus() {
  try {
    return execFileSync(
      "git",
      ["status", "--short", "--", "public/data/v2", "reports", "docs/data-catalog.md"],
      { cwd: ROOT, encoding: "utf8" },
    )
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return ["Git status unavailable"];
  }
}

function researchParity(outputs) {
  const catalog = JSON.parse(readFileSync(join(COMPAT_DATA, "research/catalog.json"), "utf8"));
  const methods = new Map(
    asArray(catalog.skills).flatMap((skill) => asArray(skill.methods).map((method) => [method.id, method])),
  );
  const regions = [];
  for (const region of REGION_IDS) {
    const source = asArray(catalog.regions).find(({ id }) => id === region);
    const nextBody = outputs.get(`research/regions/${region}.json`);
    if (!source || !nextBody) {
      regions.push({ region, equal: false, reason: "missing shard" });
      continue;
    }
    const { trainingMethodIds = [], ...base } = source;
    const expected = {
      ...base,
      training: trainingMethodIds.map((id) => methods.get(id)).filter(Boolean),
    };
    const newValue = JSON.parse(nextBody);
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
    ...counts.map(({ entity_type, count }) =>
      `| ${entity_type} | ${count} | ${manifest.domains[entity_type]?.shards.length ?? 0} |`,
    ),
    "",
    "## Normal workflow",
    "",
    "1. `npm run data:find -- --query \"name\"`",
    "2. `npm run data:context -- --id stable:id`",
    "3. `npm run data:impact -- --id stable:id`",
    "4. Add one JSONL operation under `data/patches/`.",
    "5. `npm run data:apply -- data/patches/file.jsonl`",
    "6. `npm run data:validate:changed && npm run data:export:changed`",
    "",
    "Schema: [`data/migrations/001-data-core.sql`](../data/migrations/001-data-core.sql). Architecture: [`docs/data-platform.md`](data-platform.md).",
    "",
  ];
  atomicWrite(join(ROOT, "docs/data-catalog.md"), lines.join("\n"));
}

function exportData(db, checkOnly = false) {
  const { outputs, manifest } = buildOutputs(db);
  const parity = researchParity(outputs);
  const mismatch = parity.filter(({ equal }) => !equal);
  const comparison = compareOutputs(outputs);
  const oversized = [...outputs].filter(([, body]) => Buffer.byteLength(body) > 500 * 1024);
  if (oversized.length) {
    throw new Error(`Frontend shards exceed 500 KiB: ${oversized.map(([path]) => path).join(", ")}`);
  }
  const parityReport = {
    schemaVersion: SCHEMA_VERSION,
    researchRegions: parity,
    exactRegionParity: mismatch.length === 0,
    entityCounts: Object.fromEntries(
      db
        .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
        .all()
        .map(({ entity_type, count }) => [entity_type, Number(count)]),
    ),
    explicitSeedIds: Number(
      db.prepare("SELECT count(DISTINCT stable_id) AS count FROM source_records WHERE stable_id IS NOT NULL").get().count,
    ),
    mappedSeedRecords: Number(
      db.prepare("SELECT count(*) AS count FROM source_records WHERE entity_id IS NOT NULL").get().count,
    ),
    quarantinedRecords: Number(db.prepare("SELECT count(*) AS count FROM quarantine").get().count),
    unmappedStableRecordsWithoutQuarantine: Number(
      db
        .prepare(
          `SELECT count(*) AS count FROM source_records
           WHERE stable_id IS NOT NULL AND entity_id IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM quarantine
               WHERE quarantine.source_file = source_records.source_file
                 AND quarantine.record_path = source_records.record_path
             )`,
        )
        .get().count,
    ),
    sourceUrls: Number(db.prepare("SELECT count(*) AS count FROM sources").get().count),
    relationships: Number(db.prepare("SELECT count(*) AS count FROM relationships").get().count),
    crossRegionEntities: Number(
      db
        .prepare(
          `SELECT count(*) AS count FROM (
             SELECT entity_id FROM entity_regions WHERE relation = 'required'
             GROUP BY entity_id HAVING count(DISTINCT region_id) > 1
           )`,
        )
        .get().count,
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
      [...DOMAIN_TABLES].map(([domain, table]) => [
        domain,
        Number(db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count),
      ]),
    ),
    representativeIds: Object.fromEntries(
      [
        "item:seismic-wand",
        "magic:sonic-wave",
        "prayer:clarity-of-thought",
        "perk:biting",
        "wiki:462",
      ].map((id) => [id, Boolean(db.prepare("SELECT 1 FROM entities WHERE id = ?").get(id))]),
    ),
  };
  mkdirSync(REPORTS, { recursive: true });
  atomicWrite(join(REPORTS, "data-migration-parity.json"), `${JSON.stringify(parityReport, null, 2)}\n`);
  if (mismatch.length) throw new Error(`Research compatibility parity failed: ${mismatch.map(({ region }) => region).join(", ")}`);
  if (checkOnly) return { ...comparison, written: [] };
  mkdirSync(EXPORT_ROOT, { recursive: true });
  for (const path of comparison.stale) rmSync(join(EXPORT_ROOT, path), { force: true });
  for (const path of comparison.changed) atomicWrite(join(EXPORT_ROOT, path), outputs.get(path));
  writeCatalog(db, manifest);
  recordTransform(db, TRANSFORMS[4], hash(outputs.get("manifest.json")), manifest.recordCount);
  return { ...comparison, written: comparison.changed };
}

function cleanDatabase() {
  mkdirSync(CACHE, { recursive: true });
  const resolved = resolve(DATABASE);
  if (dirname(resolved) !== resolve(CACHE) || basename(resolved) !== "equilibrium.sqlite") {
    throw new Error(`Refusing to remove unexpected database path: ${resolved}`);
  }
  rmSync(resolved, { force: true });
  rmSync(`${resolved}-shm`, { force: true });
  rmSync(`${resolved}-wal`, { force: true });
}

function rebuild(log = true) {
  const start = process.hrtime.bigint();
  const before = process.resourceUsage();
  cleanDatabase();
  const db = openDatabase(DATABASE, false);
  try {
    const migrations = migrate(db);
    const ingest = importSeed(db);
    const changed = applyAllPatches(db);
    materializeCompatibilityData(db);
    rebuildSearch(db);
    const validation = validate(db);
    const exported = exportData(db);
    writeChanged(db, changed);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const usage = process.resourceUsage();
    const result = {
      migrations,
      inputFiles: ingest.files,
      inputBytes: ingest.bytes,
      entities: Object.values(validation.counts).reduce((sum, count) => sum + count, 0),
      changedPatchEntities: changed.size,
      exportedFiles: exported.written.length,
      elapsedMs: Number(elapsedMs.toFixed(1)),
      maxRssBytes: Math.max(before.maxRSS, usage.maxRSS) * 1024,
    };
    if (log) console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    db.close();
  }
}

function benchmark() {
  const full = rebuild(false);
  const db = openDatabase();
  const showStart = process.hrtime.bigint();
  const shown = entityContext(db, "item:seismic-wand");
  const showMs = Number(process.hrtime.bigint() - showStart) / 1e6;
  const showBody = formatContextMarkdown(shown);
  const training = db
    .prepare(
      `SELECT training_methods.entity_id, entity_regions.region_id, entity_regions.relation
       FROM training_methods JOIN entity_regions ON entity_regions.entity_id = training_methods.entity_id
       WHERE entity_regions.region_id != 'global' ORDER BY training_methods.entity_id LIMIT 1`,
    )
    .get();
  const trainingRegion = REGION_IDS.find((region) => region !== training.region_id);
  const regionStart = process.hrtime.bigint();
  const regionRows = db
    .prepare(
      `SELECT entities.id, entities.entity_type AS type, entities.name, entity_regions.relation
       FROM entity_regions JOIN entities ON entities.id = entity_regions.entity_id
       WHERE entity_regions.region_id = ? ORDER BY entities.entity_type, entities.id`,
    )
    .all("asgarnia");
  const regionBody = jsonLine({ schemaVersion: EXPORT_VERSION, region: "asgarnia", records: regionRows });
  const regionMs = Number(process.hrtime.bigint() - regionStart) / 1e6;
  db.close();

  const scoped = (name, lines) => {
    const copy = join(CACHE, `benchmark-${slugify(name)}.sqlite`);
    const patch = join(CACHE, `benchmark-${slugify(name)}.jsonl`);
    rmSync(copy, { force: true });
    copyFileSync(DATABASE, copy);
    const body = `${lines.join("\n")}\n`;
    writeFileSync(patch, body);
    const start = process.hrtime.bigint();
    const bench = openDatabase(copy);
    try {
      const changedEntities = applyPatch(bench, patch);
      const foreignKeyFailures = bench.prepare("PRAGMA foreign_key_check").all();
      if (foreignKeyFailures.length) throw new Error(`${name}: benchmark patch broke foreign keys`);
      const built = buildOutputs(bench);
      const difference = compareOutputs(built.outputs);
      return {
        name,
        elapsedMs: Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(2)),
        changedEntities: changedEntities.size,
        filesRead: 2,
        bytesRead: statSync(copy).size + Buffer.byteLength(body),
        filesRewritten: difference.changed.length,
        bytesRewritten: difference.changed.reduce(
          (sum, path) => sum + Buffer.byteLength(built.outputs.get(path) ?? ""),
          0,
        ),
        changedFiles: difference.changed,
      };
    } finally {
      bench.close();
      rmSync(copy, { force: true });
      rmSync(patch, { force: true });
    }
  };

  const scenarios = [
    scoped("equipment source", [
      JSON.stringify({
        op: "upsert-source",
        source: "source:runescape-wiki:3b4c5ed6fefa9e18",
        set: { page_title: "Seismic wand benchmark" },
      }),
    ]),
    scoped("training region", [
      JSON.stringify({
        op: "unlink-region",
        entity: training.entity_id,
        region: training.region_id,
        relation: training.relation,
      }),
      JSON.stringify({
        op: "link-region",
        entity: training.entity_id,
        region: trainingRegion,
        relation: "required",
      }),
    ]),
    scoped("cross region", [
      JSON.stringify({
        op: "link-region",
        entity: "item:seismic-wand",
        region: "tirannwn",
        relation: "required",
        group: "all_required",
      }),
    ]),
  ];
  const lines = [
    "# Data platform benchmark",
    "",
    "Measured locally on 2026-07-29 with Node " + process.version + ". Values are produced by `npm run data:benchmark`; no timings are estimated.",
    "",
    "| Scenario | Time | Data files read | Input bytes | Files rewritten | Bytes rewritten |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| Show one equipment item | ${showMs.toFixed(2)} ms | 1 | ${statSync(DATABASE).size} | 0 | 0 |`,
    ...scenarios.map(
      (scenario) =>
        `| ${scenario.name} patch + scoped export diff | ${scenario.elapsedMs.toFixed(2)} ms | ${scenario.filesRead} | ${scenario.bytesRead} | ${scenario.filesRewritten} | ${scenario.bytesRewritten} |`,
    ),
    `| Rebuild one Asgarnia region payload (${regionRows.length} records) | ${regionMs.toFixed(2)} ms | 1 | ${statSync(DATABASE).size} | 1 | ${Buffer.byteLength(regionBody)} |`,
    `| Full clean rebuild | ${full.elapsedMs.toFixed(2)} ms | ${full.inputFiles} | ${full.inputBytes} | ${full.exportedFiles + 1} | ${statSync(DATABASE).size} |`,
    "",
    `Peak RSS during the full rebuild was ${(full.maxRssBytes / 1024 / 1024).toFixed(1)} MiB. The clean rebuild regenerated the ignored SQLite file; unchanged frontend artifacts were byte-compared and not rewritten.`,
    "",
    `The representative equipment correction requires ${showBody.split(/\r?\n/).length + 1} lines of bounded context plus one JSONL patch line.`,
    "",
    "Scoped patch details:",
    "",
    ...scenarios.map(
      (scenario) =>
        `- ${scenario.name}: ${scenario.changedEntities} affected entities; ${scenario.changedFiles.join(", ") || "no frontend payload change"}.`,
    ),
    "",
  ];
  atomicWrite(join(REPORTS, "data-platform-benchmark.md"), lines.join("\n"));
  return { full, showMs: Number(showMs.toFixed(2)), regionMs: Number(regionMs.toFixed(2)), scenarios };
}

function getArg(name, fallback = null) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function boundedPrint(value, maxBytes = DEFAULT_MAX_BYTES) {
  const body = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(body) <= maxBytes) {
    process.stdout.write(body);
    return;
  }
  const suffix = `\n... truncated at ${maxBytes} bytes; narrow the query or raise --max-bytes.\n`;
  process.stdout.write(`${body.slice(0, Math.max(0, maxBytes - Buffer.byteLength(suffix)))}${suffix}`);
}

function entityContext(db, id, maxRelated = 30) {
  const entity = db.prepare("SELECT * FROM entities WHERE id = ?").get(id);
  if (!entity) throw new Error(`Entity not found: ${id}`);
  const select = (sql, ...params) => db.prepare(sql).all(...params);
  return {
    entity: { ...entity, extra_json: JSON.parse(entity.extra_json) },
    regions: select(
      "SELECT region_id, relation, ordinal, requirement_group FROM entity_regions WHERE entity_id = ? ORDER BY relation, ordinal, region_id",
      id,
    ),
    requirements: select(
      "SELECT kind, skill, level, target_entity_id, description, ordinal FROM requirements WHERE entity_id = ? ORDER BY ordinal",
      id,
    ),
    effects: select(
      "SELECT effect_key, description, value_text, ordinal FROM effects WHERE entity_id = ? ORDER BY ordinal",
      id,
    ),
    related: select(
      `SELECT 'outgoing' AS direction, predicate, object_id AS id FROM relationships WHERE subject_id = ?
       UNION ALL
       SELECT 'incoming', predicate, subject_id FROM relationships WHERE object_id = ?
       ORDER BY direction, predicate, id LIMIT ?`,
      id,
      id,
      maxRelated,
    ),
    sources: select(
      `SELECT sources.*, entity_sources.role, entity_sources.ordinal
       FROM entity_sources JOIN sources ON sources.id = entity_sources.source_id
       WHERE entity_sources.entity_id = ? ORDER BY entity_sources.ordinal, sources.id`,
      id,
    ),
    responsibility: select(
      "SELECT source_file, record_path, record_hash FROM source_records WHERE entity_id = ? ORDER BY source_file, record_path",
      id,
    ),
    patches: select(
      `SELECT patch_ledger.filename, patch_ledger.content_hash, patch_changes.operation, patch_changes.line
       FROM patch_changes JOIN patch_ledger ON patch_ledger.patch_id = patch_changes.patch_id
       WHERE patch_changes.entity_id = ? ORDER BY patch_ledger.filename, patch_changes.line`,
      id,
    ),
  };
}

function formatContextMarkdown(context) {
  const lines = [
    `# ${context.entity.name}`,
    "",
    `- ID: \`${context.entity.id}\``,
    `- Type: ${context.entity.entity_type}`,
    `- Status: ${context.entity.status}`,
    `- Confidence: ${context.entity.confidence}`,
    `- Regions: ${context.regions.map(({ region_id, relation }) => `${region_id} (${relation})`).join(", ") || "none"}`,
    "",
    context.entity.detailed_description || context.entity.short_description || "No description.",
    "",
    "## Sources",
    "",
    ...context.sources.map((source) => `- ${source.id}: ${source.url} (${source.role})`),
    "",
    "## Requirements and effects",
    "",
    ...context.requirements.map((row) => `- Requires: ${row.description}`),
    ...context.effects.map((row) => `- Effect: ${row.description}`),
    "",
    "## Responsibility",
    "",
    ...context.responsibility.map((row) => `- ${row.source_file} ${row.record_path}`),
    ...context.patches.map((row) => `- ${row.filename}:${row.line} (${row.operation})`),
    "",
  ];
  return lines.join("\n");
}

function findEntities(db) {
  const query = scalar(getArg("query")).trim();
  if (!query) throw new Error("--query is required");
  const limit = Math.min(Number(getArg("limit", DEFAULT_LIMIT)) || DEFAULT_LIMIT, 100);
  const fts = query
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean)
    .map((part) => `"${part}"*`)
    .join(" AND ");
  if (!fts) throw new Error("Query has no searchable characters");
  return db
    .prepare(
      `SELECT entities.id, entities.entity_type AS type, entities.name, entities.status,
              (SELECT group_concat(region_id)
               FROM (SELECT DISTINCT region_id FROM entity_regions WHERE entity_id = entities.id ORDER BY region_id)) AS regions,
              (SELECT sources.url
               FROM entity_sources JOIN sources ON sources.id = entity_sources.source_id
               WHERE entity_sources.entity_id = entities.id
               ORDER BY entity_sources.ordinal, sources.id LIMIT 1) AS bestSource
       FROM entity_search JOIN entities ON entities.id = entity_search.id
       WHERE entity_search MATCH ?
       ORDER BY bm25(entity_search), entities.name
       LIMIT ?`,
    )
    .all(fts, limit);
}

function runReadOnlyQuery(db) {
  let sql = scalar(getArg("sql")).trim();
  if (!sql) throw new Error("--sql is required");
  sql = sql.replace(/;\s*$/, "");
  if (sql.includes(";")) throw new Error("Multiple SQL statements are not allowed");
  if (!/^\s*(select|with)\b/i.test(sql)) throw new Error("Only SELECT and read-only WITH queries are allowed");
  if (/\b(insert|update|delete|drop|alter|attach|detach|vacuum|reindex|replace|create|pragma)\b/i.test(sql)) {
    throw new Error("Write-capable SQL and PRAGMA are blocked; use a validated content patch");
  }
  const limit = Math.min(Number(getArg("limit", 100)) || 100, 1000);
  db.exec("PRAGMA query_only = ON");
  return db.prepare(`SELECT * FROM (${sql}) AS bounded_query LIMIT ${limit}`).all();
}

function doctor(db) {
  const version = db.prepare("SELECT sqlite_version() AS version").get().version;
  const fts5 = Number(
    db.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled").get().enabled,
  );
  const currentHashes = new Map(seedDocuments().map(({ file, text }) => [file, hash(text)]));
  const stale = db
    .prepare("SELECT path, content_hash FROM source_files ORDER BY path")
    .all()
    .filter(({ path, content_hash }) => currentHashes.get(path) !== content_hash)
    .map(({ path }) => path);
  const diff = compareOutputs(buildOutputs(db).outputs);
  const patchDrift = db
    .prepare("SELECT filename, content_hash FROM patch_ledger ORDER BY filename")
    .all()
    .filter(({ filename, content_hash }) => {
      const path = join(PATCHES, filename);
      return !existsSync(path) || hash(readFileSync(path)) !== content_hash;
    })
    .map(({ filename }) => filename);
  const result = {
    node: process.version,
    sqlite: version,
    foreignKeys: Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys) === 1,
    fts5: Boolean(fts5),
    schemaVersion: Number(db.prepare("SELECT max(version) AS version FROM schema_migrations").get().version),
    staleInputs: stale,
    staleExports: [...diff.changed, ...diff.stale],
    patchDrift,
    ok:
      !stale.length &&
      !diff.changed.length &&
      !diff.stale.length &&
      !patchDrift.length &&
      Boolean(fts5),
  };
  if (!result.ok) process.exitCode = 1;
  return result;
}

function stats(db) {
  return {
    database: slash(relative(ROOT, DATABASE)),
    bytes: statSync(DATABASE).size,
    entities: Object.fromEntries(
      db
        .prepare("SELECT entity_type, count(*) AS count FROM entities GROUP BY entity_type ORDER BY entity_type")
        .all()
        .map(({ entity_type, count }) => [entity_type, Number(count)]),
    ),
    sources: Number(db.prepare("SELECT count(*) AS count FROM sources").get().count),
    relationships: Number(db.prepare("SELECT count(*) AS count FROM relationships").get().count),
    regionLinks: Number(db.prepare("SELECT count(*) AS count FROM entity_regions").get().count),
    mapPoints: Number(db.prepare("SELECT count(*) AS count FROM map_points").get().count),
    patches: Number(db.prepare("SELECT count(*) AS count FROM patch_ledger").get().count),
    quarantine: Number(db.prepare("SELECT count(*) AS count FROM quarantine").get().count),
  };
}

function applyOne(pathArg) {
  const path = resolve(ROOT, pathArg);
  const patchRelative = relative(resolve(PATCHES), path);
  if (patchRelative.startsWith("..") || resolve(PATCHES, patchRelative) !== path || extname(path) !== ".jsonl") {
    throw new Error("Patch must be a .jsonl file inside data/patches/");
  }
  const db = openDatabase();
  try {
    const changed = applyPatch(db, path, false);
    materializeCompatibilityData(db);
    rebuildSearch(db);
    writeChanged(db, changed);
    const validation = validate(db, true);
    const exported = exportData(db);
    return { patch: slash(relative(ROOT, path)), changed: [...changed].sort(), validation: validation.valid, written: exported.written };
  } finally {
    db.close();
  }
}

function command() {
  const name = process.argv[2] ?? "help";
  if (name === "rebuild") return rebuild();
  if (name === "benchmark") return benchmark();
  if (name === "migrate") {
    mkdirSync(CACHE, { recursive: true });
    const db = openDatabase(DATABASE, false);
    try {
      return { migrations: migrate(db), database: slash(relative(ROOT, DATABASE)) };
    } finally {
      db.close();
    }
  }
  if (name === "import") return rebuild();
  if (name === "apply") {
    const path = process.argv.find((arg, index) => index > 2 && !arg.startsWith("--"));
    if (!path) throw new Error("Patch path is required");
    return applyOne(path);
  }
  const db = openDatabase();
  try {
    const maxBytes = Math.max(1000, Number(getArg("max-bytes", DEFAULT_MAX_BYTES)) || DEFAULT_MAX_BYTES);
    if (name === "stats") return boundedPrint(stats(db), maxBytes);
    if (name === "find") return boundedPrint(findEntities(db), maxBytes);
    if (["show", "context", "related", "sources", "impact"].includes(name)) {
      const id = scalar(getArg("id"));
      if (!id) throw new Error("--id is required");
      const context = entityContext(db, id, Math.min(Number(getArg("max-related", 30)) || 30, 100));
      if (name === "show") {
        return boundedPrint(
          {
            entity: context.entity,
            regions: context.regions,
            requirements: context.requirements,
            effects: context.effects,
            sources: context.sources,
          },
          maxBytes,
        );
      }
      if (name === "related") return boundedPrint(context.related, maxBytes);
      if (name === "sources") return boundedPrint(context.sources, maxBytes);
      if (name === "impact") {
        return boundedPrint(
          {
            entity: { id, type: context.entity.entity_type, name: context.entity.name },
            relationships: context.related,
            regions: context.regions.map(({ region_id }) => `/data/v2/regions/${region_id}.json`),
            domain: context.entity.entity_type,
            frontendShard: buildOutputs(db).idMap[id] ?? null,
            sources: context.sources.map(({ id: sourceId }) => sourceId),
            responsibility: context.responsibility,
            validation: ["foreign keys", "source URLs", "region taxonomy", "search index", "seed parity"],
          },
          maxBytes,
        );
      }
      return boundedPrint(
        getArg("format", "json") === "markdown" ? formatContextMarkdown(context) : context,
        maxBytes,
      );
    }
    if (name === "query") return boundedPrint(runReadOnlyQuery(db), maxBytes);
    if (name === "validate") return boundedPrint(validate(db, hasArg("changed")), maxBytes);
    if (name === "export") return boundedPrint(exportData(db), maxBytes);
    if (name === "diff") {
      return boundedPrint(
        { generated: compareOutputs(buildOutputs(db).outputs), git: gitDataStatus() },
        maxBytes,
      );
    }
    if (name === "doctor") return boundedPrint(doctor(db), maxBytes);
    if (name === "transforms") return boundedPrint(TRANSFORMS, maxBytes);
    throw new Error(`Unknown data command: ${name}`);
  } finally {
    db.close();
  }
}

try {
  const result = command();
  if (result !== undefined && !["rebuild", "stats", "find", "show", "context", "related", "sources", "impact", "query", "validate", "export", "diff", "doctor", "transforms"].includes(process.argv[2])) {
    boundedPrint(result, Number(getArg("max-bytes", DEFAULT_MAX_BYTES)) || DEFAULT_MAX_BYTES);
  }
} catch (error) {
  console.error(`data:${process.argv[2] ?? "unknown"}: ${error.message}`);
  process.exitCode = 1;
}
