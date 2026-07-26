/**
 * Shared task-record contract. Equilibrium records stay canonical. Catalyst
 * League rows may use the same renderer as a stand-in until Equilibrium
 * publishes its task list.
 */

export const TASK_ORDER = ["easy", "medium", "hard", "elite", "master"] as const;
export type TaskTier = (typeof TASK_ORDER)[number];

export interface TaskRecord {
  name: string;
  tier: string;
  points?: number;
  description?: string;
  region?: string;
  skills?: string[];
  areas?: string[];
  requirements?: string;
  sourceLeague?: string;
  testingOnly?: boolean;
  catalystCompletionRate?: number;
  catalystCompletionRateQualifier?: "<";
}

export function asTaskRecords(value: unknown): TaskRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is TaskRecord =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as { name?: unknown }).name === "string" &&
      typeof (r as { tier?: unknown }).tier === "string",
  );
}

/** Record points win; the tier table is the fallback while records carry none. */
export function taskPoints(record: TaskRecord, tiers: Record<string, number>): number | null {
  if (typeof record.points === "number") return record.points;
  return tiers[record.tier] ?? null;
}

export function isTaskTier(tier: string): tier is TaskTier {
  return (TASK_ORDER as readonly string[]).includes(tier);
}

export function filterTasks(
  records: readonly TaskRecord[],
  tier: TaskTier | "all",
  query: string,
): TaskRecord[] {
  const needle = query.trim().toLowerCase();
  return records.filter((record) => {
    if (tier !== "all" && record.tier !== tier) return false;
    if (!needle) return true;
    return [
      record.name,
      record.description ?? "",
      record.region ?? "",
      record.requirements ?? "",
      ...(record.skills ?? []),
      ...(record.areas ?? []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
