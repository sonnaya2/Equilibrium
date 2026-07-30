import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type SourceKind = "runescape-wiki" | "jagex" | "rs-analysis" | "pvme" | "derived";

export interface SourceReference {
  source: SourceKind;
  url: string;
  title?: string;
  revision?: string;
  publishedAt?: string;
  verifiedAt: string;
}

export interface ResearchTrainingMethod {
  id: string;
  skill: string;
  method: string;
  levelRange: string;
  xpRate: string;
  intensity: string;
  location: string;
  requirements: string[];
  requiredUnlock: string;
  resourceSource: string;
  hardRegionRequirement: boolean;
  regionHints: string[];
  note: string;
  warning: string;
  freshness: string;
  confidence: string;
  source: SourceReference | null;
}

export interface ResearchContentRow {
  name: string;
  kind: string;
  detail: string;
  confidence: string;
  source: SourceReference | null;
}

export interface ResearchUpgrade {
  name: string;
  category: string;
  detail: string;
  requirements: string[];
  confidence: string;
  source: SourceReference | null;
  regionId?: string;
  regionHints?: string[];
  requiredRegions?: string[];
  regionRequirementType?: string;
  comboLabel?: string;
  isRegionCombo?: boolean;
}

export type ResearchRawRow = Record<string, unknown>;

export interface ResearchRegionalPanel {
  skillingActivities: ResearchRawRow[];
  skillingEquipment: ResearchRawRow[];
  combatAccounts: ResearchRawRow[];
  combatActivities: ResearchRawRow[];
  combatEquipment: ResearchRawRow[];
}

export interface ResearchPanelHrefs {
  regional: string;
  unlocks: Record<string, string>;
}

export interface ResearchRegion {
  id: string;
  name: string;
  availability: string;
  aliases: string[];
  areas: string[];
  skills: string[];
  content: ResearchContentRow[];
  upgrades: ResearchUpgrade[];
  training: ResearchTrainingMethod[];
  hardRules: string[];
  warnings: string[];
  source: SourceReference | null;
  verified: boolean;
  panelHrefs?: ResearchPanelHrefs;
}

export interface ResearchSkill {
  id: string;
  name: string;
  regions: string[];
  methods: ResearchTrainingMethod[];
}

export interface ResearchDatasetStats {
  regions: number;
  relicTiers: number;
  revealedRelicTiers: number;
  blessingTiers: number;
  revealedBlessingTiers: number;
  publishedTasks: number;
  skills: number;
  trainingMethods: number;
  regionalSkillingUnlocks?: number;
  regionalSkillingActivities?: number;
  regionalSkillingEquipment?: number;
  regionalCombatUnlocks?: number;
  regionalCombatAccounts?: number;
  regionalCombatActivities?: number;
  regionalCombatEquipment?: number;
  regionalCombatCombos?: number;
  museumCollectionMatrix?: number;
  museumCollectionUnobtainable?: number;
}

export interface ResearchSourcePolicy {
  defaultGroundTruth: SourceKind;
  explicitSourceGroundTruth: SourceKind[];
  provisionalFallback: SourceKind;
  note: string;
}

export interface ResearchCatalog {
  snapshotDate: string;
  sourcePolicy: ResearchSourcePolicy;
  coverage: Record<string, string>;
  hardRules: string[];
  datasets: ResearchDatasetStats;
  regions: ResearchRegion[];
  skills: ResearchSkill[];
}

export interface ResearchRegionSummary {
  id: string;
  name: string;
  availability: string;
  training: number;
}

export interface ResearchSkillSummary {
  id: string;
  name: string;
}

export interface ResearchCatalogIndex {
  snapshotDate: string;
  regions: ResearchRegionSummary[];
  skills: ResearchSkillSummary[];
}

export function getResearchCatalogIndex(): ResearchCatalogIndex {
  const database = new DatabaseSync(join(process.cwd(), ".cache/equilibrium.sqlite"), {
    readOnly: true,
  });
  try {
    const metadata = database
      .prepare("SELECT snapshot_date FROM research_catalog WHERE id = 1")
      .get() as { snapshot_date: string } | undefined;
    if (!metadata) throw new Error("Normalized research catalog is missing");
    const regions = (
      database
        .prepare(
          `SELECT research_regions.region_id AS id, regions.name, regions.availability,
                  count(research_region_training.method_entity_id) AS training
           FROM research_regions
           JOIN regions ON regions.id = research_regions.region_id
           LEFT JOIN research_region_training ON research_region_training.region_id = research_regions.region_id
           GROUP BY research_regions.region_id, regions.name, regions.availability, research_regions.ordinal
           ORDER BY research_regions.ordinal`,
        )
        .all() as unknown as ResearchRegionSummary[]
    ).map(({ id, name, availability, training }) => ({ id, name, availability, training }));
    const skills = (
      database
        .prepare(
          `SELECT json_extract(entities.extra_json, '$.id') AS id, entities.name
           FROM entities
           WHERE entities.entity_type = 'skill'
             AND EXISTS (SELECT 1 FROM research_skill_methods WHERE skill_entity_id = entities.id)
           ORDER BY id`,
        )
        .all() as unknown as ResearchSkillSummary[]
    ).map(({ id, name }) => ({ id, name }));
    return { snapshotDate: metadata.snapshot_date, regions, skills };
  } finally {
    database.close();
  }
}

export function getResearchCatalog(): ResearchCatalog {
  const database = new DatabaseSync(join(process.cwd(), ".cache/equilibrium.sqlite"), {
    readOnly: true,
  });
  const parse = <T>(value: string): T => JSON.parse(value) as T;
  try {
    const metadata = database.prepare("SELECT * FROM research_catalog WHERE id = 1").get() as
      | {
          snapshot_date: string;
          source_policy_json: string;
          coverage_json: string;
          hard_rules_json: string;
          datasets_json: string;
        }
      | undefined;
    if (!metadata) throw new Error("Normalized research catalog is missing");

    const skills = (
      database
        .prepare(
          `SELECT entities.id, entities.extra_json
           FROM entities
           WHERE entities.entity_type = 'skill'
             AND EXISTS (SELECT 1 FROM research_skill_methods WHERE skill_entity_id = entities.id)
           ORDER BY entities.id`,
        )
        .all() as unknown as Array<{ id: string; extra_json: string }>
    ).map(({ id, extra_json }) => ({
      ...parse<Omit<ResearchSkill, "methods">>(extra_json),
      methods: (
        database
          .prepare(
            `SELECT entities.extra_json
             FROM research_skill_methods
             JOIN entities ON entities.id = research_skill_methods.method_entity_id
             WHERE research_skill_methods.skill_entity_id = ? ORDER BY research_skill_methods.ordinal`,
          )
          .all(id) as unknown as Array<{ extra_json: string }>
      ).map(({ extra_json: method }) => parse<ResearchTrainingMethod>(method)),
    }));
    const methods = new Map(
      skills.flatMap((skill) => skill.methods.map((method) => [method.id, method])),
    );

    const regionRows = database
      .prepare(
        `SELECT regions.id, regions.name, regions.availability, regions.verified,
                research_regions.areas_json, research_regions.hard_rules_json,
                research_regions.warnings_json, research_regions.source_json,
                entities.extra_json
         FROM research_regions
         JOIN regions ON regions.id = research_regions.region_id
         JOIN entities ON entities.id = regions.entity_id
         ORDER BY research_regions.ordinal`,
      )
      .all() as unknown as Array<{
      id: string;
      name: string;
      availability: string;
      verified: number;
      areas_json: string;
      hard_rules_json: string;
      warnings_json: string;
      source_json: string;
      extra_json: string;
    }>;
    const regions = regionRows.map((row): ResearchRegion => {
      const base = parse<{ aliases?: string[] }>(row.extra_json);
      const entries = <T>(section: "content" | "upgrades"): T[] =>
        (
          database
            .prepare(
              `SELECT entities.extra_json
               FROM research_region_entries
               JOIN entities ON entities.id = research_region_entries.entity_id
               WHERE research_region_entries.region_id = ? AND research_region_entries.section = ?
               ORDER BY research_region_entries.ordinal`,
            )
            .all(row.id, section) as unknown as Array<{ extra_json: string }>
        ).map(({ extra_json }) => parse<T>(extra_json));
      const skillIds = (
        database
          .prepare(
            `SELECT entities.name
             FROM research_region_skills
             JOIN entities ON entities.id = research_region_skills.skill_entity_id
             WHERE research_region_skills.region_id = ? ORDER BY research_region_skills.ordinal`,
          )
          .all(row.id) as unknown as Array<{ name: string }>
      ).map(({ name }) => name);
      const training = (
        database
          .prepare(
            `SELECT research_region_training.method_entity_id AS id
             FROM research_region_training
             WHERE research_region_training.region_id = ? ORDER BY research_region_training.ordinal`,
          )
          .all(row.id) as unknown as Array<{ id: string }>
      )
        .map(({ id }) => methods.get(id))
        .filter((method): method is ResearchTrainingMethod => Boolean(method));
      return {
        id: row.id,
        name: row.name,
        availability: row.availability,
        aliases: base.aliases ?? [],
        areas: parse<string[]>(row.areas_json),
        skills: skillIds,
        content: entries<ResearchContentRow>("content"),
        upgrades: entries<ResearchUpgrade>("upgrades"),
        training,
        hardRules: parse<string[]>(row.hard_rules_json),
        warnings: parse<string[]>(row.warnings_json),
        source: parse<SourceReference | null>(row.source_json),
        verified: Boolean(row.verified),
      };
    });

    const datasets = parse<ResearchDatasetStats>(metadata.datasets_json);
    return {
      snapshotDate: metadata.snapshot_date,
      sourcePolicy: parse<ResearchSourcePolicy>(metadata.source_policy_json),
      coverage: parse<Record<string, string>>(metadata.coverage_json),
      hardRules: parse<string[]>(metadata.hard_rules_json),
      datasets: {
        ...datasets,
        regions: regions.length,
        skills: skills.length,
        trainingMethods: methods.size,
      },
      regions,
      skills,
    };
  } finally {
    database.close();
  }
}
