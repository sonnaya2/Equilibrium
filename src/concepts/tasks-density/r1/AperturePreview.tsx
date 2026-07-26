"use client";

/**
 * Team Aperture · Select + Stage (R1.1 surgery)
 * No side rail. Region = <select> + crest badge in facets.
 * Full-width dense rows; inline stage under selected row only.
 * Spike law: no auto-open; re-click / Close collapses.
 */

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../useTasksDesk";
import "./aperture.css";

const ROW_PX = 28;

export function AperturePreview({
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

  const toggleSelect = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  return (
    <div className="td-aperture">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-aperture__shell">
        <div className="td-aperture__facets">
          <h3 className="td-aperture__title">Task board</h3>
          <span className="td-aperture__count">
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
            className="td-aperture__search"
          />

          <button
            type="button"
            onClick={() => setBuildOnly((v) => !v)}
            aria-pressed={buildOnly}
            title={
              buildOnly
                ? `Unlocked: ${unlockLabel}. Global tasks stay included.`
                : "Show every region, not only your Build picks"
            }
            className={`td-aperture__facet${buildOnly ? " is-on" : ""}`}
          >
            My build
          </button>

          {showRegionFilter ? (
            <label className="td-aperture__region-wrap">
              {selectCrest ? <RegionCrest regionId={selectCrest} size={14} /> : null}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
                aria-label="Filter by region"
                className="td-aperture__select"
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

          <div role="group" aria-label="Filter by tier" className="td-aperture__tiers">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTier(option)}
                aria-pressed={tier === option}
                className={`td-aperture__facet${option !== "all" ? " is-tier" : ""}${
                  tier === option ? " is-on" : ""
                }`}
              >
                {option === "all" ? "All" : option}
              </button>
            ))}
          </div>
        </div>

        {buildOnly && build.elective.length === 0 ? (
          <p className="td-aperture__hint">
            Starters only — electives on <Link href="/build">Build</Link>
          </p>
        ) : null}

        {visible.length === 0 ? (
          <p className="td-aperture__empty">No tasks match.</p>
        ) : (
          <div ref={listRef} className="td-aperture__list" role="list" aria-label="Tasks">
            <div className="td-aperture__colhead" aria-hidden>
              <span />
              <span>Task</span>
              <span>Region</span>
              <span className="is-end">Tier</span>
              {showComp ? <span className="is-end">Comp%</span> : <span />}
              <span className="is-end">Pts</span>
            </div>

            <div className="td-aperture__virt" style={{ height: virtualizer.getTotalSize() }}>
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
                const domId = `ap-task-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
                const regionLabel = record.regionId
                  ? regionDisplayName(record.regionId)
                  : "—";

                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    role="listitem"
                    className={`td-aperture__item${on ? " is-on" : ""}${
                      item.index % 2 === 1 ? " is-zebra" : ""
                    }`}
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <div
                      className="td-aperture__row"
                      onClick={() => toggleSelect(id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSelect(id);
                        }
                      }}
                      tabIndex={0}
                      aria-selected={on}
                    >
                      <input
                        type="checkbox"
                        id={domId}
                        checked={done}
                        onChange={() => onToggle(id)}
                        onClick={(e) => e.stopPropagation()}
                        className="td-aperture__check"
                        aria-label={
                          done
                            ? `Mark incomplete: ${record.name}`
                            : `Mark complete: ${record.name}`
                        }
                      />
                      <label
                        htmlFor={domId}
                        className={`td-aperture__name${done ? " is-done" : ""}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.name}
                      </label>
                      <span className="td-aperture__region" title={regionLabel}>
                        {regionLabel}
                      </span>
                      <span className="td-aperture__tier">
                        {isTaskTier(record.tier) ? record.tier : "—"}
                      </span>
                      {showComp ? (
                        <span className="td-aperture__comp">
                          {rate !== null ? (
                            wikiHref ? (
                              <a
                                href={wikiHref}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Wiki Comp% for ${record.name}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {formatCompRate(rate, record.catalystCompletionRateQualifier)}
                              </a>
                            ) : (
                              formatCompRate(rate, record.catalystCompletionRateQualifier)
                            )
                          ) : (
                            <span className="is-miss">—</span>
                          )}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className={`td-aperture__pts${done ? " is-done" : ""}`}>
                        {points !== null ? (
                          <>
                            {points}
                            {provisional ? "*" : ""}
                          </>
                        ) : (
                          <span className="is-miss">—</span>
                        )}
                      </span>
                    </div>

                    {on && active && activeKey === id ? (
                      <div className="td-aperture__stage" aria-label="Selected task">
                        <div className="td-aperture__stage-head">
                          {record.regionId && isLeagueRegionId(record.regionId) ? (
                            <RegionCrest regionId={record.regionId} size={20} />
                          ) : null}
                          <div className="td-aperture__stage-copy">
                            <p className={`td-aperture__stage-name${done ? " is-done" : ""}`}>
                              {record.name}
                              {done ? " · done" : ""}
                            </p>
                            <p className="td-aperture__stage-meta">
                              <span>
                                Tier <b className="is-cap">{record.tier}</b>
                              </span>
                              {record.regionId ? (
                                <span>
                                  Region <b>{regionLabel}</b>
                                </span>
                              ) : null}
                              <span>
                                Pts{" "}
                                <b className="is-pts">
                                  {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
                                </b>
                              </span>
                              {showComp ? (
                                <span>
                                  Comp%{" "}
                                  <b>
                                    {rate !== null
                                      ? formatCompRate(
                                          rate,
                                          record.catalystCompletionRateQualifier,
                                        )
                                      : "—"}
                                  </b>
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="td-aperture__close"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(null);
                            }}
                          >
                            Close
                          </button>
                        </div>
                        {record.description ? (
                          <p className="td-aperture__stage-body">{record.description}</p>
                        ) : null}
                        {record.requirements ? (
                          <p className="td-aperture__stage-req">Requires: {record.requirements}</p>
                        ) : null}
                        {record.skills?.length || record.areas?.length ? (
                          <p className="td-aperture__stage-tags">
                            {[...(record.skills ?? []), ...(record.areas ?? [])].join(" · ")}
                          </p>
                        ) : null}
                        <div className="td-aperture__stage-actions">
                          {wikiHref ? (
                            <a
                              href={wikiHref}
                              target="_blank"
                              rel="noreferrer"
                              className="td-aperture__wiki"
                              aria-label={`Wiki Comp% for ${record.name}`}
                            >
                              Open on Wiki
                            </a>
                          ) : null}
                          {record.localityLabel ? (
                            <span className="td-aperture__local">{record.localityLabel}</span>
                          ) : null}
                        </div>
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
  );
}
