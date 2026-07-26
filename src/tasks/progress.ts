import { loadState, saveState } from "@/lib/storage";
import { taskPoints, type TaskRecord } from "./index";

export const STORAGE_KEY = "eq:tasks:v1";

export type TaskProgress = {
  completed: string[];
};

export const EMPTY_PROGRESS: TaskProgress = { completed: [] };

/** Prefer record.id when present; else stable `${tier}:${name}` (lowercased). */
export function taskId(record: TaskRecord): string {
  if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
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

export function loadProgress(): TaskProgress {
  return loadState(STORAGE_KEY, EMPTY_PROGRESS, normalizeProgress);
}

export function saveProgress(state: TaskProgress): void {
  saveState(STORAGE_KEY, normalizeProgress(state));
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
