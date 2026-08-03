/**
 * Equilibrium league domain model. Zero React - the binding lives in useBuild.ts.
 * Unlock structure (confirmed_official, data/league from research normalize):
 * Misthalin + Havenhythe fixed, Karamja at the first task milestone,
 * then 3 elective picks from the remaining 8. Six regions total, never more.
 * Blessing paths, god tiers and the reset count derive from data/league/blessings.json.
 */

import regionsData from "#shard/league/regions.json";
import relicsData from "#shard/league/relics.json";
import { normalizeBlessingSelections } from "./blessingSchema";
import {
  BLESSING_PATHS,
  BLESSING_RESET_COUNT,
  PATH_TIERS,
  blessingById,
  blessingChoice,
  type BlessingPath,
  type StableBlessingSelection,
} from "./blessings";

/** Revealed tiers with published choices only - unrevealed empty tiers stay open. */
const REVEALED_RELIC_NAMES_BY_TIER: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, ReadonlySet<string>>();
  for (const tier of relicsData.records) {
    if (!tier.revealed || tier.choices.length === 0) continue;
    map.set(
      String(tier.tier),
      new Set(tier.choices.map((c) => c.name).filter((n): n is string => typeof n === "string")),
    );
  }
  return map;
})();

/** Display order: first-3 unlock path A-Z, then electives A-Z. Availability still from regions.json. */
export const REGION_IDS = [
  "havenhythe",
  "karamja",
  "misthalin",
  "anachronia",
  "asgarnia",
  "desert",
  "forinthry",
  "fremennik",
  "kandarin",
  "morytania",
  "tirannwn",
] as const;

export type RegionId = (typeof REGION_IDS)[number];

export function isRegionId(value: unknown): value is RegionId {
  return typeof value === "string" && (REGION_IDS as readonly string[]).includes(value);
}

/** Runtime grouping comes from the canonical records; REGION_IDS only names the
 *  compile-time union. The drift-guard test fails loudly when the two disagree. */
function idsWithAvailability(availability: string): RegionId[] {
  return regionsData.records
    .filter((r) => r.availability === availability)
    .map((r) => r.id)
    .filter(isRegionId);
}

export const STARTING_REGIONS: readonly RegionId[] = idsWithAvailability("starting");
export const MILESTONE_REGION: RegionId = idsWithAvailability("automatic_early")[0] ?? "karamja";
export const ELECTIVE_REGIONS: readonly RegionId[] = idsWithAvailability("elective");
export const ELECTIVE_CAP = 3;
export const UNLOCK_CAP = STARTING_REGIONS.length + 1 + ELECTIVE_CAP; // 6

export interface BuildState {
  elective: RegionId[];
  /** Relic tier (as string key) -> chosen relic name. Only revealed tiers have choices. */
  relics: Record<string, string>;
  /**
   * Path picks in PATH_TIERS order, contiguous - god tiers grant, they are never picked.
   * Derived from `blessingSelections` so combat and god derivation stay path-based.
   */
  blessingPicks: BlessingPath[];
  /**
   * Stable persistence form: tier + blessing id. Survives record reorder; invalid /
   * duplicate / tier-mismatched ids are pruned on normalize.
   */
  blessingSelections: StableBlessingSelection[];
  blessingResetsUsed: number;
}

export const STORAGE_KEY = "eq:build:v1";

/** Hostile share hashes / corrupt storage cannot flood localStorage with junk relics. */
export const MAX_RELIC_KEYS = 16;
export const MAX_RELIC_NAME_LEN = 64;

export function emptyBuild(): BuildState {
  return {
    elective: [],
    relics: {},
    blessingPicks: [],
    blessingSelections: [],
    blessingResetsUsed: 0,
  };
}

function isBlessingPath(value: unknown): value is BlessingPath {
  return typeof value === "string" && (BLESSING_PATHS as readonly string[]).includes(value);
}

/** Resolve blessing picks from stable selections and/or legacy path arrays. */
export function resolveBlessingPersistence(raw: {
  blessingPicks?: unknown;
  blessingSelections?: unknown;
}): { blessingPicks: BlessingPath[]; blessingSelections: StableBlessingSelection[] } {
  const resolve = {
    pathTiers: PATH_TIERS,
    choiceAt: (tier: number, path: string) => {
      if (!isBlessingPath(path)) return undefined;
      const choice = blessingChoice(tier, path);
      return choice ? { id: choice.id as string, path: choice.path as string } : undefined;
    },
    choiceById: (id: string) => {
      const choice = blessingById(id);
      return choice
        ? { id: choice.id as string, path: choice.path as string, tier: choice.tier }
        : undefined;
    },
    isPath: (value: unknown): value is string => isBlessingPath(value),
  };
  // Prefer stable selections when present; fall back to legacy path arrays.
  const primary =
    Array.isArray(raw.blessingSelections) && raw.blessingSelections.length > 0
      ? raw.blessingSelections
      : raw.blessingPicks;
  const { paths } = normalizeBlessingSelections(primary, resolve);
  const legacyPathPicks = Array.isArray(raw.blessingPicks)
    ? (raw.blessingPicks as unknown[]).filter(isBlessingPath).slice(0, PATH_TIERS.length)
    : null;
  // Prefer the longer legacy path prefix (unrevealed tiers), then re-materialize
  // selections from that list so the two fields never diverge.
  const blessingPicks = (
    legacyPathPicks && legacyPathPicks.length > paths.length ? legacyPathPicks : paths
  ) as BlessingPath[];
  const blessingSelections: StableBlessingSelection[] = [];
  blessingPicks.forEach((path, index) => {
    const tier = PATH_TIERS[index];
    if (tier === undefined) return;
    const choice = blessingChoice(tier, path);
    if (choice) blessingSelections.push({ tier, blessingId: choice.id });
  });
  return { blessingPicks, blessingSelections };
}

function selectionsFromPaths(paths: readonly BlessingPath[]): StableBlessingSelection[] {
  return resolveBlessingPersistence({ blessingPicks: paths }).blessingSelections;
}

/** Tolerates corrupt or stale persisted shapes - anything unrecognised drops out. */
export function normalizeBuild(value: unknown): BuildState {
  if (typeof value !== "object" || value === null) return emptyBuild();
  const base = emptyBuild();

  const elective = (value as { elective?: unknown }).elective;
  if (Array.isArray(elective)) {
    const valid = elective.filter(
      (id): id is RegionId =>
        isRegionId(id) && (ELECTIVE_REGIONS as readonly string[]).includes(id),
    );
    base.elective = [...new Set(valid)].slice(0, ELECTIVE_CAP);
  }

  const relics = (value as { relics?: unknown }).relics;
  if (typeof relics === "object" && relics !== null) {
    for (const [tier, name] of Object.entries(relics)) {
      if (Object.keys(base.relics).length >= MAX_RELIC_KEYS) break;
      if (
        !/^\d+$/.test(tier) ||
        typeof name !== "string" ||
        name.length === 0 ||
        name.length > MAX_RELIC_NAME_LEN
      ) {
        continue;
      }
      // Revealed tiers accept listed choices; unrevealed tiers preserve names.
      const allowed = REVEALED_RELIC_NAMES_BY_TIER.get(tier);
      if (allowed && !allowed.has(name)) continue;
      base.relics[tier] = name;
    }
  }

  const raw = value as { blessingPicks?: unknown; blessingSelections?: unknown };
  const resolved = resolveBlessingPersistence(raw);
  base.blessingPicks = resolved.blessingPicks;
  base.blessingSelections = resolved.blessingSelections;

  const resets = (value as { blessingResetsUsed?: unknown }).blessingResetsUsed;
  if (typeof resets === "number" && Number.isFinite(resets)) {
    base.blessingResetsUsed = Math.min(Math.max(Math.trunc(resets), 0), BLESSING_RESET_COUNT);
  }

  return base;
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
    ? { ...state, elective: state.elective.filter((r) => r !== id) }
    : { ...state, elective: [...state.elective, id] };
}

export function toggleRelic(state: BuildState, tier: number, name: string): BuildState {
  const key = String(tier);
  const relics = { ...state.relics };
  if (relics[key] === name) delete relics[key];
  else relics[key] = name;
  return { ...state, relics };
}

/**
 * Picks are positional and contiguous: a tier opens once the previous path tier
 * is picked; re-picking the same path un-picks it and drops every later pick.
 * Re-picking an earlier tier is free until Jagex publishes reset costs.
 */
export function pickBlessing(state: BuildState, pathTier: number, path: BlessingPath): BuildState {
  const idx = PATH_TIERS.indexOf(pathTier);
  if (idx === -1 || idx > state.blessingPicks.length) return state;
  const picks = state.blessingPicks.slice();
  if (picks[idx] === path) picks.length = idx;
  else picks[idx] = path;
  return {
    ...state,
    blessingPicks: picks,
    blessingSelections: selectionsFromPaths(picks),
  };
}

/** Wipes blessing picks and spends one reset - no-op when none left or nothing to reset. */
export function resetBlessings(state: BuildState): BuildState {
  if (state.blessingResetsUsed >= BLESSING_RESET_COUNT || state.blessingPicks.length === 0) {
    return state;
  }
  return {
    ...state,
    blessingPicks: [],
    blessingSelections: [],
    blessingResetsUsed: state.blessingResetsUsed + 1,
  };
}

export function blessingResetsLeft(state: BuildState): number {
  return BLESSING_RESET_COUNT - state.blessingResetsUsed;
}
