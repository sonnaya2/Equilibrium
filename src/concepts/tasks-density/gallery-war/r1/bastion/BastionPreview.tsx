"use client";

/**
 * Bastion Stack — Gallery War R1
 * 2-col until xl; fewer wider cards; premium readable.
 * Expand in-tile; checkbox decoupled; Spike selection law.
 */

import Link from "next/link";
import { useMemo } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./bastion.css";

const CREST_PX = 40;
/** Fewer wider cards — hard cap keeps first paint calm; Crucible owns virt. */
const TILE_CAP = 120;

export function BastionPreview({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive,
}: TasksDensityPreviewProps) {
  const desk = useTasksDesk(raw, tiers, { rowEstimatePx: 180 });
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
      <div className="td-gw-bastion">
        <p className="td-gw-bastion__empty">No tasks loaded.</p>
      </div>
    );
  }

  const selectCrest =
    region !== "all" && isLeagueRegionId(region) ? region : null;
  const tiles = visible.slice(0, TILE_CAP);

  return (
    <div className="td-gw-bastion">
      {crestRegionIds.length > 0 ? (
        <RegionCrestPreload regionIds={crestRegionIds} />
      ) : null}

      <div className="td-gw-bastion__shell">
        <div className="td-gw-bastion__bar">
          <h3 className="td-gw-bastion__title">Bastion stack</h3>
          <span className="td-gw-bastion__count">
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
            className="td-gw-bastion__search"
          />

          <button
            type="button"
            className={`td-gw-bastion__chip${buildOnly ? " is-on" : ""}`}
            aria-pressed={buildOnly}
            title={buildOnly ? `Unlocked: ${unlockLabel}` : "Show every region"}
            onClick={() => setBuildOnly((v) => !v)}
          >
            My build
          </button>

          {regionRail.length > 0 ? (
            <label className="td-gw-bastion__region-wrap">
              {selectCrest ? <RegionCrest regionId={selectCrest} size={18} /> : null}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
                aria-label="Filter by region"
                className="td-gw-bastion__select"
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

          <div role="group" aria-label="Filter by tier" className="td-gw-bastion__tiers">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`td-gw-bastion__chip td-gw-bastion__chip--tier${
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
          <p className="td-gw-bastion__hint">
            Starters only — electives on <Link href="/build">Build</Link>
          </p>
        ) : null}

        {tiles.length === 0 ? (
          <p className="td-gw-bastion__empty">No tasks match.</p>
        ) : (
          <div className="td-gw-bastion__board">
            <div className="td-gw-bastion__grid">
              {tiles.map((record, index) => {
                const id = taskId(record);
                const done = completed.has(id);
                /* Spike law: only selectedId — never desk first-row fallback */
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
                const domId = `bastion-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
                const tierLabel = isTaskTier(record.tier)
                  ? record.tier
                  : record.tier;
                const teaser =
                  record.description?.trim() ||
                  record.requirements?.trim() ||
                  "";

                const toggleExpand = () =>
                  setSelectedId((cur) => (cur === id ? null : id));

                return (
                  <article
                    key={`${id}-${index}`}
                    className={`td-gw-bastion__tile${on ? " is-on" : ""}${
                      done ? " is-done" : ""
                    }`}
                  >
                    <div
                      className="td-gw-bastion__tile-top"
                      role="button"
                      tabIndex={0}
                      aria-expanded={on}
                      onClick={toggleExpand}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand();
                        }
                      }}
                    >
                      <div
                        className={`td-gw-bastion__crest${
                          rid === "global" || !rid ? " is-global" : ""
                        }`}
                      >
                        {rid && isLeagueRegionId(rid) ? (
                          <RegionCrest regionId={rid} size={CREST_PX} />
                        ) : (
                          "G"
                        )}
                      </div>

                      <input
                        type="checkbox"
                        id={domId}
                        checked={done}
                        className="td-gw-bastion__check"
                        aria-label={
                          done
                            ? `Mark incomplete: ${record.name}`
                            : `Mark complete: ${record.name}`
                        }
                        onChange={() => onToggle(id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="td-gw-bastion__copy">
                        <p className="td-gw-bastion__tile-name">{record.name}</p>
                        <p className="td-gw-bastion__tile-meta">
                          <span className="td-gw-bastion__tier-tag">{tierLabel}</span>
                          {rid ? <span>{regionLabel}</span> : null}
                        </p>
                      </div>

                      <div className="td-gw-bastion__stats">
                        <span className="td-gw-bastion__pts">
                          {points !== null ? (
                            <>
                              {points}
                              {provisional ? "*" : ""}
                              <span className="td-gw-bastion__pts-unit">pts</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                        {showComp ? (
                          <span className="td-gw-bastion__comp">
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
                                <span className="td-gw-bastion__comp-plain">
                                  {formatCompRate(
                                    rate,
                                    record.catalystCompletionRateQualifier,
                                  )}
                                </span>
                              )
                            ) : (
                              <span className="td-gw-bastion__comp-plain">—</span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p
                      className={`td-gw-bastion__teaser${teaser ? "" : " is-empty"}`}
                      onClick={toggleExpand}
                    >
                      {teaser || "No description on record."}
                    </p>

                    <div className="td-gw-bastion__foot">
                      <span className="td-gw-bastion__foot-region">{regionLabel}</span>
                      <span className="td-gw-bastion__foot-open">
                        {on ? "Open" : "Details"}
                      </span>
                    </div>

                    {on ? (
                      <div className="td-gw-bastion__detail">
                        <div className="td-gw-bastion__detail-head">
                          <p
                            className={`td-gw-bastion__detail-name${
                              done ? " is-done" : ""
                            }`}
                          >
                            {record.name}
                            {done ? " · done" : ""}
                          </p>
                          <button
                            type="button"
                            className="td-gw-bastion__close"
                            onClick={() => setSelectedId(null)}
                          >
                            Close
                          </button>
                        </div>
                        {record.description ? (
                          <p className="td-gw-bastion__detail-body">
                            {record.description}
                          </p>
                        ) : null}
                        {record.requirements ? (
                          <p className="td-gw-bastion__detail-req">
                            Requires: {record.requirements}
                          </p>
                        ) : null}
                        {wikiHref ? (
                          <a
                            href={wikiHref}
                            target="_blank"
                            rel="noreferrer"
                            className="td-gw-bastion__wiki"
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
