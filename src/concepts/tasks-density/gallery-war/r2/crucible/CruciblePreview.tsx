"use client";

/**
 * Crucible Virt R2 — full row-virtualized gallery + Cipher mono ribbon scan.
 * Keep: virt window over full filtered set. Steal: Comp%/pts ribbon. Kill: foot region + idle wash.
 */

import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRecord, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./crucible.css";

const CREST = 22;
/** Denser than R1 Herald-default ~276px (~17rem). */
const MIN_CARD_PX = 242;
const GAP_PX = 6;
/** Collapsed row: head + ribbon + cue + gap. */
const ROW_EST_PX = 118;
const ROW_EXPAND_EXTRA_PX = 140;

export function CruciblePreview({
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

  const [cols, setCols] = useState(2);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const measure = () => {
      const style = getComputedStyle(el);
      const pad =
        (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const inner = Math.max(0, el.clientWidth - pad);
      const next = Math.max(1, Math.floor((inner + GAP_PX) / (MIN_CARD_PX + GAP_PX)));
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
    overscan: 4,
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
      <div className="td-gw-crucible-r2">
        <p className="td-gw-crucible-r2__empty">No tasks loaded.</p>
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
    <div className="td-gw-crucible-r2">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-gw-crucible-r2__shell">
        <div className="td-gw-crucible-r2__bar">
          <h3 className="td-gw-crucible-r2__title">Crucible</h3>
          <span className="td-gw-crucible-r2__count">
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
            className="td-gw-crucible-r2__search"
          />

          <button
            type="button"
            className={`td-gw-crucible-r2__chip${buildOnly ? " is-on" : ""}`}
            aria-pressed={buildOnly}
            title={buildOnly ? `Unlocked: ${unlockLabel}` : "Show every region"}
            onClick={() => setBuildOnly((v) => !v)}
          >
            My build
          </button>

          {regionRail.length > 0 ? (
            <label className="td-gw-crucible-r2__region-wrap">
              {selectCrest ? <RegionCrest regionId={selectCrest} size={18} /> : null}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
                aria-label="Filter by region"
                className="td-gw-crucible-r2__select"
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

          <div role="group" aria-label="Filter by tier" className="td-gw-crucible-r2__tiers">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`td-gw-crucible-r2__chip td-gw-crucible-r2__chip--tier${
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
          <p className="td-gw-crucible-r2__hint">
            Starters only — electives on <Link href="/build">Build</Link>
          </p>
        ) : null}

        {visible.length === 0 ? (
          <p className="td-gw-crucible-r2__empty">No tasks match.</p>
        ) : (
          <div ref={listRef} className="td-gw-crucible-r2__board">
            <div
              className="td-gw-crucible-r2__virt"
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
                    className="td-gw-crucible-r2__row"
                    style={
                      {
                        transform: `translateY(${vRow.start}px)`,
                        ["--c-cols" as string]: String(cols),
                      } as CSSProperties
                    }
                  >
                    {slice.map((record) => {
                      const id = taskId(record);
                      return (
                        <CrucibleTile
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

function CrucibleTile({
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
  const domId = `crucible-r2-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
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
      className={`td-gw-crucible-r2__tile${on ? " is-on" : ""}${done ? " is-done" : ""}`}
    >
      <div
        className="td-gw-crucible-r2__head"
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
          className="td-gw-crucible-r2__check"
          aria-label={
            done
              ? `Mark incomplete: ${record.name}`
              : `Mark complete: ${record.name}`
          }
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
        <div
          className={`td-gw-crucible-r2__crest${
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
        <p className="td-gw-crucible-r2__name">{record.name}</p>
      </div>

      {/* Stolen Cipher instrument: mono ribbon columns Comp%/pts across the grid */}
      <div className="td-gw-crucible-r2__ribbon" onClick={onSelect}>
        <span className="td-gw-crucible-r2__loc">
          {tierLabel}
          {rid ? ` · ${regionLabel}` : ""}
        </span>
        <span className="td-gw-crucible-r2__figures">
          {showComp ? (
            <span className="td-gw-crucible-r2__comp">
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
          <span className="td-gw-crucible-r2__pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
            <span className="unit">pts</span>
          </span>
        </span>
      </div>

      {/* Open-hint only — no region restatement (ribbon already carries it) */}
      <div className="td-gw-crucible-r2__cue" aria-hidden>
        {on ? "Open" : "Details"}
      </div>

      {on ? (
        <div className="td-gw-crucible-r2__detail">
          <div className="td-gw-crucible-r2__detail-head">
            <p className={`td-gw-crucible-r2__detail-name${done ? " is-done" : ""}`}>
              {record.name}
              {done ? " · done" : ""}
            </p>
            <button type="button" className="td-gw-crucible-r2__close" onClick={onClose}>
              Close
            </button>
          </div>
          {record.description ? (
            <p className="td-gw-crucible-r2__detail-body">{record.description}</p>
          ) : null}
          {record.requirements ? (
            <p className="td-gw-crucible-r2__detail-req">Requires: {record.requirements}</p>
          ) : null}
          {wikiHref ? (
            <a
              href={wikiHref}
              target="_blank"
              rel="noreferrer"
              className="td-gw-crucible-r2__wiki"
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
