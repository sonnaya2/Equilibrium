"use client";

/**
 * Tasks — Crest Compact (Quarry DNA) without right inspector.
 * 2-bay: crest rail (~5.5rem) + stage. 32px rows · inline expand under row.
 * Spike selection law: no auto-open; re-click / Close collapses.
 * My build defaults on — filters list only; rail always shows all regions with tasks.
 * Density: dual-mode rail counts, All-view micro-crests, compact stage.
 */

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import {
  formatCompRate,
  useTasksDesk,
  wikiTaskUrl,
} from "@/concepts/tasks-density/useTasksDesk";
import { isTaskTier, type TaskRegionId } from "@/tasks";
import { CATALYST_TASKS_URL } from "@/tasks/regionMap";

const ROW_PX = 32;
const RAIL_CREST_PX = 30;
const STAGE_CREST_PX = 18;
const ROW_CREST_PX = 14;

export function TaskRecords({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl = CATALYST_TASKS_URL,
  completionLive = false,
}: {
  records: unknown[];
  tiers: Record<string, number>;
  tierConfidence: Record<string, string>;
  tasksWikiUrl?: string;
  completionLive?: boolean;
}) {
  const desk = useTasksDesk(raw, tiers, { rowEstimatePx: ROW_PX });
  const {
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
    selectedId,
    setSelectedId,
    doneVisible,
    earnedVisible,
    totalVisible,
    listRef,
    virtualizer,
    onToggle,
    taskId,
    taskPoints,
    isLeagueRegionId,
    regionDisplayName,
  } = desk;

  const showComp = useMemo(
    () => records.some((r) => typeof r.catalystCompletionRate === "number"),
    [records],
  );
  const showRegionFilter = regionRail.length > 0;

  /**
   * Dual-mode rail badges (CEO nit): under My build, Σ / unlocked leaves show
   * build-scoped counts; locked electives keep full corpus totals.
   */
  const railCounts = useMemo(() => {
    if (!buildOnly) return regionCounts;
    const m = new Map<TaskRegionId | "all", number>();
    let all = 0;
    for (const r of records) {
      const rid = r.regionId;
      if (!rid) continue;
      const locked = isLeagueRegionId(rid) && !unlockedSet.has(rid);
      if (locked) continue;
      all += 1;
      m.set(rid, (m.get(rid) ?? 0) + 1);
    }
    m.set("all", all);
    for (const id of regionRail) {
      if (isLeagueRegionId(id) && !unlockedSet.has(id)) {
        m.set(id, regionCounts.get(id) ?? 0);
      } else if (!m.has(id)) {
        m.set(id, 0);
      }
    }
    return m;
  }, [buildOnly, records, regionCounts, regionRail, unlockedSet, isLeagueRegionId]);

  /** Spike law — ignore desk.selected first-row fallback. */
  const active = useMemo(() => {
    if (selectedId === null) return null;
    return visible.find((r) => taskId(r) === selectedId) ?? null;
  }, [selectedId, visible, taskId]);

  const activeKey = active ? taskId(active) : null;

  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeKey]);

  if (records.length === 0) return null;

  const virtualItems = virtualizer.getVirtualItems();
  const colsClass = showComp
    ? "tasks-desk__cols"
    : "tasks-desk__cols tasks-desk__cols--no-comp";

  const toggleSelect = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  const allCount = railCounts.get("all") ?? 0;

  return (
    <div className="tasks-desk">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="tasks-desk__grid">
        {/* Crest-only rail — title tooltip carries the name / lock state */}
        <aside className="tasks-desk__rail" aria-label="Filter by region">
          <p className="tasks-desk__rail-label">Region</p>
          <button
            type="button"
            className={`tasks-desk__leaf${region === "all" ? " is-on" : ""}`}
            aria-pressed={region === "all"}
            title={buildOnly ? "All unlocked" : "All regions"}
            aria-label={
              buildOnly
                ? `All unlocked, ${allCount} tasks`
                : `All regions, ${allCount} tasks`
            }
            onClick={() => setRegion("all")}
          >
            <span className="tasks-desk__leaf-glyph" aria-hidden>
              Σ
            </span>
            <span className="tasks-desk__leaf-count">{allCount}</span>
          </button>
          {showRegionFilter
            ? regionRail.map((id) => {
                const label = regionDisplayName(id);
                const count = railCounts.get(id) ?? 0;
                const locked =
                  buildOnly && isLeagueRegionId(id) && !isUnlocked(id);
                const title = locked ? `${label} · not in Build (still viewable)` : label;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`tasks-desk__leaf${region === id ? " is-on" : ""}${locked ? " is-locked" : ""}`}
                    aria-pressed={region === id}
                    title={title}
                    aria-label={
                      locked
                        ? `${label}, ${count} tasks, not in Build`
                        : `${label}, ${count} tasks`
                    }
                    onClick={() => setRegion(id)}
                  >
                    {isLeagueRegionId(id) ? (
                      <RegionCrest regionId={id} size={RAIL_CREST_PX} />
                    ) : (
                      <span className="tasks-desk__leaf-glyph" aria-hidden>
                        G
                      </span>
                    )}
                    <span className="tasks-desk__leaf-count">
                      {locked ? (
                        <>
                          <span className="tasks-desk__leaf-lock" aria-hidden>
                            ×
                          </span>
                          {count}
                        </>
                      ) : (
                        count
                      )}
                    </span>
                  </button>
                );
              })
            : null}
        </aside>

        {/* Stage: one-line bar + single-line rows + inline expand */}
        <div className="tasks-desk__main">
          <div className="tasks-desk__bar">
            <h3 className="tasks-desk__title">Tasks</h3>
            <span className="tasks-desk__count">
              {visible.length}/{records.length}
              {totalVisible > 0 ? (
                <>
                  {" · "}
                  <span className="is-pts">
                    {earnedVisible}/{totalVisible} pts
                  </span>
                  {doneVisible > 0 ? ` · ${doneVisible} done` : null}
                </>
              ) : null}
              {showComp ? ` · Comp% ${completionLive ? "live" : "snap"}` : null}
            </span>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter"
              aria-label="Filter tasks"
              className="tasks-desk__search"
            />

            <div className="tasks-desk__facets" role="group" aria-label="Task filters">
              <button
                type="button"
                className="tasks-desk__chip"
                aria-pressed={buildOnly}
                title={
                  buildOnly
                    ? `Unlocked: ${unlockLabel}. Global included.`
                    : "All regions, not only Build picks"
                }
                onClick={() => setBuildOnly((v) => !v)}
              >
                My build
              </button>
              {(["all", ...tiersInUse] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="tasks-desk__chip tasks-desk__chip--tier"
                  aria-pressed={tier === option}
                  onClick={() => setTier(option)}
                >
                  {option === "all"
                    ? "All"
                    : option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {buildOnly && build.elective.length === 0 ? (
            <p className="tasks-desk__hint">
              Starters only — electives on <Link href="/build">Build</Link>
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="tasks-desk__empty">No tasks match.</p>
          ) : (
            <div ref={listRef} className="tasks-desk__list" role="list" aria-label="Tasks">
              <div className={`tasks-desk__thead ${colsClass}`} aria-hidden>
                <div />
                <div>Task</div>
                <div className="tasks-desk__th-num">Tier</div>
                {showComp ? <div className="tasks-desk__th-num">Comp%</div> : null}
                <div className="tasks-desk__th-num">Pts</div>
                <div aria-hidden />
              </div>

              <div className="tasks-desk__body" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.map((item) => {
                  const record = visible[item.index]!;
                  const id = taskId(record);
                  const done = completed.has(id);
                  const on = selectedId === id;
                  const points = taskPoints(record);
                  const provisional = tierConfidence[record.tier]?.startsWith("provisional");
                  const rate =
                    typeof record.catalystCompletionRate === "number"
                      ? record.catalystCompletionRate
                      : null;
                  const wikiHref =
                    typeof record.wikiTaskId === "number"
                      ? wikiTaskUrl(tasksWikiUrl, record.wikiTaskId)
                      : null;
                  const tags = [
                    ...(record.skills ?? []),
                    ...(record.areas ?? []),
                  ];
                  const showRowCrest =
                    region === "all" &&
                    !!record.regionId &&
                    isLeagueRegionId(record.regionId);

                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      role="listitem"
                      className={`tasks-desk__item${item.index % 2 === 1 ? " is-zebra" : ""}${on ? " is-on" : ""}${done ? " is-done" : ""}`}
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <div
                        className={`tasks-desk__row ${colsClass}`}
                        tabIndex={0}
                        aria-selected={on}
                        onClick={() => toggleSelect(id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleSelect(id);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={(e) => {
                            e.stopPropagation();
                            onToggle(id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="tasks-desk__check"
                          aria-label={
                            done
                              ? `Mark incomplete: ${record.name}`
                              : `Mark complete: ${record.name}`
                          }
                        />
                        <span className="tasks-desk__name-cell">
                          {showRowCrest ? (
                            <RegionCrest
                              regionId={record.regionId!}
                              size={ROW_CREST_PX}
                              className="tasks-desk__row-crest"
                            />
                          ) : null}
                          <span className="tasks-desk__name">{record.name}</span>
                        </span>
                        <div className="tasks-desk__tier">
                          {isTaskTier(record.tier) ? record.tier : "—"}
                        </div>
                        {showComp ? (
                          <div className="tasks-desk__num">
                            {rate !== null ? (
                              wikiHref ? (
                                <a
                                  href={wikiHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="tasks-desk__wiki"
                                  aria-label={`Wiki Comp% for ${record.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formatCompRate(
                                    rate,
                                    record.catalystCompletionRateQualifier,
                                  )}
                                </a>
                              ) : (
                                formatCompRate(
                                  rate,
                                  record.catalystCompletionRateQualifier,
                                )
                              )
                            ) : (
                              <span className="is-mute">—</span>
                            )}
                          </div>
                        ) : null}
                        <div className={`tasks-desk__num${done ? " is-done" : ""}`}>
                          {points !== null ? (
                            <>
                              {points}
                              {provisional ? "*" : ""}
                            </>
                          ) : (
                            <span className="is-mute">—</span>
                          )}
                        </div>
                        <div className="tasks-desk__filler" aria-hidden />
                      </div>

                      {on && active && activeKey === id ? (
                        <div className="tasks-desk__stage" aria-label="Selected task">
                          <div className="tasks-desk__stage-head">
                            {record.regionId && isLeagueRegionId(record.regionId) ? (
                              <RegionCrest regionId={record.regionId} size={STAGE_CREST_PX} />
                            ) : null}
                            <div className="tasks-desk__stage-copy">
                              <p className="tasks-desk__stage-meta">
                                <span className="capitalize">{record.tier}</span>
                                {record.regionId ? (
                                  <span> · {regionDisplayName(record.regionId)}</span>
                                ) : null}
                                <span className="is-pts">
                                  {" "}
                                  · {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}{" "}
                                  pts
                                </span>
                                {showComp && rate !== null ? (
                                  <span>
                                    {" "}
                                    ·{" "}
                                    {formatCompRate(
                                      rate,
                                      record.catalystCompletionRateQualifier,
                                    )}
                                  </span>
                                ) : null}
                                {record.localityLabel ? (
                                  <span> · {record.localityLabel}</span>
                                ) : null}
                                {done ? <span className="is-done-mark"> · done</span> : null}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="tasks-desk__close"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(null);
                              }}
                            >
                              Close
                            </button>
                          </div>
                          {record.description ? (
                            <p className="tasks-desk__stage-body">{record.description}</p>
                          ) : null}
                          {record.requirements ? (
                            <p className="tasks-desk__stage-req">
                              Req: {record.requirements}
                            </p>
                          ) : null}
                          {tags.length > 0 ? (
                            <p className="tasks-desk__stage-tags">{tags.join(" · ")}</p>
                          ) : null}
                          {wikiHref ? (
                            <a
                              href={wikiHref}
                              target="_blank"
                              rel="noreferrer"
                              className="tasks-desk__stage-link"
                              aria-label={`Wiki Comp% for ${record.name}`}
                            >
                              Wiki
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
