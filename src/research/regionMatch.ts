import type { ResearchRegion } from "./catalog";

/**
 * Which region a source row belongs to.
 *
 * Lives outside the component that renders it because the panels are now built
 * on the server, straight out of SQLite — the same rule has to decide what a
 * region page contains and what the browser is told about it, and two copies of
 * it would drift.
 */
export type ResearchRow = Record<string, unknown>;

const HARD_REGION_KEYS = [
  "requiredRegions",
  "required_regions",
  "required_region",
  "required_regions_for_collection_loop",
] as const;

/** Host geography applies only when no hard region requirement exists. */
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
] as const;

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
  "prifddinas", // mapped via regionHints/tirannwn, not a league elective id
]);

function collectRegionScope(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectRegionScope(item, out));
  else if (value && typeof value === "object") {
    Object.values(value as ResearchRow).forEach((item) => collectRegionScope(item, out));
  }
}

function normalizeRegionScope(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function regionAliases(selectedRegion: Pick<ResearchRegion, "id" | "name" | "aliases">): string[] {
  return [selectedRegion.id, selectedRegion.name, ...selectedRegion.aliases]
    .map(normalizeRegionScope)
    .filter(Boolean);
}

function scopeMatchesAliases(scope: string[], aliases: string[]): boolean {
  const normalized = scope.map(normalizeRegionScope).filter(Boolean);
  const concrete = normalized.filter(
    (value) =>
      !value.includes("global") && !value.includes("allregions") && !value.includes("anyregion"),
  );
  if (!concrete.length) return normalized.length > 0;
  return concrete.some((value) =>
    aliases.some((alias) => value.includes(alias) || alias.includes(value)),
  );
}

/** Hard requirements override host geography; global rows match every region. */
export function researchRowMatchesRegion(
  row: ResearchRow,
  selectedRegion: Pick<ResearchRegion, "id" | "name" | "aliases"> | null,
): boolean {
  if (!selectedRegion) return true;

  if (row.region_requirement_type === "no_region_requirement") return true;

  const aliases = regionAliases(selectedRegion);

  const hard: string[] = [];
  for (const key of HARD_REGION_KEYS) collectRegionScope(row[key], hard);
  if (hard.length) return scopeMatchesAliases(hard, aliases);

  const host: string[] = [];
  for (const key of HOST_REGION_KEYS) collectRegionScope(row[key], host);
  if (typeof row.id === "string" && row.id.includes(":")) {
    const prefix = row.id.split(":", 1)[0]!;
    const norm = normalizeRegionScope(prefix);
    if (norm && !NON_REGION_ID_PREFIXES.has(norm) && !NON_REGION_ID_PREFIXES.has(prefix)) {
      host.push(prefix);
    }
  }
  return scopeMatchesAliases(host, aliases);
}
