import { loadState, saveState } from "@/lib/storage";
import { taskPoints, type TaskRecord } from "./index";

export const STORAGE_KEY = "eq:tasks:v1";
export const TASK_DB_NAME = "equilibrium";
export const TASK_DB_STORE = "task-progress";

const TASK_DB_KEY = "progress";
const TASK_DB_VERSION = 1;
let taskDbPromise: Promise<IDBDatabase | null> | null = null;

export type TaskProgress = {
  completed: string[];
};

export type WikiTaskPageImport = {
  completedTaskIds: number[];
  taskRows: number;
};

export const EMPTY_PROGRESS: TaskProgress = { completed: [] };

function htmlAttribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

/** Read WikiSync completion markers from a user-saved task page without executing its HTML. */
export function parseWikiTaskPage(html: string): WikiTaskPageImport {
  const completedTaskIds = new Set<number>();
  let taskRows = 0;

  for (const match of html.matchAll(/<tr\b[^>]*>/gi)) {
    const tag = match[0];
    const rawId = htmlAttribute(tag, "data-taskid");
    if (!rawId || !/^\d+$/.test(rawId)) continue;
    const taskId = Number(rawId);
    if (!Number.isSafeInteger(taskId)) continue;
    taskRows += 1;

    const classes = htmlAttribute(tag, "class")?.split(/\s+/) ?? [];
    if (classes.includes("wikisync-completed")) completedTaskIds.add(taskId);
  }

  return { completedTaskIds: [...completedTaskIds], taskRows };
}

/**
 * Prefer record.id, then wiki task id, else `${tier}:${name}` (lowercased).
 * Catalyst stand-in sets id to `wiki:{taskId}` so progress survives renames.
 */
export function taskId(record: TaskRecord): string {
  if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
  if (typeof record.wikiTaskId === "number") return `wiki:${record.wikiTaskId}`;
  return `${record.tier}:${record.name}`.toLowerCase();
}

/** Pre-wiki-id key used by older Catalyst stand-in progress. */
export function legacyTaskId(record: TaskRecord): string {
  return `${record.tier}:${record.name}`.toLowerCase();
}

export function normalizeProgress(raw: unknown): TaskProgress {
  if (typeof raw !== "object" || raw === null) return { completed: [] };
  const completed = (raw as { completed?: unknown }).completed;
  if (!Array.isArray(completed)) return { completed: [] };
  return {
    completed: [
      ...new Set(
        completed.filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ],
  };
}

/**
 * Map legacy `tier:name` progress keys onto canonical ids (`wiki:N` / record.id).
 * Returns the same object when nothing changes so callers can skip a save.
 */
export function migrateProgressIds(
  progress: TaskProgress,
  records: readonly TaskRecord[],
): TaskProgress {
  if (progress.completed.length === 0 || records.length === 0) return progress;

  const legacyToCanonical = new Map<string, string>();
  for (const record of records) {
    const canonical = taskId(record);
    const legacy = legacyTaskId(record);
    if (legacy !== canonical) legacyToCanonical.set(legacy, canonical);
  }
  if (legacyToCanonical.size === 0) return progress;

  let changed = false;
  const next: string[] = [];
  const seen = new Set<string>();
  for (const id of progress.completed) {
    const mapped = legacyToCanonical.get(id) ?? id;
    if (mapped !== id) changed = true;
    if (seen.has(mapped)) {
      changed = true;
      continue;
    }
    seen.add(mapped);
    next.push(mapped);
  }
  if (!changed) return progress;
  return { completed: next };
}

export function loadProgress(): TaskProgress {
  return loadState(STORAGE_KEY, EMPTY_PROGRESS, normalizeProgress);
}

function openTaskDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  if (taskDbPromise) return taskDbPromise;

  taskDbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(TASK_DB_NAME, TASK_DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(TASK_DB_STORE)) {
          request.result.createObjectStore(TASK_DB_STORE);
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return taskDbPromise;
}

async function readProgressFromDb(): Promise<TaskProgress | null> {
  try {
    const db = await openTaskDb();
    if (!db) return null;
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = db
        .transaction(TASK_DB_STORE, "readonly")
        .objectStore(TASK_DB_STORE)
        .get(TASK_DB_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return raw === undefined ? null : normalizeProgress(raw);
  } catch {
    return null;
  }
}

async function writeProgressToDb(state: TaskProgress): Promise<void> {
  try {
    const db = await openTaskDb();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TASK_DB_STORE, "readwrite");
      transaction.objectStore(TASK_DB_STORE).put(normalizeProgress(state), TASK_DB_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // localStorage remains the fallback when IndexedDB is unavailable.
  }
}

/** IndexedDB-first load, migrating the existing localStorage progress on first use. */
export async function loadProgressFromBrowserDb(
  records: readonly TaskRecord[],
): Promise<TaskProgress> {
  const stored = await readProgressFromDb();
  const progress = migrateProgressIds(stored ?? loadProgress(), records);
  if (stored === null || progress !== stored) await writeProgressToDb(progress);
  return progress;
}

export function saveProgress(state: TaskProgress): void {
  const normalized = normalizeProgress(state);
  saveState(STORAGE_KEY, normalized);
  void writeProgressToDb(normalized);
}

export function isComplete(state: TaskProgress, id: string): boolean {
  return state.completed.includes(id);
}

export function toggleComplete(state: TaskProgress, id: string): TaskProgress {
  const set = new Set(state.completed);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return { completed: [...set] };
}

/** Merge known Wiki task ids into local progress; unknown ids are ignored. */
export function mergeWikiTaskProgress(
  state: TaskProgress,
  records: readonly TaskRecord[],
  wikiTaskIds: readonly number[],
): { progress: TaskProgress; matched: number; added: number } {
  const canonicalByWikiId = new Map(
    records.flatMap((record) =>
      typeof record.wikiTaskId === "number"
        ? [[record.wikiTaskId, taskId(record)] as const]
        : [],
    ),
  );
  const completed = new Set(state.completed);
  let matched = 0;
  let added = 0;

  for (const wikiTaskId of new Set(wikiTaskIds)) {
    const canonical = canonicalByWikiId.get(wikiTaskId);
    if (!canonical) continue;
    matched += 1;
    if (completed.has(canonical)) continue;
    completed.add(canonical);
    added += 1;
  }

  return {
    progress: added > 0 ? { completed: [...completed] } : state,
    matched,
    added,
  };
}

/** Count completed ids; when records given, only those present in the set. */
export function completedCount(
  state: TaskProgress,
  records?: readonly TaskRecord[],
): number {
  if (!records) return state.completed.length;
  const ids = new Set(records.map(taskId));
  return state.completed.filter((id) => ids.has(id)).length;
}

/** Sum points for completed tasks that appear in `records` (filtered set ok). */
export function pointsEarned(
  state: TaskProgress,
  records: readonly TaskRecord[],
  tiers: Record<string, number>,
): number {
  const done = new Set(state.completed);
  let total = 0;
  for (const record of records) {
    if (!done.has(taskId(record))) continue;
    const pts = taskPoints(record, tiers);
    if (pts !== null) total += pts;
  }
  return total;
}

export function pointsTotal(
  records: readonly TaskRecord[],
  tiers: Record<string, number>,
): number {
  let total = 0;
  for (const record of records) {
    const pts = taskPoints(record, tiers);
    if (pts !== null) total += pts;
  }
  return total;
}
