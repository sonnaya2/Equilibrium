"use client";

/**
 * Tab Rail — Crest Compact with large tab crests + roomy rows.
 * Meta columns packed after name (filler takes leftover space so Tier hugs Task).
 */

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier } from "@/tasks";
import type { TasksDensityPreviewProps } from "../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../useTasksDesk";
import "./tabrail.css";

const ROW_PX = 56;
const TAB_CREST = 40;

export function TabRailPreview({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive,
}: TasksDensityPreviewProps) {
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
    isUnlocked,
  } = desk;

  const showComp = useMemo(
    () => records.some((r) => typeof r.catalystCompletionRate === "number"),
    [records],
  );

  const active = useMemo(() => {
    if (selectedId === null) return null;
    return visible.find((r) => taskId(r) === selectedId) ?? null;
  }, [selectedId, visible, taskId]);

  const activeKey = active ? taskId(active) : null;

  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeKey]);

  if (records.length === 0) {
    return (
      <div className="td-tabrail">
        <p className="td-tabrail__empty">No tasks loaded.</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const colsClass = showComp
    ? "td-tabrail__cols"
    : "td-tabrail__cols td-tabrail__cols--no-comp";

  const toggleSelect = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  return (
    <div className="td-tabrail">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-tabrail__shell">
        <aside className="td-tabrail__rail" aria-label="Filter by region">
          <p className="td-tabrail__rail-label">Region</p>
          <button
            type="button"
            className={`td-tabrail__tab${region === "all" ? " is-on" : ""}`}
            aria-pressed={region === "all"}
            title={buildOnly ? "All unlocked" : "All regions"}
            onClick={() => setRegion("all")}
          >
            <span className="td-tabrail__tab-glyph" aria-hidden>
              Σ
            </span>
            <span className="td-tabrail__tab-name">All</span>
            <span className="td-tabrail__tab-count">{regionCounts.get("all") ?? 0}</span>
          </button>
          {regionRail.map((id) => {
            const label = regionDisplayName(id);
            const count = regionCounts.get(id) ?? 0;
            const locked = id !== "global" && !isUnlocked(id);
            return (
              <button
                key={id}
                type="button"
                className={`td-tabrail__tab${region === id ? " is-on" : ""}${
                  locked ? " is-locked" : ""
                }`}
                aria-pressed={region === id}
                title={
                  locked
                    ? `${label} · not in Build unlocks — still viewable`
                    : label
                }
                onClick={() => setRegion(id)}
              >
                {isLeagueRegionId(id) ? (
                  <RegionCrest regionId={id} size={TAB_CREST} />
                ) : (
                  <span className="td-tabrail__tab-glyph" aria-hidden>
                    G
                  </span>
                )}
                <span className="td-tabrail__tab-name">{label}</span>
                <span className="td-tabrail__tab-count">{count}</span>
              </button>
            );
          })}
        </aside>

        <div className="td-tabrail__main">
          <div className="td-tabrail__bar">
            <h3 className="td-tabrail__title">Tasks</h3>
            <span className="td-tabrail__count">
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
              className="td-tabrail__search"
            />

            <div className="td-tabrail__facets" role="group" aria-label="Task filters">
              <button
                type="button"
                className={`td-tabrail__chip${buildOnly ? " is-on" : ""}`}
                aria-pressed={buildOnly}
                title={
                  buildOnly
                    ? `Unlocked: ${unlockLabel}`
                    : "Show every region"
                }
                onClick={() => setBuildOnly((v) => !v)}
              >
                My build
              </button>
              <div role="group" aria-label="Filter by tier" className="td-tabrail__facets">
                {(["all", ...tiersInUse] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`td-tabrail__chip td-tabrail__chip--tier${
                      tier === option ? " is-on" : ""
                    }`}
                    aria-pressed={tier === option}
                    onClick={() => setTier(option)}
                  >
                    {option === "all" ? "All" : option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {buildOnly && build.elective.length === 0 ? (
            <p className="td-tabrail__hint">
              Starters only — electives on <Link href="/build">Build</Link>
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="td-tabrail__empty">No tasks match.</p>
          ) : (
            <div ref={listRef} className="td-tabrail__list" role="list" aria-label="Tasks">
              <div className={`td-tabrail__thead ${colsClass}`} aria-hidden>
                <div />
                <div>Task</div>
                <div>Tier</div>
                {showComp ? <div className="td-tabrail__th-num">Comp%</div> : null}
                <div className="td-tabrail__th-num">Pts</div>
                <div />
              </div>

              <div
                className="td-tabrail__body"
                style={{ height: virtualizer.getTotalSize() }}
              >
                {virtualItems.map((item) => {
                  const record = visible[item.index]!;
                  const id = taskId(record);
                  const done = completed.has(id);
                  const on = selectedId === id;
                  const points = taskPoints(record);
                  const provisional =
                    tierConfidence[record.tier]?.startsWith("provisional");
                  const rate =
                    typeof record.catalystCompletionRate === "number"
                      ? record.catalystCompletionRate
                      : null;
                  const wikiHref =
                    typeof record.wikiTaskId === "number"
                      ? wikiTaskUrl(tasksWikiUrl, record.wikiTaskId)
                      : null;
                  const domId = `tab-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      role="listitem"
                      className={`td-tabrail__item${item.index % 2 === 1 ? " is-zebra" : ""}${
                        on ? " is-on" : ""
                      }${done ? " is-done" : ""}`}
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <div
                        className={`td-tabrail__row ${colsClass}`}
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
                          className="td-tabrail__check"
                          aria-label={
                            done
                              ? `Mark incomplete: ${record.name}`
                              : `Mark complete: ${record.name}`
                          }
                          onChange={() => onToggle(id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="td-tabrail__name">{record.name}</span>
                        <span className="td-tabrail__tier">
                          {isTaskTier(record.tier) ? record.tier : "—"}
                        </span>
                        {showComp ? (
                          <span className="td-tabrail__num">
                            {rate !== null ? (
                              wikiHref ? (
                                <a
                                  href={wikiHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="td-tabrail__wiki"
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
                              "—"
                            )}
                          </span>
                        ) : null}
                        <span className={`td-tabrail__num${done ? " is-done" : ""}`}>
                          {points !== null ? (
                            <>
                              {points}
                              {provisional ? "*" : ""}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                        <span className="td-tabrail__filler" aria-hidden />
                      </div>

                      {on && active && activeKey === id ? (
                        <div className="td-tabrail__stage" aria-label="Selected task">
                          <div className="td-tabrail__stage-head">
                            {record.regionId && isLeagueRegionId(record.regionId) ? (
                              <RegionCrest regionId={record.regionId} size={28} />
                            ) : null}
                            <div>
                              <p
                                className={`td-tabrail__stage-name${done ? " is-done" : ""}`}
                              >
                                {record.name}
                                {done ? " · done" : ""}
                              </p>
                              <p className="td-tabrail__stage-meta">
                                <span className="capitalize">{record.tier}</span>
                                {record.regionId
                                  ? ` · ${regionDisplayName(record.regionId)}`
                                  : ""}
                                <span className="is-pts">
                                  {" "}
                                  ·{" "}
                                  {points !== null
                                    ? `${points}${provisional ? "*" : ""}`
                                    : "—"}{" "}
                                  pts
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              className="td-tabrail__close"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(null);
                              }}
                            >
                              Close
                            </button>
                          </div>
                          {record.description ? (
                            <p className="td-tabrail__stage-body">{record.description}</p>
                          ) : null}
                          {record.requirements ? (
                            <p className="td-tabrail__stage-req">
                              Requires: {record.requirements}
                            </p>
                          ) : null}
                          {wikiHref ? (
                            <a
                              href={wikiHref}
                              target="_blank"
                              rel="noreferrer"
                              className="td-tabrail__stage-link"
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
      </div>
    </div>
  );
}
