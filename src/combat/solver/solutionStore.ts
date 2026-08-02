/**
 * Browser cache of solved Revolution bars (localStorage).
 * Seeds later searches and restores last-known best for a loadout fingerprint.
 */

import { loadState, saveState } from "@/lib/storage";
import { SOLVER_SCHEMA_VERSION } from "./contracts";
import { stableStringify } from "./fingerprint";
import {
  isSerializableSimBase,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./worker/serializable";

export const REVO_SOLVE_CACHE_KEY = "eq:revo-solve:v1";
/** Short bars never compete on real revo bars — search floor for the product path. */
export const MIN_SOLVER_BAR_SIZE = 6;
export const DEFAULT_MAX_BAR_SIZE = 10;
const MAX_CACHE_ENTRIES = 48;
const MAX_TOP_PER_ENTRY = 5;
const MAX_SEED_BARS = 16;

export interface CachedSolveBar {
  bar: readonly string[];
  score: number;
}

export interface CachedSolveEntry {
  key: string;
  style: string;
  profileId: string;
  tier: string;
  minBarSize: number;
  maxBarSize: number;
  bar: readonly string[];
  score: number;
  top: readonly CachedSolveBar[];
  savedAt: number;
}

export interface SolveCacheStore {
  version: 1;
  entries: CachedSolveEntry[];
}

const EMPTY_STORE: SolveCacheStore = { version: 1, entries: [] };

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function normalizeTop(raw: unknown): CachedSolveBar[] {
  if (!Array.isArray(raw)) return [];
  const out: CachedSolveBar[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (!isStringArray(rec.bar) || rec.bar.length === 0) continue;
    const score = typeof rec.score === "number" && Number.isFinite(rec.score) ? rec.score : 0;
    out.push({ bar: rec.bar, score });
    if (out.length >= MAX_TOP_PER_ENTRY) break;
  }
  return out;
}

export function normalizeSolveCache(raw: unknown): SolveCacheStore {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STORE, entries: [] };
  const rec = raw as Record<string, unknown>;
  if (!Array.isArray(rec.entries)) return { ...EMPTY_STORE, entries: [] };
  const entries: CachedSolveEntry[] = [];
  for (const item of rec.entries) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    if (typeof e.key !== "string" || !e.key) continue;
    if (typeof e.style !== "string" || !e.style) continue;
    if (!isStringArray(e.bar) || e.bar.length === 0) continue;
    const score = typeof e.score === "number" && Number.isFinite(e.score) ? e.score : 0;
    entries.push({
      key: e.key,
      style: e.style,
      profileId: typeof e.profileId === "string" ? e.profileId : "balanced",
      tier: typeof e.tier === "string" ? e.tier : "thorough",
      minBarSize: typeof e.minBarSize === "number" ? e.minBarSize : MIN_SOLVER_BAR_SIZE,
      maxBarSize: typeof e.maxBarSize === "number" ? e.maxBarSize : DEFAULT_MAX_BAR_SIZE,
      bar: e.bar,
      score,
      top: normalizeTop(e.top),
      savedAt: typeof e.savedAt === "number" ? e.savedAt : 0,
    });
    if (entries.length >= MAX_CACHE_ENTRIES) break;
  }
  return { version: 1, entries };
}

/**
 * Fingerprint of "same solve job" — loadout combat numbers + regions + objective.
 * Schema bumps invalidate every entry.
 */
export function fingerprintSolveContext(request: SerializableSolverRequest): string {
  const loadout = request.loadout;
  const loadoutKey = isSerializableSimBase(loadout)
    ? {
        base: Math.round(loadout.base * 1000) / 1000,
        level: loadout.level,
        accuracy: Math.round(loadout.accuracy * 1e6) / 1e6,
        crit: loadout.crit,
        equipmentIds: [...loadout.equipmentIds].sort(),
        weaponConfiguration: loadout.weaponConfiguration,
        startingAdrenaline: loadout.startingAdrenaline ?? 0,
        plantedFeet: loadout.plantedFeet === true,
        preciseRank: loadout.preciseRank ?? 0,
        tumekensPieces: loadout.tumekensPieces ?? 0,
        tumekensCritEnabled: loadout.tumekensCritEnabled === true,
        targetHpPercent: loadout.targetHpPercent ?? 100,
        cap: loadout.cap ?? null,
        league: {
          ruleset: loadout.league.ruleset,
          blessingIds: [...loadout.league.blessingIds].sort(),
          totalArmour: loadout.league.totalArmour,
          maximumLife: loadout.league.maximumLife,
          powerburstUntilTick: loadout.league.powerburstUntilTick ?? 0,
          targetTiles: loadout.league.targetTiles,
          includeBigBonedOutgoingDamage:
            loadout.league.includeBigBonedOutgoingDamage === true,
        },
        modifierSources: loadout.modifierSources,
        passiveIds: [...(loadout.equipmentEffects.passiveIds ?? [])].sort(),
      }
    : loadout;

  return stableStringify({
    schema: request.schemaVersion ?? SOLVER_SCHEMA_VERSION,
    style: request.style,
    profileId: request.profileId,
    tier: request.tier,
    minBarSize: request.minBarSize,
    maxBarSize: request.maxBarSize,
    durationTicks: request.durationTicks,
    regions: [...request.unlockedRegions].sort(),
    disabled: [...(request.disabledAbilityIds ?? [])].sort(),
    ruleset: request.ruleset,
    loadout: loadoutKey,
  });
}

export function loadSolveCache(): SolveCacheStore {
  return loadState(REVO_SOLVE_CACHE_KEY, EMPTY_STORE, normalizeSolveCache);
}

export function saveSolveCache(store: SolveCacheStore): void {
  saveState(REVO_SOLVE_CACHE_KEY, {
    version: 1 as const,
    entries: store.entries.slice(0, MAX_CACHE_ENTRIES),
  });
}

/** Insert or refresh an entry (most-recent first LRU). */
export function upsertSolveEntry(
  store: SolveCacheStore,
  entry: CachedSolveEntry,
): SolveCacheStore {
  const rest = store.entries.filter((e) => e.key !== entry.key);
  return {
    version: 1,
    entries: [entry, ...rest].slice(0, MAX_CACHE_ENTRIES),
  };
}

export function rememberSolvedBar(
  request: SerializableSolverRequest,
  result: SolverResultDTO,
  now = Date.now(),
): CachedSolveEntry | null {
  const bar = result.bar?.filter((id) => typeof id === "string" && id.length > 0) ?? [];
  if (bar.length < MIN_SOLVER_BAR_SIZE) return null;
  if (!Number.isFinite(result.score)) return null;

  const key = fingerprintSolveContext(request);
  const top: CachedSolveBar[] = [];
  const seen = new Set<string>([bar.join("\0")]);
  top.push({ bar: [...bar], score: result.score });
  for (const t of result.top ?? []) {
    if (!t.bar?.length) continue;
    const fp = t.bar.join("\0");
    if (seen.has(fp)) continue;
    seen.add(fp);
    top.push({
      bar: [...t.bar],
      score: Number.isFinite(t.score) ? t.score : 0,
    });
    if (top.length >= MAX_TOP_PER_ENTRY) break;
  }

  const entry: CachedSolveEntry = {
    key,
    style: request.style,
    profileId: request.profileId,
    tier: request.tier,
    minBarSize: request.minBarSize,
    maxBarSize: request.maxBarSize,
    bar: [...bar],
    score: result.score,
    top,
    savedAt: now,
  };
  saveSolveCache(upsertSolveEntry(loadSolveCache(), entry));
  return entry;
}

export function lookupSolvedBar(key: string): CachedSolveEntry | null {
  return loadSolveCache().entries.find((e) => e.key === key) ?? null;
}

/**
 * Bars to seed the next search: exact context first, then other recent solves
 * for the same style (loadout may differ; eligibility filters drop illegal ones).
 */
export function seedBarsFromSolveCache(
  style: string,
  exactKey?: string,
  minLen = MIN_SOLVER_BAR_SIZE,
): string[][] {
  const store = loadSolveCache();
  const out: string[][] = [];
  const seen = new Set<string>();

  const push = (bar: readonly string[]) => {
    if (bar.length < minLen) return;
    const fp = bar.join("\0");
    if (seen.has(fp)) return;
    seen.add(fp);
    out.push([...bar]);
  };

  if (exactKey) {
    const hit = store.entries.find((e) => e.key === exactKey);
    if (hit) {
      push(hit.bar);
      for (const t of hit.top) push(t.bar);
    }
  }

  for (const e of store.entries) {
    if (e.style !== style) continue;
    if (exactKey && e.key === exactKey) continue;
    push(e.bar);
    for (const t of e.top) push(t.bar);
    if (out.length >= MAX_SEED_BARS) break;
  }

  return out.slice(0, MAX_SEED_BARS);
}

/** Clamp product path size bounds — never search sub-floor bars. */
export function clampSolverBarSizes(
  minBarSize?: number,
  maxBarSize?: number,
): { minBarSize: number; maxBarSize: number } {
  const min = Math.max(
    MIN_SOLVER_BAR_SIZE,
    Math.min(14, Math.floor(minBarSize ?? MIN_SOLVER_BAR_SIZE) || MIN_SOLVER_BAR_SIZE),
  );
  const max = Math.max(
    min,
    Math.min(14, Math.floor(maxBarSize ?? DEFAULT_MAX_BAR_SIZE) || DEFAULT_MAX_BAR_SIZE),
  );
  return { minBarSize: min, maxBarSize: max };
}
