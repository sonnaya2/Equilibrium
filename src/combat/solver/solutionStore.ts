/**
 * Browser cache of solved Revolution bars (localStorage).
 * Keys are SHA-256 of a stable loadout/objective payload so entries stay short
 * and do not blow the quota (full JSON keys silently failed to save).
 */

import { loadState, saveState } from "@/lib/storage";
import { SOLVER_SCHEMA_VERSION } from "./contracts";
import { stableStringify } from "./fingerprint";
import {
  isSerializableSimBase,
  type SerializableModifierSources,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./worker/serializable";

export const REVO_SOLVE_CACHE_KEY = "eq:revo-solve:v2";
/** @deprecated read-only migration from pre-hash storage */
const REVO_SOLVE_CACHE_KEY_V1 = "eq:revo-solve:v1";

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
  /** SHA-256 hex of canonical solve context (64 chars). */
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
  version: 2;
  entries: CachedSolveEntry[];
}

const EMPTY_STORE: SolveCacheStore = { version: 2, entries: [] };

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
  return { version: 2, entries };
}

function roundN(n: number, places: number): number {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}

function normalizeModifierSources(sources: SerializableModifierSources): unknown {
  const setCounts = [...sources.setCounts]
    .map(([id, n]) => [id, n] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return {
    vulnerability: sources.vulnerability === true,
    styleCurseId: sources.styleCurseId ?? "none",
    amZiFlatDamage: roundN(sources.amZiFlatDamage ?? 0, 4),
    amHejDamageBonus: roundN(sources.amHejDamageBonus ?? 0, 6),
    setCounts,
    slayer: {
      demon: sources.slayer?.demon ?? 0,
      dragon: sources.slayer?.dragon ?? 0,
      undead: sources.slayer?.undead ?? 0,
    },
    target: {
      demon: sources.target?.demon === true,
      dragon: sources.target?.dragon === true,
      undead: sources.target?.undead === true,
    },
    ultimatums: sources.ultimatums ?? 0,
    lunging: sources.lunging ?? 0,
  };
}

/**
 * Stable, JSON-safe solve identity. Omits wall-clock / remaining-tick fields that
 * would invalidate the cache every second (e.g. powerburstUntilTick countdown).
 */
export function canonicalSolveContext(request: SerializableSolverRequest): unknown {
  const loadout = request.loadout;
  const loadoutKey = isSerializableSimBase(loadout)
    ? {
        base: roundN(loadout.base, 3),
        level: loadout.level,
        accuracy: roundN(loadout.accuracy, 6),
        crit: {
          chance: roundN(loadout.crit?.chance ?? 0, 6),
          disabled: loadout.crit?.disabled === true,
          damageBonus: roundN(loadout.crit?.damageBonus ?? 0, 6),
          guaranteed: loadout.crit?.guaranteed === true,
        },
        equipmentIds: [...loadout.equipmentIds].sort(),
        weaponConfiguration: loadout.weaponConfiguration,
        startingAdrenaline: loadout.startingAdrenaline ?? 0,
        plantedFeet: loadout.plantedFeet === true,
        preciseRank: loadout.preciseRank ?? 0,
        tumekensPieces: loadout.tumekensPieces ?? 0,
        tumekensCritEnabled: loadout.tumekensCritEnabled === true,
        targetHpPercent: loadout.targetHpPercent ?? 100,
        cap: loadout.cap ?? null,
        adrenaline: loadout.adrenaline
          ? {
              abilityGainMultiplier: roundN(loadout.adrenaline.abilityGainMultiplier ?? 1, 6),
              basicGainMultiplier: roundN(loadout.adrenaline.basicGainMultiplier ?? 1, 6),
              impatientRank: loadout.adrenaline.impatientRank ?? 0,
              impatientLevel20: loadout.adrenaline.impatientLevel20 === true,
              relentlessRank: loadout.adrenaline.relentlessRank ?? 0,
              relentlessLevel20: loadout.adrenaline.relentlessLevel20 === true,
            }
          : null,
        procs: loadout.procs
          ? {
              cracklingRank: loadout.procs.cracklingRank ?? 0,
              aftershockRank: loadout.procs.aftershockRank ?? 0,
            }
          : null,
        league: {
          ruleset: loadout.league.ruleset,
          blessingIds: [...loadout.league.blessingIds].sort(),
          totalArmour: loadout.league.totalArmour,
          maximumLife: loadout.league.maximumLife,
          // Boolean only — remaining ticks tick down and would thrash the key.
          powerburstActive: (loadout.league.powerburstUntilTick ?? 0) > 0,
          targetTiles: loadout.league.targetTiles,
          includeBigBonedOutgoingDamage: loadout.league.includeBigBonedOutgoingDamage !== false,
        },
        modifierSources: normalizeModifierSources(loadout.modifierSources),
        passiveIds: [...(loadout.equipmentEffects.passiveIds ?? [])].map(String).sort(),
        vestmentsPieces: loadout.equipmentEffects.vestments?.pieces ?? 0,
      }
    : { kind: "plain", loadout };

  return {
    schema: request.schemaVersion ?? SOLVER_SCHEMA_VERSION,
    style: request.style,
    profileId: request.profileId,
    tier: request.tier,
    minBarSize: request.minBarSize,
    maxBarSize: request.maxBarSize,
    durationTicks: request.durationTicks,
    exploreDurationTicks: request.exploreDurationTicks ?? null,
    regions: [...request.unlockedRegions].sort(),
    includeUnknownAvailability: request.includeUnknownAvailability === true,
    includePartial: request.includePartial === true,
    disabled: [...(request.disabledAbilityIds ?? [])].sort(),
    ruleset: request.ruleset,
    loadout: loadoutKey,
  };
}

/** Sync stable payload string (for tests / debugging). */
export function solveContextPayload(request: SerializableSolverRequest): string {
  return stableStringify(canonicalSolveContext(request));
}

/** SHA-256 hex digest of the canonical context (Web Crypto or Node). */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Fingerprint of "same solve job" — compact SHA-256 for localStorage keys.
 * Schema bumps in the payload invalidate every entry.
 */
export async function fingerprintSolveContext(request: SerializableSolverRequest): Promise<string> {
  return sha256Hex(solveContextPayload(request));
}

/** Test helper — clear in-memory-facing storage key. */
export function resetSolveCacheForTests(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(REVO_SOLVE_CACHE_KEY);
    window.localStorage?.removeItem(REVO_SOLVE_CACHE_KEY_V1);
  } catch {
    // ignore
  }
}

export function loadSolveCache(): SolveCacheStore {
  const v2 = loadState(REVO_SOLVE_CACHE_KEY, EMPTY_STORE, normalizeSolveCache);
  if (v2.entries.length > 0) return v2;

  // One-shot style seed recovery from v1: keep bars, drop unusable huge keys.
  const v1 = loadState(REVO_SOLVE_CACHE_KEY_V1, EMPTY_STORE, normalizeSolveCache);
  if (v1.entries.length === 0) return EMPTY_STORE;
  const migrated: CachedSolveEntry[] = v1.entries.map((e, i) => ({
    ...e,
    // Old keys were multi-KB JSON — mark as style-only seeds, never exact hits.
    key: `v1-migrated-${e.style}-${i}-${e.bar.join(",")}`,
  }));
  const store = { version: 2 as const, entries: migrated.slice(0, MAX_CACHE_ENTRIES) };
  saveSolveCache(store);
  try {
    window.localStorage?.removeItem(REVO_SOLVE_CACHE_KEY_V1);
  } catch {
    // ignore
  }
  return store;
}

export function saveSolveCache(store: SolveCacheStore): void {
  saveState(REVO_SOLVE_CACHE_KEY, {
    version: 2 as const,
    entries: store.entries.slice(0, MAX_CACHE_ENTRIES),
  });
}

/** Insert or refresh an entry (most-recent first LRU). */
export function upsertSolveEntry(store: SolveCacheStore, entry: CachedSolveEntry): SolveCacheStore {
  const rest = store.entries.filter((e) => e.key !== entry.key);
  return {
    version: 2,
    entries: [entry, ...rest].slice(0, MAX_CACHE_ENTRIES),
  };
}

export async function rememberSolvedBar(
  request: SerializableSolverRequest,
  result: SolverResultDTO,
  now = Date.now(),
): Promise<CachedSolveEntry | null> {
  const bar = result.bar?.filter((id) => typeof id === "string" && id.length > 0) ?? [];
  if (bar.length < MIN_SOLVER_BAR_SIZE) return null;
  if (!Number.isFinite(result.score)) return null;

  const key = await fingerprintSolveContext(request);
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
