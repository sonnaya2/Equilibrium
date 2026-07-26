"use client";

/**
 * Team Spike · BOARD-FIRST — Tasks density R1
 * Stage owns majority height; one facet row; crest strip; My build = chip only;
 * inspector bay (~12rem) mounts only after user click (selectedId set).
 */

import { useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier } from "@/tasks";
import type { TasksDensityPreviewProps } from "../TasksDensityTeamMount";
import {
  formatCompRate,
  useTasksDesk,
  wikiTaskUrl,
} from "../useTasksDesk";
import "./spike.css";

const ROW_PX = 36;

export function SpikePreview({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive,
}: TasksDensityPreviewProps) {
  const desk = useTasksDesk(raw, tiers, { rowEstimatePx: ROW_PX });
  const {
    records,
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
    taskPoints,
    isLeagueRegionId,
    regionDisplayName,
  } = desk;

  const showComp = useMemo(
    () => records.some((r) => typeof r.catalystCompletionRate === "number"),
    [records],
  );

  /** Inspector only after an explicit user selection — not auto first-row. */
  const inspectorOpen = selectedId !== null && selected !== null && taskId(selected) === selectedId;
  const active = inspectorOpen ? selected : null;

  if (records.length === 0) return null;

  const virtualItems = virtualizer.getVirtualItems();
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
    <div className="td-spike">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      {/* Single facet row — filters + My build chip + counts */}
      <div className="td-spike__facets">
        <h3 className="td-spike__title">Task board</h3>
        <span className="td-spike__count">
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
          className="td-spike__search"
        />

        <button
          type="button"
          className="td-spike__chip"
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

        <div role="group" aria-label="Filter by tier" className="td-spike__group td-spike__group--tiers">
          {(["all", ...tiersInUse] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="td-spike__chip td-spike__chip--tier"
              aria-pressed={tier === option}
              onClick={() => setTier(option)}
            >
              {option === "all" ? "All" : option}
            </button>
          ))}
        </div>

        {/* Compact horizontal crests — no side rail, stage keeps the height */}
        <div role="group" aria-label="Filter by region" className="td-spike__crests">
          <button
            type="button"
            className="td-spike__crest"
            aria-pressed={region === "all"}
            onClick={() => setRegion("all")}
          >
            <span className="td-spike__crest-name">
              {buildOnly ? "All unlocked" : "All regions"}
            </span>
            <span className="td-spike__crest-n">{regionCounts.get("all") ?? 0}</span>
          </button>
          {regionRail.map((id) => (
            <button
              key={id}
              type="button"
              className="td-spike__crest"
              aria-pressed={region === id}
              onClick={() => setRegion(id)}
            >
              {isLeagueRegionId(id) ? <RegionCrest regionId={id} size={14} /> : null}
              <span className="td-spike__crest-name">{regionDisplayName(id)}</span>
              <span className="td-spike__crest-n">{regionCounts.get(id) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`td-spike__body${inspectorOpen ? " is-split" : ""}`}>
        <div className="td-spike__stage">
          {visible.length === 0 ? (
            <p className="td-spike__empty">No tasks match.</p>
          ) : (
            <div ref={listRef} className="td-spike__list" role="list" aria-label="Tasks">
              <div className="td-spike__head" aria-hidden>
                <div className="w-4" />
                <div>Task</div>
                <div className="is-tier">Tier</div>
                {showComp ? <div className="is-num">Comp%</div> : <div />}
                <div className="is-num">Pts</div>
              </div>
              <div className="td-spike__virt" style={{ height: virtualizer.getTotalSize() }}>
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
                  const domId = `spike-task-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      role="listitem"
                      className={`td-spike__row${on ? " is-on" : ""}${item.index % 2 === 1 ? " is-zebra" : ""}`}
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <div
                        className="td-spike__row-inner"
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
                          className="td-spike__check"
                          checked={done}
                          onChange={() => onToggle(id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={
                            done
                              ? `Mark incomplete: ${record.name}`
                              : `Mark complete: ${record.name}`
                          }
                        />
                        <div className="min-w-0">
                          <label
                            htmlFor={domId}
                            className={`td-spike__name${done ? " is-done" : ""}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {record.name}
                          </label>
                          {record.regionId ? (
                            <span className="td-spike__meta">
                              {isLeagueRegionId(record.regionId) ? (
                                <RegionCrest regionId={record.regionId} size={11} />
                              ) : null}
                              {regionDisplayName(record.regionId)}
                            </span>
                          ) : null}
                        </div>
                        <div className="td-spike__tier">
                          {isTaskTier(record.tier) ? record.tier : "—"}
                        </div>
                        {showComp ? (
                          <div className="td-spike__num">
                            {rate !== null ? (
                              wikiHref ? (
                                <a
                                  href={wikiHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="td-spike__wiki"
                                  aria-label={`Wiki Comp% for ${record.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formatCompRate(rate, record.catalystCompletionRateQualifier)}
                                </a>
                              ) : (
                                formatCompRate(rate, record.catalystCompletionRateQualifier)
                              )
                            ) : (
                              <span className="is-muted">—</span>
                            )}
                          </div>
                        ) : (
                          <div />
                        )}
                        <div className={`td-spike__num${done ? " is-done" : ""}`}>
                          {points !== null ? (
                            <>
                              {points}
                              {provisional ? "*" : ""}
                            </>
                          ) : (
                            <span className="is-muted">—</span>
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

        {inspectorOpen && active ? (
          <aside
            className="td-spike__inspector"
            aria-label="Selected task"
            aria-live="polite"
          >
            <p className="td-spike__insp-kicker">Task</p>
            <div className="td-spike__insp-head">
              {active.regionId && isLeagueRegionId(active.regionId) ? (
                <RegionCrest regionId={active.regionId} size={26} />
              ) : null}
              <div className="min-w-0">
                <p className={`td-spike__insp-name${activeDone ? " is-done" : ""}`}>
                  {active.name}
                </p>
                <p className="td-spike__insp-sub">
                  {active.tier}
                  {active.regionId ? ` · ${regionDisplayName(active.regionId)}` : ""}
                  {activeDone ? " · done" : ""}
                </p>
              </div>
            </div>
            <dl className="td-spike__dl">
              <div>
                <dt>Points</dt>
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
                  <dd style={{ fontFamily: "inherit" }}>{active.localityLabel}</dd>
                </div>
              ) : null}
            </dl>
            {active.description ? (
              <p className="td-spike__blurb">{active.description}</p>
            ) : null}
            {active.requirements ? (
              <p className="td-spike__req">Requires: {active.requirements}</p>
            ) : null}
            {active.skills?.length || active.areas?.length ? (
              <p className="td-spike__tags">
                {[...(active.skills ?? []), ...(active.areas ?? [])].join(" · ")}
              </p>
            ) : null}
            {activeWiki ? (
              <a
                href={activeWiki}
                target="_blank"
                rel="noreferrer"
                className="td-spike__wiki-cta"
                aria-label={`Wiki Comp% for ${active.name}`}
              >
                Open on Wiki
              </a>
            ) : null}
            <button
              type="button"
              className="td-spike__close"
              onClick={() => setSelectedId(null)}
            >
              Close detail
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
