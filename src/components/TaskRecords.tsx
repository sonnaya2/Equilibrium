"use client";

/**
 * Tasks — R2 Composite density (CEO 9.0).
 * One facet row (search · My build · tiers · crest filter) + 28px wiki table.
 * Spike selection law: detail drawer mounts only on explicit click (no auto-open).
 * My build defaults on. No permanent third bay; no region column.
 */

import Link from "next/link";
import { useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier } from "@/tasks";
import { CATALYST_TASKS_URL } from "@/tasks/regionMap";
import {
  formatCompRate,
  useTasksDesk,
  wikiTaskUrl,
} from "@/concepts/tasks-density/useTasksDesk";

const ROW_PX = 28;

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
  const desk = useTasksDesk(raw, tiers, {
    rowEstimatePx: ROW_PX,
  });

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

  /** Spike law: no auto-select of first visible row. */
  const active = useMemo(() => {
    if (selectedId === null) return null;
    return visible.find((r) => taskId(r) === selectedId) ?? null;
  }, [selectedId, visible, taskId]);

  const drawerOpen = active !== null;

  if (records.length === 0) return null;

  const virtualItems = virtualizer.getVirtualItems();
  const colsClass = showComp
    ? "tasks-desk__cols"
    : "tasks-desk__cols tasks-desk__cols--no-comp";

  const activeDone = active ? completed.has(taskId(active)) : false;
  const activePts = active ? taskPoints(active) : null;
  const activeRate =
    active && typeof active.catalystCompletionRate === "number"
      ? active.catalystCompletionRate
      : null;
  const activeWiki =
    active && typeof active.wikiTaskId === "number"
      ? wikiTaskUrl(tasksWikiUrl, active.wikiTaskId)
      : null;

  return (
    <div className="tasks-desk">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="tasks-desk__facets">
        <h3 className="tasks-desk__title">Task board</h3>
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
          placeholder="Filter tasks"
          aria-label="Filter tasks"
          className="tasks-desk__search"
        />

        <button
          type="button"
          className="tasks-desk__chip"
          aria-pressed={buildOnly}
          title={
            buildOnly
              ? `Unlocked: ${unlockLabel}. Global tasks stay included.`
              : "Show every region, not only your Build picks"
          }
          onClick={() => setBuildOnly((v) => !v)}
        >
          My build
        </button>

        <div role="group" aria-label="Filter by tier" className="tasks-desk__group">
          {(["all", ...tiersInUse] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="tasks-desk__chip tasks-desk__chip--tier"
              aria-pressed={tier === option}
              onClick={() => setTier(option)}
            >
              {option === "all" ? "All" : option}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Filter by region" className="tasks-desk__crests">
          <button
            type="button"
            className="tasks-desk__crest"
            aria-pressed={region === "all"}
            aria-label={buildOnly ? "All unlocked" : "All regions"}
            title={buildOnly ? "All unlocked" : "All regions"}
            onClick={() => setRegion("all")}
          >
            <span className="tasks-desk__crest-name">All</span>
            <span className="tasks-desk__crest-n">{regionCounts.get("all") ?? 0}</span>
          </button>
          {regionRail.map((id) => (
            <button
              key={id}
              type="button"
              className="tasks-desk__crest"
              aria-pressed={region === id}
              title={`${regionDisplayName(id)} · ${regionCounts.get(id) ?? 0}`}
              onClick={() => setRegion(id)}
            >
              {isLeagueRegionId(id) ? (
                <RegionCrest regionId={id} size={14} />
              ) : (
                <span className="tasks-desk__crest-name">{regionDisplayName(id)}</span>
              )}
              <span className="tasks-desk__crest-n">{regionCounts.get(id) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {buildOnly && build.elective.length === 0 ? (
        <p className="tasks-desk__hint">
          My build · starters only — pick electives on{" "}
          <Link href="/build">Build</Link>
        </p>
      ) : null}

      <div className="tasks-desk__stage">
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
                const domId = `task-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    role="listitem"
                    className={`tasks-desk__row${item.index % 2 === 1 ? " is-zebra" : ""}${on ? " is-on" : ""}${done ? " is-done" : ""}`}
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <div
                      className={`tasks-desk__row-inner ${colsClass}`}
                      tabIndex={0}
                      aria-selected={on}
                      onClick={() => setSelectedId((cur) => (cur === id ? null : id))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId((cur) => (cur === id ? null : id));
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        id={domId}
                        checked={done}
                        onChange={() => onToggle(id)}
                        onClick={(e) => e.stopPropagation()}
                        className="tasks-desk__check"
                        aria-label={
                          done
                            ? `Mark incomplete: ${record.name}`
                            : `Mark complete: ${record.name}`
                        }
                      />
                      <label
                        htmlFor={domId}
                        className="tasks-desk__name"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.name}
                      </label>
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
                                {formatCompRate(rate, record.catalystCompletionRateQualifier)}
                              </a>
                            ) : (
                              formatCompRate(rate, record.catalystCompletionRateQualifier)
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {drawerOpen && active ? (
        <aside
          className="tasks-desk__drawer"
          aria-label="Selected task"
          aria-live="polite"
        >
          <div className="tasks-desk__drawer-head">
            {active.regionId && isLeagueRegionId(active.regionId) ? (
              <RegionCrest regionId={active.regionId} size={24} />
            ) : null}
            <div className="tasks-desk__drawer-title-wrap">
              <p className={`tasks-desk__drawer-title${activeDone ? " is-done" : ""}`}>
                {active.name}
              </p>
              <p className="tasks-desk__drawer-meta">
                {active.tier}
                {active.regionId ? ` · ${regionDisplayName(active.regionId)}` : ""}
                {activeDone ? " · done" : ""}
              </p>
            </div>
            <dl className="tasks-desk__drawer-facts">
              <div>
                <dt>Pts</dt>
                <dd className="is-pts">{activePts !== null ? activePts : "—"}</dd>
              </div>
              {showComp ? (
                <div>
                  <dt>Comp%</dt>
                  <dd>
                    {activeRate !== null
                      ? formatCompRate(activeRate, active.catalystCompletionRateQualifier)
                      : "—"}
                  </dd>
                </div>
              ) : null}
              {active.localityLabel ? (
                <div>
                  <dt>Locality</dt>
                  <dd className="is-plain">{active.localityLabel}</dd>
                </div>
              ) : null}
            </dl>
            <button
              type="button"
              className="tasks-desk__close"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
          {active.description ? (
            <p className="tasks-desk__drawer-body">{active.description}</p>
          ) : null}
          {active.requirements ? (
            <p className="tasks-desk__drawer-req">Requires: {active.requirements}</p>
          ) : null}
          {active.skills?.length || active.areas?.length ? (
            <p className="tasks-desk__drawer-tags">
              {[...(active.skills ?? []), ...(active.areas ?? [])].join(" · ")}
            </p>
          ) : null}
          {activeWiki ? (
            <a
              href={activeWiki}
              target="_blank"
              rel="noreferrer"
              className="tasks-desk__drawer-link"
              aria-label={`Wiki Comp% for ${active.name}`}
            >
              Open on Wiki
            </a>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
