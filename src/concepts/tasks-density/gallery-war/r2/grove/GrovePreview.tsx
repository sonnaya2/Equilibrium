"use client";

/**
 * Grove Grid R2 — dense columns + Cipher ribbon + Crucible full-set virt.
 * Keep minmax pressure; name-only head; mono Comp%/pts instrument; no 120-cap.
 */

import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRecord, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./grove.css";

const CREST = 22;
/** ~11.5rem track — denser than Cipher/Herald; RO drives col count under virt. */
const MIN_CARD_PX = 184;
const GAP_PX = 5;
/** Collapsed content-height tile (no min-height bloat). */
const ROW_EST_PX = 92;
const ROW_EXPAND_EXTRA_PX = 120;

export function GrovePreview({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive,
}: TasksDensityPreviewProps) {
  const desk = useTasksDesk(raw, tiers, { rowEstimatePx: ROW_EST_PX });
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

  const [cols, setCols] = useState(4);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const measure = () => {
      const style = getComputedStyle(el);
      const pad =
        (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const inner = Math.max(0, el.clientWidth - pad);
      /* Slightly wider min at large desks keeps names readable without Bastion void. */
      const minPx =
        inner >= 1280 ? 204 : inner >= 980 ? 196 : MIN_CARD_PX;
      const next = Math.max(1, Math.floor((inner + GAP_PX) / (minPx + GAP_PX)));
      setCols((c) => (c === next ? c : next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [listRef, records.length, visible.length]);

  const rowCount = visible.length === 0 ? 0 : Math.ceil(visible.length / cols);

  const selectedRow = useMemo(() => {
    if (selectedId === null) return -1;
    const idx = visible.findIndex((r) => taskId(r) === selectedId);
    return idx < 0 ? -1 : Math.floor(idx / cols);
  }, [selectedId, visible, taskId, cols]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => listRef.current,
    estimateSize: (index) =>
      index === selectedRow ? ROW_EST_PX + ROW_EXPAND_EXTRA_PX : ROW_EST_PX,
    overscan: 5,
    getItemKey: (index) => {
      const start = index * cols;
      const end = Math.min(start + cols, visible.length);
      let key = `r${index}`;
      for (let i = start; i < end; i++) key += `:${taskId(visible[i]!)}`;
      return key;
    },
  });

  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedRow, cols, visible.length]);

  if (records.length === 0) {
    return (
      <div className="td-gw-grove">
        <p className="td-gw-grove__empty">No tasks loaded.</p>
      </div>
    );
  }

  const selectCrest =
    region !== "all" && isLeagueRegionId(region) ? region : null;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const mountedTiles = virtualRows.reduce((n, row) => {
    const start = row.index * cols;
    return n + Math.min(cols, visible.length - start);
  }, 0);

  return (
    <div className="td-gw-grove">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-gw-grove__shell">
        <div className="td-gw-grove__bar">
          <h3 className="td-gw-grove__title">Grove grid</h3>
          <span className="td-gw-grove__count">
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
            {visible.length > 0 ? (
              <>
                {" · "}
                <span className="is-virt" title="Tiles mounted in the virtual window">
                  virt {mountedTiles}/{visible.length}
                </span>
              </>
            ) : null}
          </span>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            className="td-gw-grove__search"
          />

          <button
            type="button"
            className={`td-gw-grove__chip${buildOnly ? " is-on" : ""}`}
            aria-pressed={buildOnly}
            title={buildOnly ? `Unlocked: ${unlockLabel}` : "Show every region"}
            onClick={() => setBuildOnly((v) => !v)}
          >
            My build
          </button>

          {regionRail.length > 0 ? (
            <label className="td-gw-grove__region-wrap">
              {selectCrest ? <RegionCrest regionId={selectCrest} size={16} /> : null}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
                aria-label="Filter by region"
                className="td-gw-grove__select"
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

          <div role="group" aria-label="Filter by tier" className="td-gw-grove__tiers">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`td-gw-grove__chip td-gw-grove__chip--tier${
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
          <p className="td-gw-grove__hint">
            Starters only — electives on <Link href="/build">Build</Link>
          </p>
        ) : null}

        {visible.length === 0 ? (
          <p className="td-gw-grove__empty">No tasks match.</p>
        ) : (
          <div ref={listRef} className="td-gw-grove__board">
            <div
              className="td-gw-grove__virt"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {virtualRows.map((vRow) => {
                const start = vRow.index * cols;
                const slice = visible.slice(start, start + cols);
                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="td-gw-grove__row"
                    style={
                      {
                        transform: `translateY(${vRow.start}px)`,
                        ["--g-cols" as string]: String(cols),
                      } as CSSProperties
                    }
                  >
                    {slice.map((record) => {
                      const id = taskId(record);
                      return (
                        <GroveTile
                          key={id}
                          id={id}
                          record={record}
                          done={completed.has(id)}
                          on={selectedId === id}
                          points={taskPoints(record)}
                          provisional={
                            tierConfidence[record.tier]?.startsWith("provisional") ?? false
                          }
                          showComp={showComp}
                          tasksWikiUrl={tasksWikiUrl}
                          onToggle={() => onToggle(id)}
                          onSelect={() =>
                            setSelectedId((cur) => (cur === id ? null : id))
                          }
                          onClose={() => setSelectedId(null)}
                          isLeagueRegionId={isLeagueRegionId}
                          regionDisplayName={regionDisplayName}
                        />
                      );
                    })}
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

function GroveTile({
  id,
  record,
  done,
  on,
  points,
  provisional,
  showComp,
  tasksWikiUrl,
  onToggle,
  onSelect,
  onClose,
  isLeagueRegionId,
  regionDisplayName,
}: {
  id: string;
  record: TaskRecord;
  done: boolean;
  on: boolean;
  points: number | null;
  provisional: boolean;
  showComp: boolean;
  tasksWikiUrl: string;
  onToggle: () => void;
  onSelect: () => void;
  onClose: () => void;
  isLeagueRegionId: (id: string) => boolean;
  regionDisplayName: (id: TaskRegionId) => string;
}) {
  const domId = `grove-r2-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  const rid = record.regionId;
  const regionLabel = rid ? regionDisplayName(rid) : "—";
  const tierLabel = isTaskTier(record.tier) ? record.tier : record.tier;
  const rate =
    typeof record.catalystCompletionRate === "number"
      ? record.catalystCompletionRate
      : null;
  const wikiHref =
    typeof record.wikiTaskId === "number"
      ? wikiTaskUrl(tasksWikiUrl, record.wikiTaskId)
      : null;

  return (
    <article
      className={`td-gw-grove__tile${on ? " is-on" : ""}${done ? " is-done" : ""}`}
    >
      <div
        className="td-gw-grove__head"
        role="button"
        tabIndex={0}
        aria-expanded={on}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <input
          type="checkbox"
          id={domId}
          checked={done}
          className="td-gw-grove__check"
          aria-label={
            done
              ? `Mark incomplete: ${record.name}`
              : `Mark complete: ${record.name}`
          }
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
        <div
          className={`td-gw-grove__crest${
            rid === "global" || !rid ? " is-global" : ""
          }`}
          aria-hidden
        >
          {rid && isLeagueRegionId(rid) ? (
            <RegionCrest regionId={rid} size={CREST} />
          ) : (
            "G"
          )}
        </div>
        {/* Name alone — meta lives on the ribbon so scan does not crush. */}
        <p className="td-gw-grove__name">{record.name}</p>
      </div>

      {/* Cipher-grade mono ribbon: left-loc / right-figures — no foot restatement */}
      <div className="td-gw-grove__ribbon" onClick={onSelect}>
        <span className="td-gw-grove__loc">
          {tierLabel}
          {rid ? ` · ${regionLabel}` : ""}
        </span>
        <span className="td-gw-grove__figures">
          {showComp ? (
            <span className="td-gw-grove__comp">
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
                "—"
              )}
            </span>
          ) : null}
          <span className="td-gw-grove__pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
            <span className="unit">pts</span>
          </span>
        </span>
      </div>

      {on ? (
        <div className="td-gw-grove__detail">
          <div className="td-gw-grove__detail-head">
            <p className={`td-gw-grove__detail-name${done ? " is-done" : ""}`}>
              {record.name}
              {done ? " · done" : ""}
            </p>
            <button type="button" className="td-gw-grove__close" onClick={onClose}>
              Close
            </button>
          </div>
          {record.description ? (
            <p className="td-gw-grove__detail-body">{record.description}</p>
          ) : null}
          {record.requirements ? (
            <p className="td-gw-grove__detail-req">Requires: {record.requirements}</p>
          ) : null}
          {wikiHref ? (
            <a
              href={wikiHref}
              target="_blank"
              rel="noreferrer"
              className="td-gw-grove__wiki"
              aria-label={`Wiki Comp% for ${record.name}`}
            >
              Open on Wiki
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
