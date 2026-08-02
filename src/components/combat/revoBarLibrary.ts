/**
 * Revolution bar library — last 5 autosaves + permanent saves.
 * Separate from the solve fingerprint cache (solutionStore).
 */

import { loadState, saveState } from "@/lib/storage";

export const REVO_BAR_LIBRARY_KEY = "eq:revo-bars:v1";
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
}

export interface RevoBarLibrary {
  version: 1;
  recents: RevoBarEntry[];
  saved: RevoBarEntry[];
}

export interface RememberBarInput {
  bar: readonly string[];
  style: string;
  score?: number | null;
  profileId?: string | null;
  tier?: string | null;
  name?: string | null;
  now?: number;
}

const EMPTY: RevoBarLibrary = { version: 1, recents: [], saved: [] };

export function emptyBarLibrary(): RevoBarLibrary {
  return { version: 1, recents: [], saved: [] };
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
}

export function barFingerprint(bar: readonly string[]): string {
  return bar.join("\0");
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
  const score =
    typeof e.score === "number" && Number.isFinite(e.score) ? e.score : null;
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
  return { version: 1, recents, saved };
}

export function loadBarLibrary(): RevoBarLibrary {
  return loadState(REVO_BAR_LIBRARY_KEY, EMPTY, normalizeBarLibrary);
}

export function saveBarLibrary(store: RevoBarLibrary): void {
  saveState(REVO_BAR_LIBRARY_KEY, {
    version: 1 as const,
    recents: store.recents.slice(0, MAX_RECENT_BARS),
    saved: store.saved.slice(0, MAX_SAVED_BARS),
  });
}

export function resetBarLibraryForTests(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(REVO_BAR_LIBRARY_KEY);
  } catch {
    // ignore
  }
}

function titleFor(input: RememberBarInput): string {
  if (input.name?.trim()) return input.name.trim();
  const n = input.bar.length;
  if (input.score != null && Number.isFinite(input.score)) {
    return `${n}-slot · ${Math.round(input.score).toLocaleString("en-US")}`;
  }
  return `${n}-slot bar`;
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
  const entry: RevoBarEntry = {
    id: newId("r", now),
    bar: [...bar],
    style: input.style,
    score: input.score != null && Number.isFinite(input.score) ? input.score : null,
    profileId: input.profileId ?? null,
    tier: input.tier ?? null,
    name: titleFor(input),
    kind: "recent",
    savedAt: now,
  };
  return {
    version: 1,
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
  const existing = store.saved.find(
    (e) => e.style === input.style && barFingerprint(e.bar) === fp,
  );
  const rest = store.saved.filter((e) => e.id !== existing?.id);
  const entry: RevoBarEntry = {
    id: existing?.id ?? newId("s", now),
    bar: [...bar],
    style: input.style,
    score:
      input.score != null && Number.isFinite(input.score) ? input.score : (existing?.score ?? null),
    profileId: input.profileId ?? existing?.profileId ?? null,
    tier: input.tier ?? existing?.tier ?? null,
    name: titleFor({ ...input, name: input.name ?? existing?.name }),
    kind: "saved",
    savedAt: now,
  };
  return {
    version: 1,
    recents: store.recents,
    saved: [entry, ...rest].slice(0, MAX_SAVED_BARS),
  };
}

export function withoutSavedBar(store: RevoBarLibrary, id: string): RevoBarLibrary {
  return {
    version: 1,
    recents: store.recents,
    saved: store.saved.filter((e) => e.id !== id),
  };
}

export function withoutRecentBar(store: RevoBarLibrary, id: string): RevoBarLibrary {
  return {
    version: 1,
    recents: store.recents.filter((e) => e.id !== id),
    saved: store.saved,
  };
}

/** Load → mutate → persist helpers for the panel. */
export function pushRecentBar(input: RememberBarInput): RevoBarLibrary {
  const next = withRecentBar(loadBarLibrary(), input);
  saveBarLibrary(next);
  return next;
}

export function savePermanentBar(input: RememberBarInput): RevoBarLibrary {
  const next = withPermanentBar(loadBarLibrary(), input);
  saveBarLibrary(next);
  return next;
}

export function removeSavedBar(id: string): RevoBarLibrary {
  const next = withoutSavedBar(loadBarLibrary(), id);
  saveBarLibrary(next);
  return next;
}

export function removeRecentBar(id: string): RevoBarLibrary {
  const next = withoutRecentBar(loadBarLibrary(), id);
  saveBarLibrary(next);
  return next;
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
