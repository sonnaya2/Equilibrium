"use client";

/**
 * Team Ledger · Wiki Strip
 * Full-width dense table; horizontal crest strip; detail as bottom drawer.
 * No permanent third column. State via useTasksDesk.
 */

import Link from "next/link";
import { useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier } from "@/tasks";
import type { TasksDensityPreviewProps } from "../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../useTasksDesk";
import "./ledger.css";

const ROW_PX = 28;

export function LedgerPreview({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive,
}: TasksDensityPreviewProps) {
  const desk = useTasksDesk(raw, tiers, {
    rowEstimatePx: ROW_PX,
    listMaxCss: "min(78vh, 48rem)",
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
  const showRegionFilter = regionRail.length > 0;
  const colsClass = showComp ? "td-ledger__cols" : "td-ledger__cols td-ledger__cols--no-comp";

  if (records.length === 0) {
    return (
      <div className="td-ledger">
        <p className="td-ledger__empty">No tasks loaded.</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const selectedDone = selected ? completed.has(taskId(selected)) : false;
  const selectedPts = selected ? taskPoints(selected) : null;
  const selectedRate =
    selected && typeof selected.catalystCompletionRate === "number"
      ? selected.catalystCompletionRate
      : null;
  const selectedWiki =
    selected && typeof selected.wikiTaskId === "number"
      ? wikiTaskUrl(tasksWikiUrl, selected.wikiTaskId)
      : null;
  const selectedActiveId = selected ? taskId(selected) : null;

  return (
    <div className="td-ledger">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      {/* Facet toolbar */}
      <div className="td-ledger__toolbar">
        <h3 className="td-ledger__title">Task board</h3>
        <span className="td-ledger__count">
          {visible.length}/{records.length}
          {totalVisible > 0 ? (
            <>
              {" · "}
              <span className="is-pts">
                {earnedVisible}/{totalVisible} pts
              </span>
              {doneVisible > 0 ? <span> · {doneVisible} done</span> : null}
            </>
          ) : null}
          {showComp ? (
            <span> · Comp% {completionLive ? "live" : "snap"}</span>
          ) : null}
        </span>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tasks"
          aria-label="Filter tasks"
          className="td-ledger__search"
        />

        <div className="td-ledger__facets" role="group" aria-label="Task filters">
          <button
            type="button"
            onClick={() => setBuildOnly((v) => !v)}
            aria-pressed={buildOnly}
            title={
              buildOnly
                ? `Unlocked: ${unlockLabel}. Global tasks stay included.`
                : "Show every region, not only your Build picks"
            }
            className="td-ledger__facet"
          >
            My build
          </button>

          <div role="group" aria-label="Filter by tier" className="td-ledger__facets">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTier(option)}
                aria-pressed={tier === option}
                className="td-ledger__facet"
              >
                {option === "all" ? "All" : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {buildOnly && build.elective.length === 0 ? (
        <p className="td-ledger__hint">
          My build · starters only — pick electives on{" "}
          <Link href="/build">Build</Link>
        </p>
      ) : null}

      {/* Horizontal crest strip — not a side rail */}
      <div className="td-ledger__crests" role="group" aria-label="Filter by region">
        <button
          type="button"
          className="td-ledger__crest"
          aria-pressed={region === "all"}
          onClick={() => setRegion("all")}
        >
          <span className="td-ledger__crest-name">
            {buildOnly ? "All unlocked" : "All regions"}
          </span>
          <span className="td-ledger__crest-n">{regionCounts.get("all") ?? 0}</span>
        </button>
        {showRegionFilter
          ? regionRail.map((id) => (
              <button
                key={id}
                type="button"
                className="td-ledger__crest"
                aria-pressed={region === id}
                onClick={() => setRegion(id)}
              >
                {isLeagueRegionId(id) ? <RegionCrest regionId={id} size={14} /> : null}
                <span className="td-ledger__crest-name">{regionDisplayName(id)}</span>
                <span className="td-ledger__crest-n">{regionCounts.get(id) ?? 0}</span>
              </button>
            ))
          : null}
      </div>

      {/* Dense virtualized table */}
      <div className="td-ledger__stage">
        {visible.length === 0 ? (
          <p className="td-ledger__empty">No tasks match.</p>
        ) : (
          <div ref={listRef} className="td-ledger__list" role="list" aria-label="Tasks">
            <div className={`td-ledger__thead ${colsClass}`} aria-hidden>
              <div />
              <div>Task</div>
              <div className="td-ledger__th-region">Region</div>
              <div className="td-ledger__th-num">Tier</div>
              {showComp ? <div className="td-ledger__th-num">Comp%</div> : null}
              <div className="td-ledger__th-num">Pts</div>
            </div>

            <div className="td-ledger__body" style={{ height: virtualizer.getTotalSize() }}>
              {virtualItems.map((item) => {
                const record = visible[item.index]!;
                const id = taskId(record);
                const done = completed.has(id);
                const on = selectedActiveId === id || (!selectedId && item.index === 0);
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
                const domId = `td-ledger-task-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    role="listitem"
                    className={`td-ledger__row${item.index % 2 === 1 ? " is-zebra" : ""}${on ? " is-selected" : ""}${done ? " is-done" : ""}`}
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <div
                      className={`td-ledger__row-inner ${colsClass}`}
                      onClick={() => setSelectedId(id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(id);
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
                        className="td-ledger__check"
                        aria-label={
                          done
                            ? `Mark incomplete: ${record.name}`
                            : `Mark complete: ${record.name}`
                        }
                      />
                      <label
                        htmlFor={domId}
                        className="td-ledger__name"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {record.name}
                      </label>
                      <div className="td-ledger__region td-ledger__region-col">
                        {record.regionId && isLeagueRegionId(record.regionId) ? (
                          <RegionCrest regionId={record.regionId} size={12} />
                        ) : null}
                        <span className="td-ledger__region-text">
                          {record.regionId ? regionDisplayName(record.regionId) : "—"}
                        </span>
                      </div>
                      <div className="td-ledger__tier">
                        {isTaskTier(record.tier) ? record.tier : "—"}
                      </div>
                      {showComp ? (
                        <div className="td-ledger__num">
                          {rate !== null ? (
                            wikiHref ? (
                              <a
                                href={wikiHref}
                                target="_blank"
                                rel="noreferrer"
                                className="td-ledger__wiki"
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
                      <div className={`td-ledger__num${done ? " is-done" : ""}`}>
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

      {/* Bottom detail drawer — never a permanent third column */}
      <aside className="td-ledger__drawer" aria-label="Selected task">
        {selected ? (
          <>
            <div className="td-ledger__drawer-head">
              {selected.regionId && isLeagueRegionId(selected.regionId) ? (
                <RegionCrest regionId={selected.regionId} size={24} />
              ) : null}
              <div style={{ minWidth: 0, flex: "1 1 12rem" }}>
                <p className={`td-ledger__drawer-title${selectedDone ? " is-done" : ""}`}>
                  {selected.name}
                </p>
                <p className="td-ledger__drawer-meta">
                  {selected.tier}
                  {selected.regionId ? ` · ${regionDisplayName(selected.regionId)}` : ""}
                  {selectedDone ? " · done" : ""}
                </p>
              </div>
              <dl className="td-ledger__drawer-facts">
                <div>
                  <dt>Pts</dt>
                  <dd className="is-pts">{selectedPts !== null ? selectedPts : "—"}</dd>
                </div>
                {showComp ? (
                  <div>
                    <dt>Comp%</dt>
                    <dd>
                      {selectedRate !== null
                        ? formatCompRate(
                            selectedRate,
                            selected.catalystCompletionRateQualifier,
                          )
                        : "—"}
                    </dd>
                  </div>
                ) : null}
                {selected.localityLabel ? (
                  <div>
                    <dt>Locality</dt>
                    <dd style={{ fontFamily: "inherit" }}>{selected.localityLabel}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            {selected.description ? (
              <p className="td-ledger__drawer-body">{selected.description}</p>
            ) : null}
            {selected.requirements ? (
              <p className="td-ledger__drawer-req">Requires: {selected.requirements}</p>
            ) : null}
            {selected.skills?.length || selected.areas?.length ? (
              <p className="td-ledger__drawer-tags">
                {[...(selected.skills ?? []), ...(selected.areas ?? [])].join(" · ")}
              </p>
            ) : null}
            {selectedWiki ? (
              <a
                href={selectedWiki}
                target="_blank"
                rel="noreferrer"
                className="td-ledger__drawer-link"
                aria-label={`Wiki Comp% for ${selected.name}`}
              >
                Open on Wiki
              </a>
            ) : null}
          </>
        ) : (
          <p className="td-ledger__drawer-empty">Select a task.</p>
        )}
      </aside>
    </div>
  );
}
