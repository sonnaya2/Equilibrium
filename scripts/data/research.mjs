import { REGION_IDS } from "./config.mjs";
import { prepared } from "./database.mjs";
import { asArray } from "./utilities.mjs";

// Reconstructs the catalog document shape from relational tables. This is what
// data:canonical:validate digests to prove the canonical files rebuild the same
// catalog the database holds.
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

// A summary of the regions for the build manifest. The payloads themselves are
// rendered from SQLite by app/data/regions/[id]/route.ts, so nothing here needs
// an href, a byte count or a hash - there is no file to address.
export function researchRegionIndex(db) {
  return readResearchCatalog(db).regions.map((region) => ({
    id: region.id,
    name: region.name,
    availability: region.availability,
    training: (region.trainingMethodIds ?? []).length,
  }));
}
