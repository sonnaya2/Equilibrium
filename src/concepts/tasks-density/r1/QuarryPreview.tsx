"use client";

/**
 * Team Quarry · Crest Compact — three-bay DNA compressed hard.
 * Rail: crests-only 7.5rem · stage: one-line bar · rows: single line · inspector: 12rem.
 */

import Link from "next/link";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier } from "@/tasks";
import type { TasksDensityPreviewProps } from "../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../useTasksDesk";
import "./quarry.css";

const ROW_PX = 28;

export function QuarryPreview({
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
    selected,
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

  if (records.length === 0) {
    return (
      <div className="td-quarry">
        <p className="q-empty">No task records loaded.</p>
      </div>
    );
  }

  const showComp = records.some((r) => typeof r.catalystCompletionRate === "number");
  const showRegionFilter = regionRail.length > 0;
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

  return (
    <div className="td-quarry relative">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="q-grid">
        {/* Crest-only rail — title tooltip carries the name */}
        <aside className="q-rail" aria-label="Filter by region">
          <p className="q-rail-label">Region</p>
          <button
            type="button"
            className={`q-leaf${region === "all" ? " is-on" : ""}`}
            aria-pressed={region === "all"}
            title={buildOnly ? "All unlocked" : "All regions"}
            aria-label={
              buildOnly
                ? `All unlocked, ${regionCounts.get("all") ?? 0} tasks`
                : `All regions, ${regionCounts.get("all") ?? 0} tasks`
            }
            onClick={() => setRegion("all")}
          >
            <span className="q-leaf-glyph" aria-hidden>
              Σ
            </span>
            <span className="q-leaf-count">{regionCounts.get("all") ?? 0}</span>
          </button>
          {showRegionFilter
            ? regionRail.map((id) => {
                const label = regionDisplayName(id);
                const count = regionCounts.get(id) ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`q-leaf${region === id ? " is-on" : ""}`}
                    aria-pressed={region === id}
                    title={label}
                    aria-label={`${label}, ${count} tasks`}
                    onClick={() => setRegion(id)}
                  >
                    {isLeagueRegionId(id) ? (
                      <RegionCrest regionId={id} size={18} />
                    ) : (
                      <span className="q-leaf-glyph" aria-hidden>
                        G
                      </span>
                    )}
                    <span className="q-leaf-count">{count}</span>
                  </button>
                );
              })
            : null}
        </aside>

        {/* Stage: one-line bar + single-line rows */}
        <div className="q-stage">
          <div className="q-bar">
            <h3 className="q-bar-title">Tasks</h3>
            <span className="q-bar-meta">
              {visible.length}/{records.length}
              {totalVisible > 0 ? (
                <>
                  {" · "}
                  <span className="q-pts">
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
              className="q-search"
            />

            <div className="q-facets" role="group" aria-label="Task filters">
              <button
                type="button"
                onClick={() => setBuildOnly((v) => !v)}
                aria-pressed={buildOnly}
                title={
                  buildOnly
                    ? `Unlocked: ${unlockLabel}. Global tasks stay included.`
                    : "Show every region, not only your Build picks"
                }
                className={`q-facet${buildOnly ? " is-on" : ""}`}
              >
                My build
              </button>
              {(["all", ...tiersInUse] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTier(option)}
                  aria-pressed={tier === option}
                  className={`q-facet${tier === option ? " is-on" : ""}`}
                >
                  {option === "all" ? "All" : option}
                </button>
              ))}
            </div>
          </div>

          {buildOnly && build.elective.length === 0 ? (
            <p className="q-hint">
              My build · starters only — pick electives on{" "}
              <Link href="/build">Build</Link>
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="q-empty">No tasks match.</p>
          ) : (
            <div ref={listRef} className="q-list" role="list" aria-label="Tasks">
              <div className="q-head" aria-hidden>
                <div />
                <div>Task</div>
                <div>Tier</div>
                {showComp ? <div>Comp%</div> : <div />}
                <div>Pts</div>
              </div>
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.map((item) => {
                  const record = visible[item.index]!;
                  const id = taskId(record);
                  const done = completed.has(id);
                  const on = selected ? taskId(selected) === id : item.index === 0;
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
                  const domId = `q-task-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

                  return (
                    <div
                      key={item.key}
                      data-index={item.index}
                      ref={virtualizer.measureElement}
                      role="listitem"
                      className={`q-row${on ? " is-on" : ""}`}
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <div
                        className="q-row-inner"
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
                          className="q-check"
                          aria-label={
                            done
                              ? `Mark incomplete: ${record.name}`
                              : `Mark complete: ${record.name}`
                          }
                        />
                        <label
                          htmlFor={domId}
                          className={`q-name${done ? " is-done" : ""}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {record.name}
                        </label>
                        <div className="q-tier">
                          {isTaskTier(record.tier) ? record.tier : "—"}
                        </div>
                        {showComp ? (
                          <div className="q-comp">
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
                                <span>
                                  {formatCompRate(rate, record.catalystCompletionRateQualifier)}
                                </span>
                              )
                            ) : (
                              <span className="q-muted">—</span>
                            )}
                          </div>
                        ) : (
                          <div />
                        )}
                        <div className={`q-pts-cell${done ? " is-done" : ""}`}>
                          {points !== null ? (
                            <span>
                              {points}
                              {provisional ? "*" : ""}
                            </span>
                          ) : (
                            <span className="q-muted">—</span>
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

        {/* Dense inspector */}
        <aside className="q-inspector" aria-label="Selected task">
          {selected ? (
            <>
              <p className="q-insp-kicker">Task</p>
              <div className="q-insp-head">
                {selected.regionId && isLeagueRegionId(selected.regionId) ? (
                  <RegionCrest regionId={selected.regionId} size={22} />
                ) : null}
                <div className="min-w-0">
                  <p className={`q-insp-name${selectedDone ? " is-done" : ""}`}>
                    {selected.name}
                  </p>
                  <p className="q-insp-sub">
                    {selected.tier}
                    {selected.regionId ? ` · ${regionDisplayName(selected.regionId)}` : ""}
                    {selectedDone ? " · done" : ""}
                  </p>
                </div>
              </div>
              <dl className="q-dl">
                <dt>Points</dt>
                <dd className="q-gem">{selectedPts !== null ? selectedPts : "—"}</dd>
                {showComp ? (
                  <>
                    <dt>Comp%</dt>
                    <dd className="q-mono">
                      {selectedRate !== null
                        ? formatCompRate(
                            selectedRate,
                            selected.catalystCompletionRateQualifier,
                          )
                        : "—"}
                    </dd>
                  </>
                ) : null}
                {selected.localityLabel ? (
                  <>
                    <dt>Locality</dt>
                    <dd>{selected.localityLabel}</dd>
                  </>
                ) : null}
                {selected.regionId ? (
                  <>
                    <dt>Region</dt>
                    <dd>{regionDisplayName(selected.regionId)}</dd>
                  </>
                ) : null}
              </dl>
              {selected.description ? (
                <p className="q-insp-body">{selected.description}</p>
              ) : null}
              {selected.requirements ? (
                <p className="q-insp-req">Requires: {selected.requirements}</p>
              ) : null}
              {selected.skills?.length || selected.areas?.length ? (
                <p className="q-insp-tags">
                  {[...(selected.skills ?? []), ...(selected.areas ?? [])].join(" · ")}
                </p>
              ) : null}
              {selectedWiki ? (
                <a
                  href={selectedWiki}
                  target="_blank"
                  rel="noreferrer"
                  className="q-wiki"
                  aria-label={`Wiki Comp% for ${selected.name}`}
                >
                  Open on Wiki
                </a>
              ) : null}
            </>
          ) : (
            <p className="q-insp-empty">Select a task.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
