"use client";

/**
 * Shared Tasks desk state for density tournament previews + production parity.
 * Layouts vary; filter/progress logic does not.
 */

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { unlockedRegions } from "@/league";
import { useBuild } from "@/league/useBuild";
import {
  asTaskRecords,
  filterTasks,
  TASK_ORDER,
  taskPoints,
  type TaskRecord,
  type TaskRegionId,
  type TaskTier,
} from "@/tasks";
import {
  isLeagueRegionId,
  regionDisplayName,
  TASK_LEAGUE_REGION_IDS,
} from "@/tasks/regionMap";
import {
  EMPTY_PROGRESS,
  loadProgressForRecords,
  pointsEarned,
  pointsTotal,
  saveProgress,
  taskId,
  toggleComplete,
  type TaskProgress,
} from "@/tasks/progress";

const SEARCH_DEBOUNCE_MS = 150;

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
  for (const r of records) {
    if (r.regionId) seen.add(r.regionId);
  }
  const ordered: TaskRegionId[] = [];
  if (seen.has("global")) ordered.push("global");
  for (const id of TASK_LEAGUE_REGION_IDS) {
    if (seen.has(id)) ordered.push(id);
  }
  return ordered;
}

/** Full (unfiltered) per-region + all counts for the crest rail badges. */
export function fullRegionCounts(
  records: readonly TaskRecord[],
): Map<TaskRegionId | "all", number> {
  const m = new Map<TaskRegionId | "all", number>();
  m.set("all", records.length);
  for (const r of records) {
    if (!r.regionId) continue;
    m.set(r.regionId, (m.get(r.regionId) ?? 0) + 1);
  }
  return m;
}

export function useTasksDesk(
  raw: unknown[],
  tiers: Record<string, number>,
  opts?: { rowEstimatePx?: number; listMaxCss?: string },
) {
  const rowEstimatePx = opts?.rowEstimatePx ?? 36;
  const records = useMemo(() => asTaskRecords(raw), [raw]);
  const { build } = useBuild();
  const unlocked = useMemo(() => unlockedRegions(build), [build]);
  const unlockedSet = useMemo(() => new Set<string>(unlocked), [unlocked]);

  const [buildOnly, setBuildOnly] = useState(true);
  const [tier, setTier] = useState<TaskTier | "all">("all");
  const [region, setRegion] = useState<TaskRegionId | "all">("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [progress, setProgress] = useState<TaskProgress>(EMPTY_PROGRESS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (records.length === 0) {
      setProgress(EMPTY_PROGRESS);
      return;
    }
    setProgress(loadProgressForRecords(records));
  }, [records]);

  const completed = useMemo(() => new Set(progress.completed), [progress.completed]);

  /**
   * My build scopes the multi-region ("all") list via allowedRegions.
   * A specific region leaf (incl. locked electives) stays viewable — do not
   * intersect that pick with the unlock set or the leaf would empty out.
   */
  const filterOpts = useMemo(() => {
    if (!buildOnly) {
      return { allowedRegions: null as ReadonlySet<string> | null, includeGlobal: true as const };
    }
    if (region !== "all") {
      return { allowedRegions: null as ReadonlySet<string> | null, includeGlobal: true as const };
    }
    return { allowedRegions: unlockedSet, includeGlobal: true as const };
  }, [buildOnly, unlockedSet, region]);

  const visible = useMemo(
    () => filterTasks(records, tier, debouncedQuery, region, filterOpts),
    [records, tier, debouncedQuery, region, filterOpts],
  );

  const tiersInUse = useMemo(
    () => TASK_ORDER.filter((t) => records.some((r) => r.tier === t)),
    [records],
  );

  /** Option A: always every region that has tasks — never hide electives. */
  const regionRail = useMemo(() => regionsInTaskData(records), [records]);

  /** Full data counts so locked electives still show their true totals. */
  const regionCounts = useMemo(() => fullRegionCounts(records), [records]);

  const crestRegionIds = useMemo(
    () => regionRail.filter((id) => isLeagueRegionId(id)),
    [regionRail],
  );

  const unlockLabel = useMemo(
    () => unlocked.map((id) => regionDisplayName(id)).join(" · "),
    [unlocked],
  );

  const isUnlocked = (id: string) => id === "global" || unlockedSet.has(id);

  const doneVisible = useMemo(() => {
    let n = 0;
    for (const r of visible) if (completed.has(taskId(r))) n += 1;
    return n;
  }, [visible, completed]);

  const earnedVisible = pointsEarned(progress, visible, tiers);
  const totalVisible = pointsTotal(visible, tiers);

  /** First-row fallback for previews that still use it — production ignores this. */
  const selected = useMemo(() => {
    if (!selectedId) return visible[0] ?? null;
    return visible.find((r) => taskId(r) === selectedId) ?? visible[0] ?? null;
  }, [visible, selectedId]);

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => rowEstimatePx,
    overscan: 14,
    getItemKey: (index) => taskId(visible[index]!),
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    setSelectedId(null);
  }, [tier, region, debouncedQuery, buildOnly, unlocked]);

  const onToggle = (id: string) => {
    setProgress((prev) => {
      const next = toggleComplete(prev, id);
      saveProgress(next);
      return next;
    });
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
    query,
    setQuery,
    tiersInUse,
    regionRail,
    regionCounts,
    crestRegionIds,
    unlockLabel,
    unlockedSet,
    isUnlocked,
    visible,
    completed,
    selected,
    selectedId,
    setSelectedId,
    doneVisible,
    earnedVisible,
    totalVisible,
    listRef,
    virtualizer,
    onToggle,
    taskId,
    taskPoints: (r: TaskRecord) => taskPoints(r, tiers),
    isLeagueRegionId,
    regionDisplayName,
  };
}
