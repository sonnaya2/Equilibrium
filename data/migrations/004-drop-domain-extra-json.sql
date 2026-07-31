-- Each domain table carried its own extra_json copy of the record. All 4,508
-- rows were byte-identical to entities.extra_json for the same entity, and
-- nothing ever read them: every extra_json read in scripts/data/ is against
-- entities. That is 3.15 MiB of a 28.9 MiB database written on every rebuild
-- and queried by no one.
--
-- DROP COLUMN is refused while a CHECK names the column, so each table is
-- recreated and its remaining columns copied across.

PRAGMA foreign_keys = OFF;

CREATE TABLE quests_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  quest_type TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  primary_region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  members INTEGER CHECK (members IS NULL OR members IN (0, 1)),
  release_date TEXT NOT NULL DEFAULT ''
) STRICT;
INSERT INTO quests_new SELECT entity_id, quest_type, series, primary_region_id, members, release_date FROM quests;
DROP TABLE quests;
ALTER TABLE quests_new RENAME TO quests;

CREATE TABLE tasks_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT '',
  points INTEGER CHECK (points IS NULL OR points >= 0),
  region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  source_league TEXT NOT NULL DEFAULT ''
) STRICT;
INSERT INTO tasks_new SELECT entity_id, tier, points, region_id, source_league FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

CREATE TABLE training_methods_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  skill TEXT NOT NULL DEFAULT '',
  level_range TEXT NOT NULL DEFAULT '',
  xp_rate TEXT NOT NULL DEFAULT '',
  intensity TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  hard_region_requirement INTEGER NOT NULL DEFAULT 0 CHECK (hard_region_requirement IN (0, 1))
) STRICT;
INSERT INTO training_methods_new
  SELECT entity_id, skill, level_range, xp_rate, intensity, location, hard_region_requirement FROM training_methods;
DROP TABLE training_methods;
ALTER TABLE training_methods_new RENAME TO training_methods;

CREATE TABLE equipment_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  style TEXT NOT NULL DEFAULT '',
  slot TEXT NOT NULL DEFAULT '',
  tier INTEGER CHECK (tier IS NULL OR tier BETWEEN 0 AND 200),
  category TEXT NOT NULL DEFAULT ''
) STRICT;
INSERT INTO equipment_new SELECT entity_id, style, slot, tier, category FROM equipment;
DROP TABLE equipment;
ALTER TABLE equipment_new RENAME TO equipment;

CREATE TABLE abilities_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  style TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  level INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 200),
  cooldown_ticks INTEGER CHECK (cooldown_ticks IS NULL OR cooldown_ticks >= 0)
) STRICT;
INSERT INTO abilities_new SELECT entity_id, style, category, level, cooldown_ticks FROM abilities;
DROP TABLE abilities;
ALTER TABLE abilities_new RENAME TO abilities;

CREATE TABLE prayers_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  book TEXT NOT NULL DEFAULT '',
  level INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 200)
) STRICT;
INSERT INTO prayers_new SELECT entity_id, book, level FROM prayers;
DROP TABLE prayers;
ALTER TABLE prayers_new RENAME TO prayers;

CREATE TABLE spells_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  spellbook TEXT NOT NULL DEFAULT '',
  level INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 200)
) STRICT;
INSERT INTO spells_new SELECT entity_id, spellbook, level FROM spells;
DROP TABLE spells;
ALTER TABLE spells_new RENAME TO spells;

CREATE TABLE invention_perks_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  max_rank INTEGER CHECK (max_rank IS NULL OR max_rank BETWEEN 0 AND 10),
  category TEXT NOT NULL DEFAULT ''
) STRICT;
INSERT INTO invention_perks_new SELECT entity_id, max_rank, category FROM invention_perks;
DROP TABLE invention_perks;
ALTER TABLE invention_perks_new RENAME TO invention_perks;

CREATE TABLE activities_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT ''
) STRICT;
INSERT INTO activities_new SELECT entity_id, category, location FROM activities;
DROP TABLE activities;
ALTER TABLE activities_new RENAME TO activities;

CREATE TABLE unlocks_new (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  unlock_type TEXT NOT NULL DEFAULT ''
) STRICT;
INSERT INTO unlocks_new SELECT entity_id, category, unlock_type FROM unlocks;
DROP TABLE unlocks;
ALTER TABLE unlocks_new RENAME TO unlocks;

PRAGMA foreign_keys = ON;
