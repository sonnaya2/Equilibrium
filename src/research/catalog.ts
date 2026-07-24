import indexSource from "../../scraped-data/index.json";
import regionsSource from "../../scraped-data/regions.json";
import dependenciesSource from "../../scraped-data/region-dependencies.json";
import upgradesSource from "../../scraped-data/major-upgrades-by-region.json";
import trainingSource from "../../scraped-data/training-methods.json";
import trainingHighSource from "../../scraped-data/training-high-value.json";

type JsonObject = Record<string, unknown>;

export interface ResearchTrainingMethod {
  id: string;
  skill: string;
  method: string;
  levelRange: string;
  xpRate: string;
  intensity: string;
  regionHints: string[];
  note: string;
  warning: string;
  freshness: string;
  confidence: string;
  source: string;
}

export interface ResearchContentRow {
  name: string;
  kind: string;
  detail: string;
  confidence: string;
}

export interface ResearchUpgrade {
  name: string;
  category: string;
  detail: string;
  requirements: string[];
  confidence: string;
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
  sourceIds: string[];
}

export interface ResearchSkill {
  id: string;
  name: string;
  regions: string[];
  methods: ResearchTrainingMethod[];
}

export interface ResearchCatalog {
  snapshotDate: string;
  coverage: Record<string, string>;
  hardRules: string[];
  regions: ResearchRegion[];
  skills: ResearchSkill[];
}

const REGION_ORDER = [
  "misthalin",
  "havenhythe",
  "karamja",
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "anachronia",
] as const;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function strings(value: unknown): string[] {
  return array(value)
    .map((entry) => string(entry))
    .filter(Boolean);
}

function label(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(compactValue).filter(Boolean).join(", ");

  const entries = Object.entries(object(value));
  return entries
    .map(([key, entry]) => `${key.replaceAll("_", " ")}: ${compactValue(entry)}`)
    .join(" · ");
}

function firstString(record: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const compact = compactValue(value);
      if (compact) return compact;
    }
  }
  return "";
}

function regionHints(record: JsonObject): string[] {
  const hints = new Set<string>();
  const scalarKeys = [
    "region",
    "method_region",
    "resource_region",
    "required_unlock_region",
  ];

  for (const key of scalarKeys) {
    const value = string(record[key]);
    if (value) hints.add(value);
  }

  for (const key of ["resource_region_options", "regions", "region_options"]) {
    for (const value of strings(record[key])) hints.add(value);
  }

  return [...hints];
}

function normalizeTraining(raw: unknown, fallbackSource = ""): ResearchTrainingMethod {
  const record = object(raw);
  const skill = string(record.skill, "Unknown");
  const method = string(record.method, "Unnamed method");
  const xpRate = firstString(record, [
    "base_xp_per_hour",
    "base_xp_per_hour_by_unlock",
    "example_base_xp_per_hour",
    "xp_rate",
    "legacy_base_xp_per_hour",
    "throughput",
    "xp_event",
  ]);

  const notes = [
    string(record.notes),
    string(record.note),
    string(record.league_note),
    string(record.resource_note),
    string(record.importance),
  ].filter(Boolean);

  return {
    id: `${skill.toLowerCase().replaceAll(" ", "-")}:${method
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")}`,
    skill,
    method,
    levelRange: firstString(record, ["level_range", "level", "unlock_level"]),
    xpRate,
    intensity: string(record.intensity),
    regionHints: regionHints(record),
    note: notes.join(" · "),
    warning: string(record.warning),
    freshness: firstString(record, ["freshness", "status"]),
    confidence: string(record.confidence, "unclassified"),
    source: string(record.source, fallbackSource),
  };
}

function allTraining(): ResearchTrainingMethod[] {
  const seen = new Set<string>();
  const result: ResearchTrainingMethod[] = [];

  const sources: Array<[unknown[], string]> = [
    [array(object(trainingHighSource).methods), "training-high-value.json"],
    [array(object(trainingSource).methods), "training-methods.json"],
  ];

  for (const [records, fallbackSource] of sources) {
    for (const raw of records) {
      const method = normalizeTraining(raw, fallbackSource);
      const key = `${method.skill.toLowerCase()}|${method.method.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(method);
    }
  }

  return result.sort((a, b) =>
    a.skill === b.skill
      ? a.method.localeCompare(b.method)
      : a.skill.localeCompare(b.skill),
  );
}

function hintMatchesRegion(hint: string, regionId: string): boolean {
  const normalized = hint.toLowerCase();
  if (normalized === regionId) return true;
  if (normalized.startsWith(`${regionId}_`)) return true;
  if (normalized.includes(`${regionId}_plus_`)) return true;
  if (normalized.includes(`_${regionId}_`)) return true;

  if (regionId === "forinthry") {
    return normalized.includes("wilderness") || normalized.includes("wildy");
  }
  if (regionId === "asgarnia") {
    return normalized.includes("troll country") || normalized.includes("trollheim");
  }
  return false;
}

function contentRows(region: JsonObject): ResearchContentRow[] {
  const groups: Array<[string, unknown]> = [
    ["content", region.notable_content],
    ["combat", region.bosses_and_combat],
    ["skilling", region.skilling],
  ];

  const rows: ResearchContentRow[] = [];
  for (const [fallbackKind, rawRows] of groups) {
    for (const raw of array(rawRows)) {
      if (typeof raw === "string") {
        rows.push({ name: raw, kind: fallbackKind, detail: "", confidence: "unclassified" });
        continue;
      }
      const record = object(raw);
      const detail = [
        firstString(record, ["note", "notes", "level_range", "base_game_requirements"]),
        compactValue(record.upgrade_examples),
        record.slayer_level ? `Slayer ${record.slayer_level}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      rows.push({
        name: string(record.name, "Unnamed content"),
        kind: firstString(record, ["skill", "type", "group"]) || fallbackKind,
        detail,
        confidence: string(record.confidence, "unclassified"),
      });
    }
  }

  for (const raw of array(region.power_upgrades)) {
    if (typeof raw === "string") {
      rows.push({ name: raw, kind: "upgrade", detail: "", confidence: "unclassified" });
      continue;
    }
    const record = object(raw);
    rows.push({
      name: string(record.name, "Unnamed upgrade"),
      kind: firstString(record, ["style", "type"]) || "upgrade",
      detail: firstString(record, ["tier", "note", "notes"]),
      confidence: string(record.confidence, "unclassified"),
    });
  }

  return rows;
}

function normalizeUpgrades(regionId: string): ResearchUpgrade[] {
  const root = object(upgradesSource);
  const regions = object(root.regions);
  return array(regions[regionId]).map((raw) => {
    const record = object(raw);
    const detail = [
      string(record.notes),
      string(record.league_relevance),
      string(record["2026_change"]),
      compactValue(record.examples),
      record.tier ? `Tier ${record.tier}` : "",
      record.source ? `Source: ${string(record.source)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      name: string(record.name, "Unnamed upgrade"),
      category: string(record.category, "upgrade"),
      detail,
      requirements: strings(record.requirements),
      confidence: string(record.confidence, "unclassified"),
    };
  });
}

function dependencyRules(regionId: string): string[] {
  const root = object(dependenciesSource);
  const rows = [...array(root.boundary_overrides), ...array(root.dependencies)];
  return rows
    .map(object)
    .filter((record) => string(record.required_region) === regionId)
    .map((record) => string(record.planner_rule))
    .filter(Boolean);
}

function buildRegions(training: ResearchTrainingMethod[]): ResearchRegion[] {
  const rawRegions = array(object(regionsSource).regions).map(object);
  const byId = new Map(rawRegions.map((region) => [string(region.id), region]));

  return REGION_ORDER.flatMap((id) => {
    const region = byId.get(id);
    if (!region) return [];

    const methods = training.filter((method) =>
      method.regionHints.some((hint) => hintMatchesRegion(hint, id)),
    );

    const content = contentRows(region);
    const skillSet = new Set<string>(methods.map((method) => method.skill));
    for (const row of content) {
      if (["combat", "content", "boss", "bossing", "progression", "upgrade"].includes(row.kind.toLowerCase())) {
        continue;
      }
      if (row.kind && !row.kind.includes("/")) skillSet.add(row.kind);
    }

    const warnings = [
      ...strings(region.open_questions),
      string(region.legacy_warning),
      string(region.boundary_rule),
    ].filter(Boolean);

    return [
      {
        id,
        name: string(region.display_name) || label(id),
        availability: string(region.availability, "unknown"),
        aliases: strings(region.aliases),
        areas: [...new Set([...strings(region.major_areas), ...strings(region.official_examples)])],
        skills: [...skillSet].sort((a, b) => a.localeCompare(b)),
        content,
        upgrades: normalizeUpgrades(id),
        training: methods,
        hardRules: dependencyRules(id),
        warnings,
        sourceIds: strings(region.source_ids),
      },
    ];
  });
}

function buildSkills(training: ResearchTrainingMethod[], regions: ResearchRegion[]): ResearchSkill[] {
  const regionName = new Map(regions.map((region) => [region.id, region.name]));
  const grouped = new Map<string, ResearchTrainingMethod[]>();

  for (const method of training) {
    const list = grouped.get(method.skill) ?? [];
    list.push(method);
    grouped.set(method.skill, list);
  }

  return [...grouped.entries()]
    .map(([name, methods]) => {
      const methodRegions = new Set<string>();
      for (const method of methods) {
        for (const region of regions) {
          if (method.regionHints.some((hint) => hintMatchesRegion(hint, region.id))) {
            methodRegions.add(region.name);
          }
        }
      }

      return {
        id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
        name,
        regions: [...methodRegions].sort((a, b) => a.localeCompare(b)),
        methods,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getResearchCatalog(): ResearchCatalog {
  const training = allTraining();
  const regions = buildRegions(training);
  const index = object(indexSource);
  const coverageRaw = object(index.coverage);
  const coverage = Object.fromEntries(
    Object.entries(coverageRaw).map(([key, value]) => [key, string(value)]),
  );

  return {
    snapshotDate: string(index.snapshot_date, string(object(regionsSource).snapshot_date)),
    coverage,
    hardRules: strings(index.hard_rules),
    regions,
    skills: buildSkills(training, regions),
  };
}
