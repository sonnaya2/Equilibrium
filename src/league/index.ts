/**
 * Equilibrium league domain model. Zero React — the binding lives in useBuild.ts.
 * Unlock structure (confirmed_official, scraped-data/equilibrium.json):
 * Misthalin + Havenhythe fixed, Karamja at the first task milestone,
 * then 3 elective picks from the remaining 8. Six regions total, never more.
 */

export const REGION_IDS = [
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

export type RegionId = (typeof REGION_IDS)[number];

export const STARTING_REGIONS: readonly RegionId[] = ["misthalin", "havenhythe"];
export const MILESTONE_REGION: RegionId = "karamja";
export const ELECTIVE_REGIONS: readonly RegionId[] = [
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "anachronia",
];
export const ELECTIVE_CAP = 3;
export const UNLOCK_CAP = STARTING_REGIONS.length + 1 + ELECTIVE_CAP; // 6

export interface BuildState {
  elective: RegionId[];
}

export const STORAGE_KEY = "eq:build:v1";

export function emptyBuild(): BuildState {
  return { elective: [] };
}

export function isRegionId(value: unknown): value is RegionId {
  return typeof value === "string" && (REGION_IDS as readonly string[]).includes(value);
}

/** Tolerates corrupt or stale persisted shapes — anything unrecognised drops out. */
export function normalizeBuild(value: unknown): BuildState {
  if (typeof value !== "object" || value === null) return emptyBuild();
  const elective = (value as { elective?: unknown }).elective;
  if (!Array.isArray(elective)) return emptyBuild();
  const valid = elective.filter(
    (id): id is RegionId => isRegionId(id) && (ELECTIVE_REGIONS as readonly string[]).includes(id),
  );
  return { elective: [...new Set(valid)].slice(0, ELECTIVE_CAP) };
}

export function unlockedRegions(state: BuildState): RegionId[] {
  return [...STARTING_REGIONS, MILESTONE_REGION, ...state.elective];
}

export function isRegionUnlocked(state: BuildState, id: RegionId): boolean {
  return unlockedRegions(state).includes(id);
}

export function canSelectElective(state: BuildState, id: RegionId): boolean {
  if (!(ELECTIVE_REGIONS as readonly string[]).includes(id)) return false;
  return state.elective.includes(id) || state.elective.length < ELECTIVE_CAP;
}

/** No-op (returns the same state) when the toggle is not legal. */
export function toggleElective(state: BuildState, id: RegionId): BuildState {
  if (!canSelectElective(state, id)) return state;
  return state.elective.includes(id)
    ? { elective: state.elective.filter((r) => r !== id) }
    : { elective: [...state.elective, id] };
}
