"use client";

/** Task page state: filtering, progress, build scope, and derived facts. */

import { useEffect, useMemo, useRef, useState } from "react";
import { unlockedRegions } from "@/league";
import { useBuild } from "@/league/useBuild";
import { loadState, saveState } from "@/lib/storage";
import {
  asTaskRecords,
  filterTasks,
  TASK_ORDER,
  taskPoints,
  type TaskRecord,
  type TaskRegionId,
  type TaskTier,
} from "@/tasks";
import { isLeagueRegionId, regionDisplayName, TASK_LEAGUE_REGION_IDS } from "@/tasks/regionMap";
import {
  EMPTY_PROGRESS,
  loadProgress,
  loadProgressFromBrowserDb,
  mergeWikiTaskProgress,
  migrateProgressIds,
  saveProgress,
  STORAGE_KEY,
  taskId,
  toggleComplete,
  type TaskProgress,
} from "@/tasks/progress";

const SEARCH_DEBOUNCE_MS = 150;
const TASK_PINS_STORAGE_KEY = "eq:task-pins:v1";
export const TASK_PAGE_SIZE = 40;

export const TASK_SKILLS = [
  "Agility",
  "Archaeology",
  "Attack",
  "Constitution",
  "Construction",
  "Cooking",
  "Crafting",
  "Defence",
  "Divination",
  "Dungeoneering",
  "Farming",
  "Firemaking",
  "Fishing",
  "Fletching",
  "Herblore",
  "Hunter",
  "Invention",
  "Magic",
  "Mining",
  "Necromancy",
  "Prayer",
  "Ranged",
  "Runecrafting",
  "Slayer",
  "Smithing",
  "Strength",
  "Summoning",
  "Thieving",
  "Woodcutting",
] as const;

export type TaskSort = "points" | "completion" | "rarest" | "name";
export type TaskStatusFilter = "all" | "completed" | "unfinished";

export type TaskPageFilters = {
  search: string;
  tier: TaskTier | "all";
  region: TaskRegionId | "all";
  category: string | "all";
  skill: string | "all";
  buildOnly: boolean;
  status: TaskStatusFilter;
  sort: TaskSort;
};

export type TaskPageStats = {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalPoints: number;
  completedPoints: number;
  pointCompletionRate: number;
  activeFilterCount: number;
  buildTaskCount: number;
  completedBuildTaskCount: number;
};

export type DifficultyAggregate = {
  tier: TaskTier;
  count: number;
  completed: number;
  pointsPerTask: number;
  percentage: number;
};

export function formatCompRate(rate: number, qualifier?: "<"): string {
  if (qualifier === "<") return "<0.1%";
  const value = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1);
  return `${value}%`;
}

export function wikiTaskUrl(base: string, wikiTaskId: number): string {
  const trimmed = base.replace(/#.*$/, "").replace(/\/$/, "");
  return `${trimmed}#${wikiTaskId}`;
}

/** Ordered region ids that appear in task data (global first, then league order). */
export function regionsInTaskData(records: readonly TaskRecord[]): TaskRegionId[] {
  const seen = new Set<TaskRegionId>();
  for (const record of records) if (record.regionId) seen.add(record.regionId);

  const ordered: TaskRegionId[] = [];
  if (seen.has("global")) ordered.push("global");
  for (const id of TASK_LEAGUE_REGION_IDS) if (seen.has(id)) ordered.push(id);
  return ordered;
}

/** Full per-region counts; build scope never hides elective-region totals. */
export function fullRegionCounts(
  records: readonly TaskRecord[],
): Map<TaskRegionId | "all", number> {
  const counts = new Map<TaskRegionId | "all", number>([["all", records.length]]);
  for (const record of records) {
    if (!record.regionId) continue;
    counts.set(record.regionId, (counts.get(record.regionId) ?? 0) + 1);
  }
  return counts;
}

/** Explicit source skills win; Catalyst falls back to skill names in requirements. */
export function taskSkillNames(record: TaskRecord): string[] {
  if (record.skills?.length) {
    return [...new Set(record.skills.map((skill) => skill.trim()).filter(Boolean))];
  }
  const requirements = record.requirements?.toLowerCase() ?? "";
  if (!requirements) return [];
  return TASK_SKILLS.filter((skill) =>
    new RegExp(`\\b${skill.toLowerCase()}\\b`, "i").test(requirements),
  );
}

export function taskInBuild(record: TaskRecord, unlocked: ReadonlySet<string>): boolean {
  return record.regionId === "global" || Boolean(record.regionId && unlocked.has(record.regionId));
}

export function countActiveFilters(filters: TaskPageFilters): number {
  return (
    Number(Boolean(filters.search.trim())) +
    Number(filters.tier !== "all") +
    Number(filters.region !== "all") +
    Number(filters.category !== "all") +
    Number(filters.skill !== "all") +
    Number(filters.buildOnly) +
    Number(filters.status !== "all")
  );
}

export function filterTaskPage(
  records: readonly TaskRecord[],
  filters: TaskPageFilters,
  completed: ReadonlySet<string>,
  unlocked: ReadonlySet<string>,
): TaskRecord[] {
  const allowedRegions = filters.buildOnly && filters.region === "all" ? unlocked : null;
  return filterTasks(records, filters.tier, filters.search, filters.region, {
    allowedRegions,
    includeGlobal: true,
  }).filter((record) => {
    if (filters.category !== "all" && record.category !== filters.category) return false;
    if (filters.skill !== "all" && !taskSkillNames(record).includes(filters.skill)) return false;
    const done = completed.has(taskId(record));
    if (filters.status === "completed" && !done) return false;
    if (filters.status === "unfinished" && done) return false;
    return true;
  });
}

/** Missing rates sort last; valid 0 must not collapse to "missing". */
function completionRateOrMissing(record: TaskRecord): number {
  const raw = record.catalystCompletionRate;
  if (raw == null) return Number.NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Compare two completion rates: higher first for "completion", lower first for "rarest". Missing last. */
function compareCompletionRates(
  aRate: number,
  bRate: number,
  mode: "completion" | "rarest",
): number {
  const aMissing = Number.isNaN(aRate);
  const bMissing = Number.isNaN(bRate);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return mode === "completion" ? bRate - aRate : aRate - bRate;
}

export function sortTasks(
  records: readonly TaskRecord[],
  sort: TaskSort,
  tiers: Record<string, number>,
): TaskRecord[] {
  const compareName = (a: TaskRecord, b: TaskRecord) => a.name.localeCompare(b.name);

  return [...records].sort((a, b) => {
    if (sort === "name") return compareName(a, b);
    if (sort === "points") {
      const pointDelta = (taskPoints(b, tiers) ?? -1) - (taskPoints(a, tiers) ?? -1);
      if (pointDelta) return pointDelta;
      const rateDelta = compareCompletionRates(
        completionRateOrMissing(a),
        completionRateOrMissing(b),
        "completion",
      );
      return rateDelta || compareName(a, b);
    }

    const rateDelta = compareCompletionRates(
      completionRateOrMissing(a),
      completionRateOrMissing(b),
      sort === "completion" ? "completion" : "rarest",
    );
    return rateDelta || compareName(a, b);
  });
}

export function prioritizePinnedTasks(
  records: readonly TaskRecord[],
  pinnedIds: readonly string[],
): TaskRecord[] {
  if (pinnedIds.length === 0) return [...records];
  const byId = new Map(records.map((record) => [taskId(record), record]));
  const pinned = pinnedIds.flatMap((id) => {
    const record = byId.get(id);
    return record ? [record] : [];
  });
  const pinnedSet = new Set(pinnedIds);
  return [...pinned, ...records.filter((record) => !pinnedSet.has(taskId(record)))];
}

function normalizePinnedTaskIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200),
    ),
  ].slice(0, 1_000);
}

const percentage = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export function aggregateTaskStats(
  records: readonly TaskRecord[],
  buildRecords: readonly TaskRecord[],
  completed: ReadonlySet<string>,
  tiers: Record<string, number>,
  activeFilterCount: number,
): TaskPageStats {
  let completedTasks = 0;
  let totalPoints = 0;
  let completedPoints = 0;
  let completedBuildTaskCount = 0;

  for (const record of records) {
    const points = taskPoints(record, tiers) ?? 0;
    const done = completed.has(taskId(record));
    totalPoints += points;
    if (!done) continue;
    completedTasks += 1;
    completedPoints += points;
  }
  for (const record of buildRecords) {
    if (completed.has(taskId(record))) completedBuildTaskCount += 1;
  }

  return {
    totalTasks: records.length,
    completedTasks,
    completionRate: percentage(completedTasks, records.length),
    totalPoints,
    completedPoints,
    pointCompletionRate: percentage(completedPoints, totalPoints),
    activeFilterCount,
    buildTaskCount: buildRecords.length,
    completedBuildTaskCount,
  };
}

export function aggregateDifficulties(
  records: readonly TaskRecord[],
  completed: ReadonlySet<string>,
  tiers: Record<string, number> = {},
): DifficultyAggregate[] {
  return TASK_ORDER.map((tier) => {
    const inTier = records.filter((record) => record.tier === tier);
    return {
      tier,
      count: inTier.length,
      completed: inTier.filter((record) => completed.has(taskId(record))).length,
      pointsPerTask: inTier.length > 0 ? (taskPoints(inTier[0], tiers) ?? 0) : 0,
      percentage: percentage(inTier.length, records.length),
    };
  }).filter((entry) => entry.count > 0);
}

export function recommendTasks(
  records: readonly TaskRecord[],
  completed: ReadonlySet<string>,
  tiers: Record<string, number>,
  unlocked: ReadonlySet<string>,
  limit = 4,
): TaskRecord[] {
  return records
    .filter((record) => !completed.has(taskId(record)))
    .sort((a, b) => {
      const buildDelta = Number(taskInBuild(b, unlocked)) - Number(taskInBuild(a, unlocked));
      if (buildDelta) return buildDelta;
      const pointDelta = (taskPoints(b, tiers) ?? -1) - (taskPoints(a, tiers) ?? -1);
      if (pointDelta) return pointDelta;
      const rateDelta = (b.catalystCompletionRate ?? -1) - (a.catalystCompletionRate ?? -1);
      return rateDelta || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function useTasksDesk(raw: unknown[], tiers: Record<string, number>) {
  const records = useMemo(() => asTaskRecords(raw), [raw]);
  const { build } = useBuild();
  const unlocked = useMemo(() => unlockedRegions(build), [build]);
  const unlockedSet = useMemo(() => new Set<string>(unlocked), [unlocked]);

  const [buildOnly, setBuildOnly] = useState(true);
  const [tier, setTier] = useState<TaskTier | "all">("all");
  const [region, setRegion] = useState<TaskRegionId | "all">("all");
  const [category, setCategory] = useState<string | "all">("all");
  const [skill, setSkill] = useState<string | "all">("all");
  const [status, setStatus] = useState<TaskStatusFilter>("all");
  const [sort, setSort] = useState<TaskSort>("points");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [progress, setProgress] = useState<TaskProgress>(EMPTY_PROGRESS);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const progressRevision = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (records.length === 0) {
      setProgress(EMPTY_PROGRESS);
      return;
    }
    let cancelled = false;
    const revision = progressRevision.current;
    setProgress(migrateProgressIds(loadProgress(), records));
    void loadProgressFromBrowserDb(records).then((stored) => {
      if (!cancelled && progressRevision.current === revision) {
        setProgress(stored);
        saveState(STORAGE_KEY, stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [records]);

  useEffect(() => {
    setPinnedIds(loadState(TASK_PINS_STORAGE_KEY, [], normalizePinnedTaskIds));
  }, []);

  const completed = useMemo(() => new Set(progress.completed), [progress.completed]);
  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const filters = useMemo<TaskPageFilters>(
    () => ({
      search: debouncedQuery,
      tier,
      region,
      category,
      skill,
      buildOnly,
      status,
      sort,
    }),
    [debouncedQuery, tier, region, category, skill, buildOnly, status, sort],
  );

  const visible = useMemo(
    () =>
      prioritizePinnedTasks(
        sortTasks(filterTaskPage(records, filters, completed, unlockedSet), sort, tiers),
        pinnedIds,
      ),
    [records, filters, completed, unlockedSet, sort, tiers, pinnedIds],
  );
  const buildRecords = useMemo(
    () => records.filter((record) => taskInBuild(record, unlockedSet)),
    [records, unlockedSet],
  );
  const activeFilterCount = countActiveFilters(filters);
  const stats = useMemo(
    () => aggregateTaskStats(records, buildRecords, completed, tiers, activeFilterCount),
    [records, buildRecords, completed, tiers, activeFilterCount],
  );
  const difficultyBreakdown = useMemo(
    () => aggregateDifficulties(records, completed, tiers),
    [records, completed, tiers],
  );
  const recommendations = useMemo(
    () => recommendTasks(visible, completed, tiers, unlockedSet),
    [visible, completed, tiers, unlockedSet],
  );

  const tiersInUse = useMemo(
    () => TASK_ORDER.filter((taskTier) => records.some((record) => record.tier === taskTier)),
    [records],
  );
  const regionRail = useMemo(() => regionsInTaskData(records), [records]);
  const regionCounts = useMemo(() => fullRegionCounts(records), [records]);
  const crestRegionIds = useMemo(
    () => regionRail.filter((id) => isLeagueRegionId(id)),
    [regionRail],
  );
  const availableCategories = useMemo(
    () =>
      [
        ...new Set(
          records
            .map((record) => record.category)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [records],
  );
  const availableSkills = useMemo(
    () => [...new Set(records.flatMap(taskSkillNames))].sort(),
    [records],
  );
  const skillCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      for (const name of taskSkillNames(record)) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [records]);
  const quickSkills = useMemo(
    () =>
      [...availableSkills]
        .sort((a, b) => (skillCounts.get(b) ?? 0) - (skillCounts.get(a) ?? 0))
        .slice(0, 6),
    [availableSkills, skillCounts],
  );
  const unlockLabel = useMemo(
    () => unlocked.map((id) => regionDisplayName(id)).join(" · "),
    [unlocked],
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / TASK_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRecords = useMemo(
    () => visible.slice((currentPage - 1) * TASK_PAGE_SIZE, currentPage * TASK_PAGE_SIZE),
    [visible, currentPage],
  );

  useEffect(() => {
    setPage(1);
    listRef.current?.scrollTo({ top: 0 });
    setSelectedId(null);
  }, [tier, region, category, skill, status, debouncedQuery, buildOnly, sort, unlocked]);

  const onToggle = (id: string) => {
    progressRevision.current += 1;
    setProgress((previous) => {
      const next = toggleComplete(previous, id);
      saveProgress(next);
      return next;
    });
  };

  const onImportWikiTasks = (wikiTaskIds: readonly number[]) => {
    const result = mergeWikiTaskProgress(progress, records, wikiTaskIds);
    if (result.added > 0) {
      progressRevision.current += 1;
      setProgress(result.progress);
      saveProgress(result.progress);
    }
    return { matched: result.matched, added: result.added };
  };

  const onPin = (id: string) => {
    setPinnedIds((previous) => {
      const next = previous.includes(id)
        ? previous.filter((candidate) => candidate !== id)
        : [id, ...previous];
      saveState(TASK_PINS_STORAGE_KEY, next);
      return next;
    });
    setPage(1);
  };

  return {
    records,
    build,
    buildOnly,
    setBuildOnly,
    tier,
    setTier,
    region,
    setRegion,
    category,
    setCategory,
    skill,
    setSkill,
    status,
    setStatus,
    sort,
    setSort,
    query,
    setQuery,
    filters,
    tiersInUse,
    regionRail,
    regionCounts,
    crestRegionIds,
    availableCategories,
    availableSkills,
    quickSkills,
    skillCounts,
    unlockLabel,
    unlockedSet,
    isUnlocked: (id: string) => id === "global" || unlockedSet.has(id),
    visible,
    pagedRecords,
    page: currentPage,
    setPage,
    pageCount,
    completed,
    pinned,
    stats,
    difficultyBreakdown,
    recommendations,
    selectedId,
    setSelectedId,
    listRef,
    onToggle,
    onImportWikiTasks,
    onPin,
    taskId,
    taskPoints: (record: TaskRecord) => taskPoints(record, tiers),
    isLeagueRegionId,
    regionDisplayName,
    taskInBuild: (record: TaskRecord) => taskInBuild(record, unlockedSet),
  };
}
