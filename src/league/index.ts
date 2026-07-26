/**
 * Equilibrium league domain model. Zero React — the binding lives in useBuild.ts.
 * Unlock structure (confirmed_official, scraped-data/equilibrium.json):
 * Misthalin + Havenhythe fixed, Karamja at the first task milestone,
 * then 3 elective picks from the remaining 8. Six regions total, never more.
 * Blessing paths, god tiers and the reset count derive from data/league/blessings.json.
 */

import regionsData from "#data/league/regions.json";
import {
  BLESSING_PATHS,
  BLESSING_RESET_COUNT,
  PATH_TIERS,
  type BlessingPath,
} from "./blessings";

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
  /** Path picks in tier order, contiguous — god tiers grant, they are never picked. */
  blessingPicks: BlessingPath[];
  blessingResetsUsed: number;
}

export const STORAGE_KEY = "eq:build:v1";

/** Hostile share hashes / corrupt storage cannot flood localStorage with junk relics. */
export const MAX_RELIC_KEYS = 16;
export const MAX_RELIC_NAME_LEN = 64;

export function emptyBuild(): BuildState {
  return { elective: [], relics: {}, blessingPicks: [], blessingResetsUsed: 0 };
}

/** Tolerates corrupt or stale persisted shapes — anything unrecognised drops out. */
export function normalizeBuild(value: unknown): BuildState {
  if (typeof value !== "object" || value === null) return emptyBuild();
  const base = emptyBuild();

  const elective = (value as { elective?: unknown }).elective;
  if (Array.isArray(elective)) {
    const valid = elective.filter(
      (id): id is RegionId => isRegionId(id) && (ELECTIVE_REGIONS as readonly string[]).includes(id),
    );
    base.elective = [...new Set(valid)].slice(0, ELECTIVE_CAP);
  }

  const relics = (value as { relics?: unknown }).relics;
  if (typeof relics === "object" && relics !== null) {
    for (const [tier, name] of Object.entries(relics)) {
      if (Object.keys(base.relics).length >= MAX_RELIC_KEYS) break;
      if (
        /^\d+$/.test(tier) &&
        typeof name === "string" &&
        name.length > 0 &&
        name.length <= MAX_RELIC_NAME_LEN
      ) {
        base.relics[tier] = name;
      }
    }
  }

  const picks = (value as { blessingPicks?: unknown }).blessingPicks;
  if (Array.isArray(picks)) {
    base.blessingPicks = picks
      .filter((p): p is BlessingPath => (BLESSING_PATHS as readonly string[]).includes(p))
      .slice(0, PATH_TIERS.length);
  }

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
 * ponytail: re-picking an earlier tier is free here — in-game reset mechanics are
 * unrevealed; upgrade trigger is the official reset reveal (28 Jul+), after which
 * re-picks charge against blessingResetsUsed.
 */
export function pickBlessing(state: BuildState, pathTier: number, path: BlessingPath): BuildState {
  const idx = PATH_TIERS.indexOf(pathTier);
  if (idx === -1 || idx > state.blessingPicks.length) return state;
  const picks = state.blessingPicks.slice();
  if (picks[idx] === path) picks.length = idx;
  else picks[idx] = path;
  return { ...state, blessingPicks: picks };
}

/** Wipes blessing picks and spends one reset — no-op when none left or nothing to reset. */
export function resetBlessings(state: BuildState): BuildState {
  if (state.blessingResetsUsed >= BLESSING_RESET_COUNT || state.blessingPicks.length === 0) {
    return state;
  }
  return { ...state, blessingPicks: [], blessingResetsUsed: state.blessingResetsUsed + 1 };
}

export function blessingResetsLeft(state: BuildState): number {
  return BLESSING_RESET_COUNT - state.blessingResetsUsed;
}
