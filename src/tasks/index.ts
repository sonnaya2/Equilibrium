/**
 * Shared task-record contract. Equilibrium records stay canonical. Catalyst
 * League rows may use the same renderer as a stand-in until Equilibrium
 * publishes its task list.
 */

import type { RegionId } from "@/league";

export const TASK_ORDER = ["easy", "medium", "hard", "elite", "master"] as const;
export type TaskTier = (typeof TASK_ORDER)[number];

/** Equilibrium region id, or Catalyst "global" bucket (not a League unlock). */
export type TaskRegionId = RegionId | "global";

export interface TaskRecord {
  /** Stable id when the source provides one; else progress uses `${tier}:${name}`. */
  id?: string;
  name: string;
  tier: string;
  points?: number;
  description?: string;
  /** Display/search string — often locality label or region name. */
  region?: string;
  /** Equilibrium taxonomy after locality mapping; `global` for Catalyst global tasks. */
  regionId?: TaskRegionId;
  /** Raw Catalyst locality key (data-tbz-area-for-filtering). */
  localityKey?: string;
  /** Locality label from Wiki icon title/alt (e.g. "Asgarnia: Burthorpe"). */
  localityLabel?: string;
  /** Wiki row id / data-taskid — deep-link + completion module key. */
  wikiTaskId?: number;
  /** Optional source taxonomy. Catalyst currently does not publish one. */
  category?: string;
  skills?: string[];
  areas?: string[];
  requirements?: string;
  sourceLeague?: string;
  testingOnly?: boolean;
  catalystCompletionRate?: number;
  catalystCompletionRateQualifier?: "<";
}

export function asTaskRecords(value: unknown): TaskRecord[] {
  // Boundary validation — drop incomplete rows rather than casting through.
  if (!Array.isArray(value)) return [];
  const out: TaskRecord[] = [];
  for (const row of value) {
    if (
      typeof row !== "object" ||
      row === null ||
      typeof (row as { name?: unknown }).name !== "string" ||
      typeof (row as { tier?: unknown }).tier !== "string"
    ) {
      continue;
    }
    const r = row as TaskRecord & Record<string, unknown>;
    const rate = r.catalystCompletionRate;
    out.push({
      ...r,
      name: r.name,
      tier: r.tier,
      // Preserve real 0%; only drop non-finite rates.
      catalystCompletionRate:
        typeof rate === "number" && Number.isFinite(rate) ? rate : r.catalystCompletionRate,
    });
  }
  return out;
}

/** Record points win; the tier table is the fallback while records carry none. */
export function taskPoints(record: TaskRecord, tiers: Record<string, number>): number | null {
  if (typeof record.points === "number") return record.points;
  return tiers[record.tier] ?? null;
}

export function isTaskTier(tier: string): tier is TaskTier {
  return (TASK_ORDER as readonly string[]).includes(tier);
}

export type FilterTasksOptions = {
  /**
   * When set, only tasks tagged with these region ids pass.
   * Use the build's unlocked set (starting + Karamja + electives).
   */
  allowedRegions?: ReadonlySet<string> | null;
  /** Keep Catalyst/global tasks when allowedRegions is set. Default true. */
  includeGlobal?: boolean;
};

export function filterTasks(
  records: readonly TaskRecord[],
  tier: TaskTier | "all",
  query: string,
  region: TaskRegionId | "all" = "all",
  options: FilterTasksOptions = {},
): TaskRecord[] {
  const { allowedRegions = null, includeGlobal = true } = options;
  const needle = query.trim().toLowerCase();
  return records.filter((record) => {
    if (tier !== "all" && record.tier !== tier) return false;

    if (allowedRegions) {
      const rid = record.regionId;
      if (rid === "global") {
        if (!includeGlobal) return false;
      } else if (!rid || !allowedRegions.has(rid)) {
        return false;
      }
    }

    if (region !== "all" && record.regionId !== region) return false;
    if (!needle) return true;
    // Avoid allocating a joined array for every keystroke on 1k+ rows.
    if (record.name.toLowerCase().includes(needle)) return true;
    if (record.description?.toLowerCase().includes(needle)) return true;
    if (record.region?.toLowerCase().includes(needle)) return true;
    if (record.regionId?.toLowerCase().includes(needle)) return true;
    if (record.localityKey?.toLowerCase().includes(needle)) return true;
    if (record.localityLabel?.toLowerCase().includes(needle)) return true;
    if (record.requirements?.toLowerCase().includes(needle)) return true;
    if (record.skills?.some((s) => s.toLowerCase().includes(needle))) return true;
    if (record.areas?.some((a) => a.toLowerCase().includes(needle))) return true;
    return false;
  });
}
