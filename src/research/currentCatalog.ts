import currentTrainingSource from "../../scraped-data/training-current-audit.json";
import {
  getResearchCatalog,
  type ResearchCatalog,
  type ResearchRegion,
  type ResearchTrainingMethod,
} from "@/research/catalog";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function compact(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).join(", ");
  return Object.entries(object(value))
    .map(([key, entry]) => `${key.replaceAll("_", " ")}: ${compact(entry)}`)
    .join(" · ");
}

function valueFrom(record: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return compact(value);
    }
  }
  return "";
}

function hints(record: JsonObject): string[] {
  const found = new Set<string>();
  for (const key of ["method_region", "region", "resource_region", "required_unlock_region"]) {
    const value = text(record[key]);
    if (value) found.add(value);
  }
  for (const key of ["resource_region_options", "regions", "region_options"]) {
    for (const value of array(record[key])) {
      const normalized = text(value);
      if (normalized) found.add(normalized);
    }
  }
  return [...found];
}

function normalize(raw: unknown): ResearchTrainingMethod {
  const record = object(raw);
  const skill = text(record.skill, "Unknown");
  const method = text(record.method, "Unnamed method");
  const note = [
    text(record.notes),
    text(record.note),
    text(record.league_note),
    text(record.resource_note),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `${skill.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}:${method
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")}`,
    skill,
    method,
    levelRange: valueFrom(record, ["level_range", "level", "unlock_level"]),
    xpRate: valueFrom(record, [
      "base_xp_per_hour",
      "base_xp_per_hour_by_unlock",
      "example_base_xp_per_hour",
      "xp_rate",
      "throughput",
      "xp_event",
    ]),
    intensity: text(record.intensity),
    regionHints: hints(record),
    note,
    warning: text(record.warning),
    freshness: valueFrom(record, ["freshness", "status"]),
    confidence: text(record.confidence, "unclassified"),
    source: text(record.source, "training-current-audit.json"),
  };
}

function methodKey(method: ResearchTrainingMethod): string {
  return `${method.skill.toLowerCase()}|${method.method.toLowerCase()}`;
}

function hintMatchesRegion(hint: string, region: ResearchRegion): boolean {
  const normalized = hint.toLowerCase();
  if (normalized === region.id) return true;
  if (normalized.startsWith(`${region.id}_`)) return true;
  if (normalized.includes(`${region.id}_plus_`)) return true;
  if (normalized.includes(`_${region.id}_`)) return true;

  if (region.id === "forinthry") {
    return normalized.includes("wilderness") || normalized.includes("wildy");
  }
  if (region.id === "asgarnia") {
    return normalized.includes("troll country") || normalized.includes("trollheim");
  }
  return false;
}

export function getCurrentResearchCatalog(): ResearchCatalog {
  const base = getResearchCatalog();
  const audited = array(object(currentTrainingSource).methods).map(normalize);

  const auditedByKey = new Map(audited.map((method) => [methodKey(method), method]));
  const allByKey = new Map<string, ResearchTrainingMethod>();

  for (const skill of base.skills) {
    for (const method of skill.methods) allByKey.set(methodKey(method), method);
  }
  for (const method of audited) allByKey.set(methodKey(method), method);

  const allMethods = [...allByKey.values()].sort((a, b) =>
    a.skill === b.skill
      ? a.method.localeCompare(b.method)
      : a.skill.localeCompare(b.skill),
  );

  const regions = base.regions.map((region) => {
    const byKey = new Map(region.training.map((method) => [methodKey(method), method]));

    for (const [key, replacement] of auditedByKey) {
      if (byKey.has(key)) byKey.set(key, replacement);
    }
    for (const method of audited) {
      if (method.regionHints.some((hint) => hintMatchesRegion(hint, region))) {
        byKey.set(methodKey(method), method);
      }
    }

    const training = [...byKey.values()].sort((a, b) =>
      a.skill === b.skill
        ? a.method.localeCompare(b.method)
        : a.skill.localeCompare(b.skill),
    );

    return {
      ...region,
      training,
      skills: [...new Set([...region.skills, ...training.map((method) => method.skill)])].sort((a, b) =>
        a.localeCompare(b),
      ),
    };
  });

  const grouped = new Map<string, ResearchTrainingMethod[]>();
  for (const method of allMethods) {
    const list = grouped.get(method.skill) ?? [];
    list.push(method);
    grouped.set(method.skill, list);
  }

  const skills = [...grouped.entries()]
    .map(([name, methods]) => {
      const regionNames = regions
        .filter((region) =>
          methods.some((method) =>
            method.regionHints.some((hint) => hintMatchesRegion(hint, region)),
          ),
        )
        .map((region) => region.name);

      return {
        id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
        name,
        regions: [...new Set(regionNames)].sort((a, b) => a.localeCompare(b)),
        methods,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const hardRules = [
    ...base.hardRules,
    "Troll Country is part of Asgarnia in the working Equilibrium region map; it is not a separate region pick.",
  ];

  return {
    ...base,
    hardRules: [...new Set(hardRules)],
    regions,
    skills,
    coverage: {
      ...base.coverage,
      training:
        "all 29 named RS3 skills now surface in the skill browser; region-sensitive high-value routes are populated, while stale combat-rate tables and unresolved League resource loops remain explicitly unranked",
    },
  };
}
