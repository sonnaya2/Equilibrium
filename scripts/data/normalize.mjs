import { basename } from "node:path";
import { REGION_ALIASES, REGION_SET } from "./config.mjs";
import { prepared } from "./database.mjs";
import { asArray, hash, parseBoolean, scalar, slugify, stableJson } from "./utilities.mjs";

// The seed consolidates documents written over two years with no shared schema,
// so a record's domain is resolved from its file, its key path and its own hints
// before falling back to loose keyword matching.
export function typeFor(file, key, row, path) {
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

export function recordName(row) {
  return [row.name, row.title, row.method, row.quest, row.tool, row.perk, row.component, row.collection, row.summary]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}

export function entityCandidate(file, record) {
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

export function normalizeRegion(value) {
  const raw = scalar(value).trim();
  if (!raw) return null;
  const slug = slugify(raw);
  return REGION_ALIASES.get(raw.toLowerCase()) ?? REGION_ALIASES.get(slug) ?? (REGION_SET.has(slug) ? slug : null);
}

export function regionLinks(row) {
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

export function sourceObjects(value) {
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

export function sourceFamily(source) {
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

export function entityFields(candidate, row, file) {
  const short = scalar(row.displayDescription ?? row.summary ?? row.note ?? row.warning);
  const detail = scalar(row.detail ?? row.description ?? row.league_treatment ?? row.purpose, short);
  // A skill's methods become their own entities, so they are not duplicated here.
  const extra =
    candidate.type === "skill"
      ? Object.fromEntries(Object.entries(row).filter(([key]) => key !== "methods"))
      : row;
  return {
    id: candidate.id,
    slug: slugify(candidate.id),
    type: candidate.type,
    name: candidate.name,
    short,
    detail,
    verifiedAt: scalar(row.verifiedAt ?? row.verified_at ?? row.snapshotDate ?? row.snapshot_date) || null,
    status: scalar(row.status, "active"),
    sortKey: scalar(row.sortKey ?? row.sort_key, candidate.name.toLocaleLowerCase("en")),
    file,
    extra: stableJson(extra),
  };
}

export function quarantine(db, { file, path, stableId, error, conflicting = null, resolution, raw }) {
  prepared(
    db,
    `INSERT OR IGNORE INTO quarantine
     (source_file, record_path, stable_id, error, conflicting_record, suggested_resolution, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(file, path, stableId, error, conflicting, resolution, raw);
}

export function insertEntity(db, fields, record) {
  const existing = prepared(db, "SELECT id, entity_type, name FROM entities WHERE id = ?").get(fields.id);
  if (existing) {
    if (
      existing.entity_type === fields.type &&
      existing.name.toLocaleLowerCase("en") === fields.name.toLocaleLowerCase("en")
    ) {
      return fields.id;
    }
    quarantine(db, {
      file: fields.file,
      path: record.path,
      stableId: fields.id,
      error: `Stable ID conflicts with ${existing.entity_type}:${existing.name}`,
      conflicting: stableJson(existing),
      resolution: "Resolve the seed ID collision with an explicit content patch; no fuzzy merge was attempted.",
      raw: fields.extra,
    });
    return null;
  }
  prepared(
    db,
    `INSERT INTO entities
     (id, slug, entity_type, name, short_description, detailed_description, verified_at,
      status, sort_key, created_source, updated_source, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    fields.id,
    fields.slug,
    fields.type,
    fields.name,
    fields.short,
    fields.detail,
    fields.verifiedAt,
    fields.status,
    fields.sortKey,
    fields.file,
    fields.file,
    fields.extra,
  );
  return fields.id;
}

export function linkSource(db, entityId, source, ordinal, context) {
  let parsed;
  try {
    parsed = new URL(source.url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("URL must use HTTP or HTTPS");
  } catch (error) {
    quarantine(db, {
      file: context.file,
      path: context.path,
      stableId: entityId,
      error: `Invalid source URL: ${source.url} (${error.message})`,
      resolution: "Correct the URL in a content patch.",
      raw: stableJson(context.row),
    });
    return;
  }
  const url = parsed.href;
  const family = sourceFamily({ ...source, url });
  const existing = prepared(db, "SELECT id FROM sources WHERE url = ?").get(url);
  const sourceId = existing?.id ?? `source:${family}:${hash(url).slice(0, 16)}`;
  prepared(
    db,
    `INSERT OR IGNORE INTO sources
     (id, url, page_title, publisher, source_family, verified_at, retrieved_at, source_role, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sourceId,
    url,
    scalar(source.title ?? source.page_title),
    scalar(source.publisher ?? source.source),
    family,
    scalar(source.verifiedAt ?? source.verified_at) || null,
    scalar(source.retrievedAt ?? source.retrieved_at) || null,
    scalar(source.role, "verification"),
    scalar(source.content_hash) || null,
  );
  prepared(db, "INSERT OR IGNORE INTO entity_sources(entity_id, source_id, role, ordinal) VALUES (?, ?, ?, ?)").run(
    entityId,
    sourceId,
    scalar(source.role, "verification"),
    ordinal,
  );
}

export function addRequirements(db, entityId, row) {
  const values = [...asArray(row.requirements), ...asArray(row.access_requirements)];
  if (row.unlock?.requirement) values.push(row.unlock.requirement);
  values.forEach((value, ordinal) => {
    const description = typeof value === "string" ? value : stableJson(value);
    if (!description) return;
    const levelMatch = description.match(/\b(\d{1,3})\b/);
    prepared(
      db,
      `INSERT OR IGNORE INTO requirements
       (entity_id, kind, skill, level, target_entity_id, description, ordinal)
       VALUES (?, 'text', NULL, ?, NULL, ?, ?)`,
    ).run(entityId, levelMatch ? Number(levelMatch[1]) : null, description, ordinal);
  });
}

export function addEffects(db, entityId, row) {
  [...asArray(row.effects), ...asArray(row.facts)].forEach((value, ordinal) => {
    const description = typeof value === "string" ? value : stableJson(value);
    if (!description) return;
    prepared(
      db,
      `INSERT OR IGNORE INTO effects
       (entity_id, effect_key, description, value_text, ordinal, metadata_json)
       VALUES (?, ?, ?, '', ?, '{}')`,
    ).run(entityId, `effect-${ordinal + 1}`, description, ordinal);
  });
}

export function addTags(db, entityId, row) {
  const values = [row.style, row.category, row.skill, ...asArray(row.target_tags), ...asArray(row.tags)];
  [...new Set(values.filter((value) => typeof value === "string" && value.trim()))].forEach((value) => {
    const id = slugify(value);
    prepared(db, "INSERT OR IGNORE INTO tags(id, name) VALUES (?, ?)").run(id, value.trim());
    prepared(db, "INSERT OR IGNORE INTO entity_tags(entity_id, tag_id) VALUES (?, ?)").run(entityId, id);
  });
}

const numeric = (value) => (Number.isFinite(value) ? value : null);

const DOMAIN_WRITERS = new Map([
  [
    "equipment",
    (db, entityId, row) => {
      prepared(
        db,
        "INSERT OR IGNORE INTO equipment(entity_id, style, slot, tier, category) VALUES (?, ?, ?, ?, ?)",
      ).run(entityId, scalar(row.style), scalar(row.slot), numeric(row.tier), scalar(row.category));
      for (const [stat, value] of Object.entries(row.bonuses ?? {})) {
        if (typeof value === "number") {
          prepared(db, "INSERT OR IGNORE INTO equipment_stats(entity_id, stat, value) VALUES (?, ?, ?)").run(
            entityId,
            stat,
            value,
          );
        }
      }
    },
  ],
  [
    "ability",
    (db, entityId, row) =>
      prepared(
        db,
        "INSERT OR IGNORE INTO abilities(entity_id, style, category, level, cooldown_ticks) VALUES (?, ?, ?, ?, ?)",
      ).run(entityId, scalar(row.style), scalar(row.category), numeric(row.level), numeric(row.cooldownTicks)),
  ],
  [
    "prayer",
    (db, entityId, row) =>
      prepared(db, "INSERT OR IGNORE INTO prayers(entity_id, book, level) VALUES (?, ?, ?)").run(
        entityId,
        scalar(row.book ?? row.book_type),
        numeric(row.level ?? row.prayer_requirement),
      ),
  ],
  [
    "spell",
    (db, entityId, row) =>
      prepared(db, "INSERT OR IGNORE INTO spells(entity_id, spellbook, level) VALUES (?, ?, ?)").run(
        entityId,
        scalar(row.spellbook ?? row.book ?? row.book_type),
        numeric(row.level),
      ),
  ],
  [
    "invention-perk",
    (db, entityId, row) =>
      prepared(db, "INSERT OR IGNORE INTO invention_perks(entity_id, max_rank, category) VALUES (?, ?, ?)").run(
        entityId,
        numeric(row.maxRank),
        scalar(row.category),
      ),
  ],
  [
    "activity",
    (db, entityId, row) =>
      prepared(db, "INSERT OR IGNORE INTO activities(entity_id, category, location) VALUES (?, ?, ?)").run(
        entityId,
        scalar(row.category),
        scalar(row.location),
      ),
  ],
  [
    "unlock",
    (db, entityId, row) =>
      prepared(db, "INSERT OR IGNORE INTO unlocks(entity_id, category, unlock_type) VALUES (?, ?, ?)").run(
        entityId,
        scalar(row.category),
        scalar(row.type ?? row.recordType),
      ),
  ],
  [
    "task",
    (db, entityId, row) =>
      prepared(
        db,
        "INSERT OR IGNORE INTO tasks(entity_id, tier, points, region_id, source_league) VALUES (?, ?, ?, ?, ?)",
      ).run(
        entityId,
        scalar(row.tier),
        numeric(row.points),
        normalizeRegion(row.regionId ?? row.region),
        scalar(row.sourceLeague),
      ),
  ],
  [
    "quest",
    (db, entityId, row) =>
      prepared(
        db,
        "INSERT OR IGNORE INTO quests(entity_id, quest_type, series, primary_region_id, members, release_date) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        entityId,
        scalar(row.quest_type),
        scalar(row.series),
        normalizeRegion(row.primary_region),
        parseBoolean(row.members),
        scalar(row.release),
      ),
  ],
  [
    "training-method",
    (db, entityId, row) =>
      prepared(
        db,
        `INSERT OR IGNORE INTO training_methods
         (entity_id, skill, level_range, xp_rate, intensity, location, hard_region_requirement)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        entityId,
        scalar(row.skill),
        scalar(row.levelRange ?? row.level_range),
        scalar(row.xpRate ?? row.xp_rate),
        scalar(row.intensity),
        scalar(row.location),
        row.hardRegionRequirement ?? row.hard_region_requirement ? 1 : 0,
      ),
  ],
  [
    "effect",
    (db, entityId, row, extra) =>
      prepared(
        db,
        "INSERT OR IGNORE INTO effects(entity_id, effect_key, description, value_text, ordinal, metadata_json) VALUES (?, 'record', ?, '', 0, ?)",
      ).run(entityId, scalar(row.displayDescription ?? row.description ?? row.name), extra),
  ],
]);

export function addDomainRow(db, entityId, type, row) {
  DOMAIN_WRITERS.get(type)?.(db, entityId, row, stableJson(row));
}

export function addRegions(db, entityId, row) {
  for (const link of regionLinks(row)) {
    prepared(
      db,
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
