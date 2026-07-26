"use client";

/**
 * Quill Index — Gallery War R2
 * Keep thin track (chrome height). Densify board. Full-set row virt. Kill foot region.
 * Track split: fixed filter cluster + scrolling crest rail (discoverability).
 */

import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRecord, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./quill.css";

const CREST = 22;
const TRACK_CREST = 20;
/** Denser than R1 16.5rem — still readable names (steal Grove pressure, not Bastion void). */
const MIN_CARD_PX = 210;
const GAP_PX = 6;
/** Collapsed row estimate: compact tile + gap. */
const ROW_EST_PX = 108;
const ROW_EXPAND_EXTRA_PX = 112;

export function QuillPreview({
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
    isUnlocked,
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
      <div className="td-gw-quill">
        <p className="td-gw-quill__empty">No tasks loaded.</p>
      </div>
    );
  }

  const startersOnly = buildOnly && build.elective.length === 0;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const mountedTiles = virtualRows.reduce((n, row) => {
    const start = row.index * cols;
    return n + Math.min(cols, visible.length - start);
  }, 0);

  return (
    <div className="td-gw-quill">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-gw-quill__shell">
        {/* Thin track: fixed controls never hide; crests scroll in nested rail */}
        <div className="td-gw-quill__track" role="toolbar" aria-label="Task filters">
          <div className="td-gw-quill__cluster">
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
          </div>

          {regionRail.length > 0 ? (
            <>
              <span className="td-gw-quill__rule" aria-hidden />
              <div
                role="group"
                aria-label="Filter by region"
                className="td-gw-quill__regions"
              >
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
                  <span className="td-gw-quill__crest-n">
                    {regionCounts.get("all") ?? 0}
                  </span>
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
            </>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <p className="td-gw-quill__empty">No tasks match.</p>
        ) : (
          <div ref={listRef} className="td-gw-quill__board">
            <div
              className="td-gw-quill__virt"
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
                    className="td-gw-quill__row"
                    style={
                      {
                        transform: `translateY(${vRow.start}px)`,
                        ["--q-cols" as string]: String(cols),
                      } as CSSProperties
                    }
                  >
                    {slice.map((record) => {
                      const id = taskId(record);
                      return (
                        <QuillTile
                          key={id}
                          id={id}
                          record={record}
                          done={completed.has(id)}
                          on={selectedId === id}
                          points={taskPoints(record)}
                          provisional={
                            tierConfidence[record.tier]?.startsWith("provisional") ??
                            false
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

function QuillTile({
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
  const domId = `quill-r2-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
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
      className={`td-gw-quill__tile${on ? " is-on" : ""}${done ? " is-done" : ""}`}
    >
      <div
        className="td-gw-quill__tile-top"
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
        <div
          className={`td-gw-quill__medallion${
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
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />

        <p className="td-gw-quill__tile-name">{record.name}</p>
      </div>

      {/* Cipher-grade mono ribbon: tier·region left, Comp%/pts right — no foot restatement */}
      <div className="td-gw-quill__ribbon" onClick={onSelect}>
        <span className="td-gw-quill__loc">
          {tierLabel}
          {rid ? ` · ${regionLabel}` : ""}
        </span>
        <span className="td-gw-quill__figures">
          {showComp ? (
            <span className="td-gw-quill__comp">
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
          <span className="td-gw-quill__pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
            <span className="unit">pts</span>
          </span>
        </span>
      </div>

      {/* Ash foot discipline: cue only — region already on ribbon */}
      <div className="td-gw-quill__tile-foot">
        <span className="td-gw-quill__tile-cue">{on ? "Open" : "Details"}</span>
      </div>

      {on ? (
        <div className="td-gw-quill__detail">
          <div className="td-gw-quill__detail-head">
            <p className={`td-gw-quill__detail-name${done ? " is-done" : ""}`}>
              {record.name}
              {done ? " · done" : ""}
            </p>
            <button type="button" className="td-gw-quill__close" onClick={onClose}>
              Close
            </button>
          </div>
          {record.description ? (
            <p className="td-gw-quill__detail-body">{record.description}</p>
          ) : null}
          {record.requirements ? (
            <p className="td-gw-quill__detail-req">Requires: {record.requirements}</p>
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
}
