/**
 * Revolution bar library - last 5 autosaves + permanent saves.
 * Separate from the solve fingerprint cache (solutionStore).
 * Scores marked verified only when bound to a simulation identity (scoreContext).
 */

import { loadState, saveState } from "@/lib/storage";
import type { SolverAbilityRules } from "./solverAbilityRules";

export const REVO_BAR_LIBRARY_KEY = "eq:revo-bars:v2";
/** @deprecated read-only migration from pre-context storage */
const REVO_BAR_LIBRARY_KEY_V1 = "eq:revo-bars:v1";
export const ROTATION_WORKSPACE_KEY = "eq:rotation-workspace:v1";
/** Own key so workspace bar/mode saves cannot drop the flag. */
export const LIMIT_TO_REGIONS_KEY = "eq:rotation-limit-regions:v1";

export const MAX_RECENT_BARS = 5;
export const MAX_SAVED_BARS = 40;

export type RevoBarEntryKind = "recent" | "saved";

export interface RevoBarEntry {
  id: string;
  bar: readonly string[];
  style: string;
  score: number | null;
  profileId: string | null;
  tier: string | null;
  /** Optional label; autosaves get a short generated title. */
  name: string | null;
  kind: RevoBarEntryKind;
  savedAt: number;
  /**
   * True only when the score comes from a completed final solver result
   * and is bound to scoreContext. Manual / stopped / exploratory saves are unverified.
   */
  verified: boolean;
  /**
   * Simulation identity the score was earned under (e.g. solveContextPayload).
   * Required for verified; null means estimate-only.
   */
  scoreContext: string | null;
}

export interface RevoBarLibrary {
  version: 2;
  recents: RevoBarEntry[];
  saved: RevoBarEntry[];
}

export type RotationMode = "revolution" | "manual";

type RotationWorkspace = {
  version: 1;
  mode: RotationMode;
  activeBars: Record<string, string[]>;
  abilityRules: Record<string, SolverAbilityRules>;
  runDurationSeconds: number;
  /** Solver + ability: only Build regions when true. */
  limitToRegions: boolean;
};

export interface RememberBarInput {
  bar: readonly string[];
  style: string;
  score?: number | null;
  profileId?: string | null;
  tier?: string | null;
  name?: string | null;
  now?: number;
  /** Defaults false - only completed finals should pass true. */
  verified?: boolean;
  /** Identity the score belongs to; required for verified to stick. */
  scoreContext?: string | null;
}

const EMPTY: RevoBarLibrary = { version: 2, recents: [], saved: [] };
const EMPTY_WORKSPACE: RotationWorkspace = {
  version: 1,
  mode: "revolution",
  activeBars: {},
  abilityRules: {},
  runDurationSeconds: 60,
  limitToRegions: true,
};

export function emptyBarLibrary(): RevoBarLibrary {
  return { version: 2, recents: [], saved: [] };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
}

function rotationContext(style: string, weaponConfiguration: string): string {
  return `${style}|${weaponConfiguration}`;
}

function normalizeAbilityRuleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

function normalizeAbilityRules(raw: unknown): SolverAbilityRules {
  if (!raw || typeof raw !== "object") {
    return { lockedAbilityIds: [], disabledAbilityIds: [] };
  }
  const record = raw as Record<string, unknown>;
  const lockedAbilityIds = normalizeAbilityRuleIds(record.lockedAbilityIds);
  const locked = new Set(lockedAbilityIds);
  const disabledAbilityIds = normalizeAbilityRuleIds(record.disabledAbilityIds).filter(
    (id) => !locked.has(id),
  );
  return { lockedAbilityIds, disabledAbilityIds };
}

function normalizeRotationWorkspace(raw: unknown): RotationWorkspace {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_WORKSPACE, activeBars: {}, abilityRules: {} };
  }
  const record = raw as Record<string, unknown>;
  const mode: RotationMode = record.mode === "manual" ? "manual" : "revolution";
  const runDurationSeconds =
    typeof record.runDurationSeconds === "number" && Number.isFinite(record.runDurationSeconds)
      ? Math.min(1000, Math.max(6, Math.floor(record.runDurationSeconds)))
      : EMPTY_WORKSPACE.runDurationSeconds;
  const activeBars: Record<string, string[]> = {};
  if (record.activeBars && typeof record.activeBars === "object") {
    for (const [context, bar] of Object.entries(record.activeBars)) {
      if (isStringArray(bar) && bar.length > 0) activeBars[context] = [...bar];
    }
  }
  const abilityRules: Record<string, SolverAbilityRules> = {};
  if (record.abilityRules && typeof record.abilityRules === "object") {
    for (const [context, value] of Object.entries(record.abilityRules)) {
      const rules = normalizeAbilityRules(value);
      if (rules.lockedAbilityIds.length > 0 || rules.disabledAbilityIds.length > 0) {
        abilityRules[context] = rules;
      }
    }
  }
  return {
    version: 1,
    mode,
    activeBars,
    abilityRules,
    runDurationSeconds,
    limitToRegions: record.limitToRegions === true,
  };
}

function loadRotationWorkspace(): RotationWorkspace {
  return loadState(
    ROTATION_WORKSPACE_KEY,
    { ...EMPTY_WORKSPACE, activeBars: {}, abilityRules: {} },
    normalizeRotationWorkspace,
  );
}

function saveRotationWorkspace(workspace: RotationWorkspace): void {
  saveState(ROTATION_WORKSPACE_KEY, workspace);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event("eq:rotation:changed"));
  }
}

export function loadRotationMode(): RotationMode {
  return loadRotationWorkspace().mode;
}

export function saveRotationMode(mode: RotationMode): void {
  const workspace = loadRotationWorkspace();
  saveRotationWorkspace({ ...workspace, mode });
}

export function loadRevoRunDuration(): number {
  return loadRotationWorkspace().runDurationSeconds;
}

export function saveRevoRunDuration(runDurationSeconds: number): void {
  const workspace = loadRotationWorkspace();
  saveRotationWorkspace(normalizeRotationWorkspace({ ...workspace, runDurationSeconds }));
}

export function loadLimitToRegions(): boolean {
  // Dedicated key first (survives partial workspace overwrites).
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LIMIT_TO_REGIONS_KEY);
      if (raw === "1" || raw === "true") return true;
      if (raw === "0" || raw === "false") return false;
      // No key yet: default ON (league build regions only).
      if (raw === null) return true;
    } catch {
      // fall through
    }
  }
  // Workspace-only: true when set; default ON when field absent on old blobs.
  const ws = loadRotationWorkspace();
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(ROTATION_WORKSPACE_KEY);
      if (raw == null) return true;
      const parsed = JSON.parse(raw) as { limitToRegions?: unknown };
      if (!("limitToRegions" in parsed)) return true;
    } catch {
      return true;
    }
  }
  return ws.limitToRegions === true;
}

export function saveLimitToRegions(limitToRegions: boolean): void {
  const on = limitToRegions === true;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LIMIT_TO_REGIONS_KEY, on ? "1" : "0");
    }
  } catch {
    // Quota / privacy mode
  }
  const workspace = loadRotationWorkspace();
  saveRotationWorkspace({ ...workspace, limitToRegions: on });
}

export function loadActiveRevoBar(style: string, weaponConfiguration: string): string[] | null {
  const bar = loadRotationWorkspace().activeBars[rotationContext(style, weaponConfiguration)];
  return bar?.length ? [...bar] : null;
}

export function saveActiveRevoBar(
  style: string,
  weaponConfiguration: string,
  bar: readonly string[] | null,
): void {
  const workspace = loadRotationWorkspace();
  const context = rotationContext(style, weaponConfiguration);
  const activeBars = { ...workspace.activeBars };
  if (bar?.length) activeBars[context] = [...bar];
  else delete activeBars[context];
  saveRotationWorkspace({ ...workspace, activeBars });
}

export function loadRevoAbilityRules(
  style: string,
  weaponConfiguration: string,
): SolverAbilityRules {
  const rules = loadRotationWorkspace().abilityRules[rotationContext(style, weaponConfiguration)];
  return rules
    ? {
        lockedAbilityIds: [...rules.lockedAbilityIds],
        disabledAbilityIds: [...rules.disabledAbilityIds],
      }
    : { lockedAbilityIds: [], disabledAbilityIds: [] };
}

export function saveRevoAbilityRules(
  style: string,
  weaponConfiguration: string,
  rules: SolverAbilityRules,
): void {
  const workspace = loadRotationWorkspace();
  const context = rotationContext(style, weaponConfiguration);
  const abilityRules = { ...workspace.abilityRules };
  const normalized = normalizeAbilityRules(rules);
  if (normalized.lockedAbilityIds.length > 0 || normalized.disabledAbilityIds.length > 0) {
    abilityRules[context] = normalized;
  } else {
    delete abilityRules[context];
  }
  saveRotationWorkspace({ ...workspace, abilityRules });
}

export function barFingerprint(bar: readonly string[]): string {
  return bar.join("\0");
}

/** Non-empty context string, else null. */
export function barScoreContext(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/** Verified score only when entry claims verified and contexts match live. */
export function isScoreVerifiedForContext(
  entry: RevoBarEntry,
  liveContext: string | null | undefined,
): boolean {
  if (entry.verified !== true) return false;
  const bound = barScoreContext(entry.scoreContext);
  const live = barScoreContext(liveContext);
  if (!bound || !live) return false;
  return bound === live;
}

function newId(prefix: string, now: number): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${now.toString(36)}-${rand}`;
}

function normalizeEntry(raw: unknown, kind: RevoBarEntryKind): RevoBarEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || !e.id) return null;
  if (typeof e.style !== "string" || !e.style) return null;
  if (!isStringArray(e.bar) || e.bar.length === 0) return null;
  const score = typeof e.score === "number" && Number.isFinite(e.score) ? e.score : null;
  const scoreContext = barScoreContext(typeof e.scoreContext === "string" ? e.scoreContext : null);
  // verified requires a bound scoreContext; strip otherwise.
  const verified = e.verified === true && scoreContext != null;
  return {
    id: e.id,
    bar: [...e.bar],
    style: e.style,
    score,
    profileId: typeof e.profileId === "string" ? e.profileId : null,
    tier: typeof e.tier === "string" ? e.tier : null,
    name: typeof e.name === "string" && e.name.trim() ? e.name.trim() : null,
    kind,
    savedAt: typeof e.savedAt === "number" && Number.isFinite(e.savedAt) ? e.savedAt : 0,
    verified,
    scoreContext,
  };
}

export function normalizeBarLibrary(raw: unknown): RevoBarLibrary {
  if (!raw || typeof raw !== "object") return { ...EMPTY, recents: [], saved: [] };
  const rec = raw as Record<string, unknown>;
  const recents: RevoBarEntry[] = [];
  const saved: RevoBarEntry[] = [];
  if (Array.isArray(rec.recents)) {
    for (const item of rec.recents) {
      const e = normalizeEntry(item, "recent");
      if (e) recents.push(e);
      if (recents.length >= MAX_RECENT_BARS) break;
    }
  }
  if (Array.isArray(rec.saved)) {
    for (const item of rec.saved) {
      const e = normalizeEntry(item, "saved");
      if (e) saved.push(e);
      if (saved.length >= MAX_SAVED_BARS) break;
    }
  }
  return { version: 2, recents, saved };
}

/** v1 -> v2: keep every bar and score; drop verified claim (no identity). */
function migrateV1ToV2(raw: unknown): RevoBarLibrary {
  const base = normalizeBarLibrary(raw);
  return {
    version: 2,
    recents: base.recents.map((e) => ({
      ...e,
      verified: false,
      scoreContext: null,
    })),
    saved: base.saved.map((e) => ({
      ...e,
      verified: false,
      scoreContext: null,
    })),
  };
}

export function loadBarLibrary(): RevoBarLibrary {
  const v2 = loadState(REVO_BAR_LIBRARY_KEY, EMPTY, normalizeBarLibrary);
  if (v2.recents.length > 0 || v2.saved.length > 0) return v2;

  const v1 = loadState(REVO_BAR_LIBRARY_KEY_V1, EMPTY, migrateV1ToV2);
  if (v1.recents.length === 0 && v1.saved.length === 0) return EMPTY;

  saveBarLibrary(v1);
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.removeItem(REVO_BAR_LIBRARY_KEY_V1);
    }
  } catch {
    // ignore
  }
  return v1;
}

export function saveBarLibrary(store: RevoBarLibrary): void {
  saveState(REVO_BAR_LIBRARY_KEY, {
    version: 2 as const,
    recents: store.recents.slice(0, MAX_RECENT_BARS),
    saved: store.saved.slice(0, MAX_SAVED_BARS),
  });
}

export function resetBarLibraryForTests(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(REVO_BAR_LIBRARY_KEY);
    window.localStorage?.removeItem(REVO_BAR_LIBRARY_KEY_V1);
    window.localStorage?.removeItem(ROTATION_WORKSPACE_KEY);
    window.localStorage?.removeItem(LIMIT_TO_REGIONS_KEY);
  } catch {
    // ignore
  }
}

function titleFor(input: RememberBarInput & { verified: boolean }): string {
  if (input.name?.trim()) return input.name.trim();
  const n = input.bar.length;
  if (input.score != null && Number.isFinite(input.score)) {
    const rounded = Math.round(input.score).toLocaleString("en-US");
    if (input.verified === true) return `${n}-slot · ${rounded}`;
    // Exploratory / manual - do not look like a completed-solve claim.
    return `${n}-slot · ~${rounded}`;
  }
  return `${n}-slot bar`;
}

function resolveVerified(
  wantVerified: boolean | undefined,
  scoreContext: string | null,
  existingVerified: boolean,
): boolean {
  let verified: boolean;
  if (wantVerified === true) verified = true;
  else if (wantVerified === false) verified = false;
  else verified = existingVerified;
  if (verified && scoreContext == null) return false;
  return verified;
}

/** Pure: push into Autosaves (MRU, max 5). Same fingerprint bumps to front. */
export function withRecentBar(store: RevoBarLibrary, input: RememberBarInput): RevoBarLibrary {
  const bar = input.bar.filter((id) => typeof id === "string" && id.length > 0);
  if (bar.length === 0) return store;

  const now = input.now ?? Date.now();
  const fp = barFingerprint(bar);
  const rest = store.recents.filter(
    (e) => !(e.style === input.style && barFingerprint(e.bar) === fp),
  );
  const scoreContext = barScoreContext(input.scoreContext);
  const verified = resolveVerified(input.verified, scoreContext, false);
  const entry: RevoBarEntry = {
    id: newId("r", now),
    bar: [...bar],
    style: input.style,
    score: input.score != null && Number.isFinite(input.score) ? input.score : null,
    profileId: input.profileId ?? null,
    tier: input.tier ?? null,
    name: titleFor({ ...input, verified }),
    kind: "recent",
    savedAt: now,
    verified,
    scoreContext,
  };
  return {
    version: 2,
    recents: [entry, ...rest].slice(0, MAX_RECENT_BARS),
    saved: store.saved,
  };
}

/** Pure: permanently save bar; same fingerprint updates score/name (MRU). */
export function withPermanentBar(store: RevoBarLibrary, input: RememberBarInput): RevoBarLibrary {
  const bar = input.bar.filter((id) => typeof id === "string" && id.length > 0);
  if (bar.length === 0) return store;

  const now = input.now ?? Date.now();
  const fp = barFingerprint(bar);
  const existing = store.saved.find((e) => e.style === input.style && barFingerprint(e.bar) === fp);
  const rest = store.saved.filter((e) => e.id !== existing?.id);
  const scoreContext =
    input.scoreContext !== undefined
      ? barScoreContext(input.scoreContext)
      : (existing?.scoreContext ?? null);
  // Manual save defaults unverified; only explicit true marks verified.
  // Replacing a verified entry with an unverified save clears the claim.
  const verified = resolveVerified(input.verified, scoreContext, existing?.verified ?? false);
  const entry: RevoBarEntry = {
    id: existing?.id ?? newId("s", now),
    bar: [...bar],
    style: input.style,
    score:
      input.score != null && Number.isFinite(input.score) ? input.score : (existing?.score ?? null),
    profileId: input.profileId ?? existing?.profileId ?? null,
    tier: input.tier ?? existing?.tier ?? null,
    name: titleFor({ ...input, name: input.name ?? existing?.name, verified }),
    kind: "saved",
    savedAt: now,
    verified,
    scoreContext,
  };
  return {
    version: 2,
    recents: store.recents,
    saved: [entry, ...rest].slice(0, MAX_SAVED_BARS),
  };
}

export function withoutSavedBar(store: RevoBarLibrary, id: string): RevoBarLibrary {
  return {
    version: 2,
    recents: store.recents,
    saved: store.saved.filter((e) => e.id !== id),
  };
}

export function withoutRecentBar(store: RevoBarLibrary, id: string): RevoBarLibrary {
  return {
    version: 2,
    recents: store.recents.filter((e) => e.id !== id),
    saved: store.saved,
  };
}

/** Entries for a style, recents first then permanent (each newest-first). */
export function libraryForStyle(
  store: RevoBarLibrary,
  style: string,
): { recents: RevoBarEntry[]; saved: RevoBarEntry[] } {
  return {
    recents: store.recents.filter((e) => e.style === style),
    saved: store.saved.filter((e) => e.style === style),
  };
}

export function isBarAlreadySaved(
  store: RevoBarLibrary,
  style: string,
  bar: readonly string[],
): boolean {
  if (bar.length === 0) return false;
  const fp = barFingerprint(bar);
  return store.saved.some((e) => e.style === style && barFingerprint(e.bar) === fp);
}
