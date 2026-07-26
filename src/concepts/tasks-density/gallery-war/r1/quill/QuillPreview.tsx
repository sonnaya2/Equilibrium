"use client";

/**
 * Quill Index — Gallery War R1
 * Facet bar = one dense horizontal scroll track; board owns remaining height.
 * Gallery tiles; expand in-tile; checkbox ≠ expand.
 */

import Link from "next/link";
import { useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./quill.css";

const CREST = 32;
const TRACK_CREST = 22;
const TILE_CAP = 120;

export function QuillPreview({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive,
}: TasksDensityPreviewProps) {
  const desk = useTasksDesk(raw, tiers, { rowEstimatePx: 150 });
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
    isUnlocked,
    visible,
    completed,
    selectedId,
    setSelectedId,
    doneVisible,
    earnedVisible,
    totalVisible,
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

  if (records.length === 0) {
    return (
      <div className="td-gw-quill">
        <p className="td-gw-quill__empty">No tasks loaded.</p>
      </div>
    );
  }

  const tiles = visible.slice(0, TILE_CAP);
  const startersOnly = buildOnly && build.elective.length === 0;

  const toggleSelect = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  return (
    <div className="td-gw-quill">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-gw-quill__shell">
        {/* Single scroll track — never wraps; board gets the height */}
        <div className="td-gw-quill__track" role="toolbar" aria-label="Task filters">
          <h3 className="td-gw-quill__mark">Index</h3>

          <span className="td-gw-quill__count">
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
            {visible.length > tiles.length ? ` · ${tiles.length} shown` : null}
          </span>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter"
            aria-label="Filter tasks"
            className="td-gw-quill__search"
          />

          <button
            type="button"
            className="td-gw-quill__chip"
            aria-pressed={buildOnly}
            title={
              buildOnly
                ? `Unlocked: ${unlockLabel}. Global tasks stay included.`
                : "Show every region"
            }
            onClick={() => setBuildOnly((v) => !v)}
          >
            My build
          </button>

          {startersOnly ? (
            <span className="td-gw-quill__note">
              Starters · <Link href="/build">Build</Link>
            </span>
          ) : null}

          <div role="group" aria-label="Filter by tier" className="td-gw-quill__group">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                className="td-gw-quill__chip td-gw-quill__chip--tier"
                aria-pressed={tier === option}
                onClick={() => setTier(option)}
              >
                {option === "all" ? "All" : option}
              </button>
            ))}
          </div>

          <span className="td-gw-quill__rule" aria-hidden />

          {regionRail.length > 0 ? (
            <div role="group" aria-label="Filter by region" className="td-gw-quill__regions">
              <button
                type="button"
                className={`td-gw-quill__crest${region === "all" ? " is-on" : ""}`}
                aria-pressed={region === "all"}
                title={buildOnly ? "All unlocked" : "All regions"}
                aria-label={
                  buildOnly
                    ? `All unlocked, ${regionCounts.get("all") ?? 0} tasks`
                    : `All regions, ${regionCounts.get("all") ?? 0} tasks`
                }
                onClick={() => setRegion("all")}
              >
                <span className="td-gw-quill__crest-glyph" aria-hidden>
                  Σ
                </span>
                <span className="td-gw-quill__crest-n">{regionCounts.get("all") ?? 0}</span>
              </button>
              {regionRail.map((id) => {
                const label = regionDisplayName(id);
                const count = regionCounts.get(id) ?? 0;
                const locked =
                  buildOnly && isLeagueRegionId(id) && !isUnlocked(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`td-gw-quill__crest${region === id ? " is-on" : ""}${
                      locked ? " is-locked" : ""
                    }`}
                    aria-pressed={region === id}
                    title={
                      locked
                        ? `${label} · not in Build unlocks — still viewable`
                        : label
                    }
                    aria-label={
                      locked
                        ? `${label}, ${count} tasks, not in Build unlocks — still viewable`
                        : `${label}, ${count} tasks`
                    }
                    onClick={() => setRegion(id)}
                  >
                    {isLeagueRegionId(id) ? (
                      <RegionCrest regionId={id} size={TRACK_CREST} />
                    ) : (
                      <span className="td-gw-quill__crest-glyph" aria-hidden>
                        G
                      </span>
                    )}
                    <span className="td-gw-quill__crest-n">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {tiles.length === 0 ? (
          <p className="td-gw-quill__empty">No tasks match.</p>
        ) : (
          <div className="td-gw-quill__board">
            <div className="td-gw-quill__grid">
              {tiles.map((record, index) => {
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
                const rid = record.regionId;
                const regionLabel = rid ? regionDisplayName(rid) : "—";
                const domId = `quill-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

                return (
                  <article
                    key={`${id}-${index}`}
                    className={`td-gw-quill__tile${on ? " is-on" : ""}${done ? " is-done" : ""}`}
                  >
                    <div
                      className="td-gw-quill__tile-top"
                      role="button"
                      tabIndex={0}
                      aria-expanded={on}
                      onClick={() => toggleSelect(id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSelect(id);
                        }
                      }}
                    >
                      <div
                        className={`td-gw-quill__medallion${
                          rid === "global" || !rid ? " is-global" : ""
                        }`}
                      >
                        {rid && isLeagueRegionId(rid) ? (
                          <RegionCrest regionId={rid} size={CREST} />
                        ) : (
                          "G"
                        )}
                      </div>

                      <input
                        type="checkbox"
                        id={domId}
                        checked={done}
                        className="td-gw-quill__check"
                        aria-label={
                          done
                            ? `Mark incomplete: ${record.name}`
                            : `Mark complete: ${record.name}`
                        }
                        onChange={() => onToggle(id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="td-gw-quill__tile-copy">
                        <p className="td-gw-quill__tile-name">{record.name}</p>
                        <p className="td-gw-quill__tile-meta">
                          {isTaskTier(record.tier) ? record.tier : record.tier}
                          {rid ? ` · ${regionLabel}` : ""}
                        </p>
                      </div>

                      <div className="td-gw-quill__tile-stats">
                        <span className="td-gw-quill__tile-pts">
                          {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
                          <span className="td-gw-quill__pts-unit"> pts</span>
                        </span>
                        {showComp ? (
                          <span className="td-gw-quill__tile-comp">
                            {rate !== null ? (
                              wikiHref ? (
                                <a
                                  href={wikiHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Wiki Comp% for ${record.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formatCompRate(
                                    rate,
                                    record.catalystCompletionRateQualifier,
                                  )}
                                </a>
                              ) : (
                                formatCompRate(rate, record.catalystCompletionRateQualifier)
                              )
                            ) : (
                              "—"
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="td-gw-quill__tile-foot">
                      <span className="td-gw-quill__tile-region">{regionLabel}</span>
                      <span className="td-gw-quill__tile-cue">{on ? "Open" : "Details"}</span>
                    </div>

                    {on ? (
                      <div className="td-gw-quill__detail">
                        <div className="td-gw-quill__detail-head">
                          <p
                            className={`td-gw-quill__detail-name${done ? " is-done" : ""}`}
                          >
                            {record.name}
                            {done ? " · done" : ""}
                          </p>
                          <button
                            type="button"
                            className="td-gw-quill__close"
                            onClick={() => setSelectedId(null)}
                          >
                            Close
                          </button>
                        </div>
                        {record.description ? (
                          <p className="td-gw-quill__detail-body">{record.description}</p>
                        ) : null}
                        {record.requirements ? (
                          <p className="td-gw-quill__detail-req">
                            Requires: {record.requirements}
                          </p>
                        ) : null}
                        {wikiHref ? (
                          <a
                            href={wikiHref}
                            target="_blank"
                            rel="noreferrer"
                            className="td-gw-quill__wiki"
                            aria-label={`Wiki Comp% for ${record.name}`}
                          >
                            Open on Wiki
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
