"use client";

/**
 * Tasks — Select + Stage (Aperture champion, R1.1 surgery).
 * Full-width dense table · region <select> + crest badge · inline stage under row.
 * Spike selection law: no auto-open; re-click / Close collapses.
 * My build defaults on.
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
  const selectCrest =
    region !== "all" && isLeagueRegionId(region) ? region : null;
  const colsClass = showComp
    ? "tasks-desk__cols"
    : "tasks-desk__cols tasks-desk__cols--no-comp";

  const toggleSelect = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

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

        {showRegionFilter ? (
          <label className="tasks-desk__region-wrap">
            {selectCrest ? <RegionCrest regionId={selectCrest} size={14} /> : null}
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
              aria-label="Filter by region"
              className="tasks-desk__select"
            >
              <option value="all">
                {buildOnly ? "All unlocked" : "All regions"} (
                {regionCounts.get("all") ?? 0})
              </option>
              {regionRail.map((id) => (
                <option key={id} value={id}>
                  {regionDisplayName(id)} ({regionCounts.get(id) ?? 0})
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
            <div>Region</div>
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
              const regionLabel = record.regionId
                ? regionDisplayName(record.regionId)
                : "—";

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
                    <div className="tasks-desk__region" title={regionLabel}>
                      {regionLabel}
                    </div>
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

                  {on && active && activeKey === id ? (
                    <div className="tasks-desk__stage" aria-label="Selected task">
                      <div className="tasks-desk__stage-head">
                        {record.regionId && isLeagueRegionId(record.regionId) ? (
                          <RegionCrest regionId={record.regionId} size={20} />
                        ) : null}
                        <div className="tasks-desk__stage-copy">
                          <p className={`tasks-desk__stage-name${done ? " is-done" : ""}`}>
                            {record.name}
                            {done ? " · done" : ""}
                          </p>
                          <p className="tasks-desk__stage-meta">
                            <span className="capitalize">{record.tier}</span>
                            {record.regionId ? (
                              <span> · {regionDisplayName(record.regionId)}</span>
                            ) : null}
                            <span className="is-pts">
                              {" "}
                              · {points !== null ? `${points}${provisional ? "*" : ""}` : "—"} pts
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
                        <p className="tasks-desk__stage-req">Requires: {record.requirements}</p>
                      ) : null}
                      {wikiHref ? (
                        <a
                          href={wikiHref}
                          target="_blank"
                          rel="noreferrer"
                          className="tasks-desk__stage-link"
                          aria-label={`Wiki Comp% for ${record.name}`}
                        >
                          Open on Wiki
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
  );
}
