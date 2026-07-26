"use client";

/**
 * Ember Plate — Gallery War R1
 * Stronger gem facet edge; selected tile is a lit plate.
 * Gallery tiles, expand in-tile, checkbox decoupled. Denser than Herald.
 */

import Link from "next/link";
import { useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./ember.css";

const CREST = 28;
const TILE_CAP = 120;

export function EmberPreview({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive,
}: TasksDensityPreviewProps) {
  const desk = useTasksDesk(raw, tiers, { rowEstimatePx: 140 });
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
      <div className="td-gw-ember">
        <p className="td-gw-ember__empty">No tasks loaded.</p>
      </div>
    );
  }

  const selectCrest =
    region !== "all" && isLeagueRegionId(region) ? region : null;
  const tiles = visible.slice(0, TILE_CAP);

  return (
    <div className="td-gw-ember">
      {crestRegionIds.length > 0 ? (
        <RegionCrestPreload regionIds={crestRegionIds} />
      ) : null}

      <div className="td-gw-ember__shell">
        <div className="td-gw-ember__bar">
          <h3 className="td-gw-ember__title">Ember plate</h3>
          <span className="td-gw-ember__count">
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
            {visible.length > tiles.length ? ` · showing ${tiles.length}` : null}
          </span>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            className="td-gw-ember__search"
          />

          <button
            type="button"
            className={`td-gw-ember__chip${buildOnly ? " is-on" : ""}`}
            aria-pressed={buildOnly}
            title={buildOnly ? `Unlocked: ${unlockLabel}` : "Show every region"}
            onClick={() => setBuildOnly((v) => !v)}
          >
            My build
          </button>

          {regionRail.length > 0 ? (
            <label className="td-gw-ember__region-wrap">
              {selectCrest ? <RegionCrest regionId={selectCrest} size={16} /> : null}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
                aria-label="Filter by region"
                className="td-gw-ember__select"
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

          <div role="group" aria-label="Filter by tier" className="td-gw-ember__tiers">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`td-gw-ember__chip td-gw-ember__chip--tier${
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

        {buildOnly && build.elective.length === 0 ? (
          <p className="td-gw-ember__hint">
            Starters only — electives on <Link href="/build">Build</Link>
          </p>
        ) : null}

        {tiles.length === 0 ? (
          <p className="td-gw-ember__empty">No tasks match.</p>
        ) : (
          <div className="td-gw-ember__board">
            <div className="td-gw-ember__grid">
              {tiles.map((record, index) => {
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
                const rid = record.regionId;
                const regionLabel = rid ? regionDisplayName(rid) : "—";
                const domId = `ember-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

                return (
                  <article
                    key={`${id}-${index}`}
                    className={`td-gw-ember__tile${on ? " is-on" : ""}${
                      done ? " is-done" : ""
                    }`}
                  >
                    <div
                      className="td-gw-ember__tile-top"
                      role="button"
                      tabIndex={0}
                      aria-expanded={on}
                      onClick={() =>
                        setSelectedId((cur) => (cur === id ? null : id))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId((cur) => (cur === id ? null : id));
                        }
                      }}
                    >
                      <div
                        className={`td-gw-ember__crest-slot${
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
                        className="td-gw-ember__check"
                        aria-label={
                          done
                            ? `Mark incomplete: ${record.name}`
                            : `Mark complete: ${record.name}`
                        }
                        onChange={() => onToggle(id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="td-gw-ember__tile-copy">
                        <p className="td-gw-ember__tile-name">{record.name}</p>
                        <p className="td-gw-ember__tile-meta">
                          {isTaskTier(record.tier) ? record.tier : record.tier}
                          {rid ? ` · ${regionLabel}` : ""}
                        </p>
                      </div>
                      <div className="td-gw-ember__tile-stats">
                        <span className="td-gw-ember__tile-pts">
                          {points !== null ? (
                            <>
                              {points}
                              {provisional ? "*" : ""}
                              <span className="td-gw-ember__tile-pts-unit">pts</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                        {showComp ? (
                          <span className="td-gw-ember__tile-comp">
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
                      </div>
                    </div>

                    <div className="td-gw-ember__tile-foot">
                      <span className="td-gw-ember__tile-region">{regionLabel}</span>
                      <span className="td-gw-ember__tile-open">
                        {on ? "Open" : "Details"}
                      </span>
                    </div>

                    {on ? (
                      <div className="td-gw-ember__detail">
                        <div className="td-gw-ember__detail-head">
                          <p
                            className={`td-gw-ember__detail-name${
                              done ? " is-done" : ""
                            }`}
                          >
                            {record.name}
                            {done ? " · done" : ""}
                          </p>
                          <button
                            type="button"
                            className="td-gw-ember__close"
                            onClick={() => setSelectedId(null)}
                          >
                            Close
                          </button>
                        </div>
                        {record.description ? (
                          <p className="td-gw-ember__detail-body">
                            {record.description}
                          </p>
                        ) : null}
                        {record.requirements ? (
                          <p className="td-gw-ember__detail-req">
                            Requires: {record.requirements}
                          </p>
                        ) : null}
                        {wikiHref ? (
                          <a
                            href={wikiHref}
                            target="_blank"
                            rel="noreferrer"
                            className="td-gw-ember__wiki"
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
