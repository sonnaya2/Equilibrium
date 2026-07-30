CREATE TABLE research_catalog (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  snapshot_date TEXT NOT NULL,
  source_policy_json TEXT NOT NULL CHECK (json_valid(source_policy_json)),
  coverage_json TEXT NOT NULL CHECK (json_valid(coverage_json)),
  hard_rules_json TEXT NOT NULL CHECK (json_valid(hard_rules_json)),
  datasets_json TEXT NOT NULL CHECK (json_valid(datasets_json))
) STRICT;

CREATE TABLE research_regions (
  region_id TEXT PRIMARY KEY REFERENCES regions(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL UNIQUE CHECK (ordinal >= 0),
  areas_json TEXT NOT NULL CHECK (json_valid(areas_json)),
  hard_rules_json TEXT NOT NULL CHECK (json_valid(hard_rules_json)),
  warnings_json TEXT NOT NULL CHECK (json_valid(warnings_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json))
) STRICT;

CREATE TABLE research_region_entries (
  region_id TEXT NOT NULL REFERENCES research_regions(region_id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('content', 'upgrades')),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (region_id, section, ordinal),
  UNIQUE (region_id, section, entity_id)
) STRICT;

CREATE INDEX research_region_entries_entity ON research_region_entries(entity_id);

CREATE TABLE research_region_skills (
  region_id TEXT NOT NULL REFERENCES research_regions(region_id) ON DELETE CASCADE,
  skill_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (region_id, ordinal),
  UNIQUE (region_id, skill_entity_id)
) STRICT;

CREATE TABLE research_region_training (
  region_id TEXT NOT NULL REFERENCES research_regions(region_id) ON DELETE CASCADE,
  method_entity_id TEXT NOT NULL REFERENCES training_methods(entity_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (region_id, ordinal),
  UNIQUE (region_id, method_entity_id)
) STRICT;

CREATE INDEX research_region_training_method ON research_region_training(method_entity_id);

CREATE TABLE research_skill_methods (
  skill_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  method_entity_id TEXT NOT NULL REFERENCES training_methods(entity_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (skill_entity_id, ordinal),
  UNIQUE (skill_entity_id, method_entity_id)
) STRICT;

CREATE INDEX research_skill_methods_method ON research_skill_methods(method_entity_id);
