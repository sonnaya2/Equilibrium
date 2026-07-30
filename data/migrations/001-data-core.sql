PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE transform_runs (
  name TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version > 0),
  stage TEXT NOT NULL CHECK (stage IN ('ingest', 'normalize', 'enrich', 'validate', 'export')),
  input_hash TEXT NOT NULL,
  output_count INTEGER NOT NULL CHECK (output_count >= 0),
  completed_at TEXT NOT NULL
) STRICT;

CREATE TABLE source_files (
  path TEXT PRIMARY KEY,
  classification TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK (bytes >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(metadata_json))
) STRICT;

CREATE TABLE entities (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 240),
  slug TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  short_description TEXT NOT NULL DEFAULT '',
  detailed_description TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT 'unspecified',
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_key TEXT NOT NULL,
  created_source TEXT NOT NULL,
  updated_source TEXT NOT NULL,
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json)),
  UNIQUE (entity_type, slug)
) STRICT;

CREATE INDEX entities_type_name ON entities(entity_type, name COLLATE NOCASE);
CREATE INDEX entities_status ON entities(status);

CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  availability TEXT NOT NULL DEFAULT 'unknown',
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  taxonomy_order INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE CHECK (url GLOB 'https://*' OR url GLOB 'http://*'),
  page_title TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  source_family TEXT NOT NULL,
  verified_at TEXT,
  retrieved_at TEXT,
  confidence TEXT NOT NULL DEFAULT 'unspecified',
  source_role TEXT NOT NULL DEFAULT 'reference',
  content_hash TEXT
) STRICT;

CREATE INDEX sources_family ON sources(source_family);

CREATE TABLE entity_sources (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'verification',
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  PRIMARY KEY (entity_id, source_id, role)
) STRICT;

CREATE TABLE aliases (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL COLLATE NOCASE,
  kind TEXT NOT NULL DEFAULT 'name',
  PRIMARY KEY (entity_id, alias)
) STRICT;

CREATE INDEX aliases_lookup ON aliases(alias);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
) STRICT;

CREATE TABLE entity_tags (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_id, tag_id)
) STRICT;

CREATE TABLE entity_regions (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  relation TEXT NOT NULL CHECK (relation IN ('primary', 'required', 'optional', 'hint', 'excluded', 'global')),
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  requirement_group TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (entity_id, region_id, relation)
) STRICT;

CREATE INDEX entity_regions_region ON entity_regions(region_id, relation);

CREATE TABLE relationships (
  subject_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  object_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(metadata_json)),
  PRIMARY KEY (subject_id, predicate, object_id)
) STRICT;

CREATE INDEX relationships_object ON relationships(object_id, predicate);

CREATE TABLE requirements (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text',
  skill TEXT,
  level INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 200),
  target_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  UNIQUE (entity_id, kind, description)
) STRICT;

CREATE TABLE effects (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  effect_key TEXT NOT NULL,
  description TEXT NOT NULL,
  value_text TEXT NOT NULL DEFAULT '',
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(metadata_json)),
  UNIQUE (entity_id, effect_key, ordinal)
) STRICT;

CREATE TABLE quests (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  quest_type TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  primary_region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  members INTEGER CHECK (members IS NULL OR members IN (0, 1)),
  release_date TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE tasks (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT '',
  points INTEGER CHECK (points IS NULL OR points >= 0),
  region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  source_league TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE training_methods (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  skill TEXT NOT NULL DEFAULT '',
  level_range TEXT NOT NULL DEFAULT '',
  xp_rate TEXT NOT NULL DEFAULT '',
  intensity TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  hard_region_requirement INTEGER NOT NULL DEFAULT 0 CHECK (hard_region_requirement IN (0, 1)),
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE equipment (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  style TEXT NOT NULL DEFAULT '',
  slot TEXT NOT NULL DEFAULT '',
  tier INTEGER CHECK (tier IS NULL OR tier BETWEEN 0 AND 200),
  category TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE equipment_stats (
  entity_id TEXT NOT NULL REFERENCES equipment(entity_id) ON DELETE CASCADE,
  stat TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (entity_id, stat)
) STRICT;

CREATE TABLE abilities (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  style TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  level INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 200),
  cooldown_ticks INTEGER CHECK (cooldown_ticks IS NULL OR cooldown_ticks >= 0),
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE prayers (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  book TEXT NOT NULL DEFAULT '',
  level INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 200),
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE spells (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  spellbook TEXT NOT NULL DEFAULT '',
  level INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 200),
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE invention_perks (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  max_rank INTEGER CHECK (max_rank IS NULL OR max_rank BETWEEN 0 AND 10),
  category TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE activities (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE unlocks (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  unlock_type TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE map_points (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL,
  point_type TEXT NOT NULL DEFAULT 'place',
  extra_json TEXT NOT NULL DEFAULT '{}',
  CHECK (json_valid(extra_json))
) STRICT;

CREATE INDEX map_points_region ON map_points(region_id, point_type);

CREATE TABLE source_records (
  source_file TEXT NOT NULL REFERENCES source_files(path) ON DELETE CASCADE,
  record_path TEXT NOT NULL,
  stable_id TEXT,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  record_hash TEXT NOT NULL,
  raw_json TEXT NOT NULL CHECK (json_valid(raw_json)),
  PRIMARY KEY (source_file, record_path)
) STRICT;

CREATE INDEX source_records_stable_id ON source_records(stable_id);
CREATE INDEX source_records_entity ON source_records(entity_id);

CREATE TABLE quarantine (
  id INTEGER PRIMARY KEY,
  source_file TEXT NOT NULL,
  record_path TEXT NOT NULL,
  stable_id TEXT,
  error TEXT NOT NULL,
  conflicting_record TEXT,
  suggested_resolution TEXT NOT NULL,
  raw_json TEXT NOT NULL CHECK (json_valid(raw_json)),
  UNIQUE (source_file, record_path, error)
) STRICT;

CREATE TABLE patch_ledger (
  patch_id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  resulting_entity_count INTEGER NOT NULL CHECK (resulting_entity_count >= 0)
) STRICT;

CREATE TABLE patch_changes (
  patch_id TEXT NOT NULL REFERENCES patch_ledger(patch_id) DEFERRABLE INITIALLY DEFERRED,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  line INTEGER NOT NULL CHECK (line > 0),
  PRIMARY KEY (patch_id, entity_id, line)
) STRICT;

CREATE VIRTUAL TABLE entity_search USING fts5(
  id UNINDEXED,
  name,
  short_description,
  detailed_description,
  aliases,
  tokenize = 'unicode61 remove_diacritics 2'
);
