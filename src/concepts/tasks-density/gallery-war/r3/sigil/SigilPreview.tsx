"use client";

/**
 * Sigil Focus — Gallery War R3 DEATH FINALS
 * Keep row-span focus band + column-aligned mark (signature).
 * Steal Quill thin track / shell height; Cipher ribbon; Grove closed density.
 * Full-set row virt. Kill foot cue void. Checkbox completes only.
 */

import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRecord, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./sigil.css";

const CREST = 20;
const TRACK_CREST = 18;
/** Grove/Cipher closed pressure — match Cipher 12.75, not R2 13.5 soft. */
const MIN_CARD_PX = 12.75 * 16;
const GAP_PX = 0.3 * 16;
/** Closed row: face + ribbon only (foot killed) + gap. */
const ROW_EST_PX = 96;
/** Focus band under open row — measureElement corrects live. */
const ROW_BAND_EXTRA_PX = 148;

function useGridColumns(
  listRef: RefObject<HTMLDivElement | null>,
  boardKey: number,
): number {
  const [cols, setCols] = useState(3);

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
  }, [listRef, boardKey]);

  return cols;
}

export function SigilPreview({
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

  const bandRef = useRef<HTMLDivElement>(null);
  const cols = useGridColumns(listRef, visible.length);

  const showComp = useMemo(
    () => records.some((r) => typeof r.catalystCompletionRate === "number"),
    [records],
  );

  /** Explicit selection only — ignore desk first-row fallback. */
  const active = useMemo(() => {
    if (selectedId === null) return null;
    return visible.find((r) => taskId(r) === selectedId) ?? null;
  }, [selectedId, visible, taskId]);

  const selectedIndex = useMemo(() => {
    if (!active || selectedId === null) return -1;
    return visible.findIndex((r) => taskId(r) === selectedId);
  }, [active, selectedId, visible, taskId]);

  const selectedRow = selectedIndex >= 0 ? Math.floor(selectedIndex / cols) : -1;
  const selectedCol = selectedIndex >= 0 ? selectedIndex % cols : 0;

  const rowCount = visible.length === 0 ? 0 : Math.ceil(visible.length / cols);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => listRef.current,
    estimateSize: (index) =>
      index === selectedRow ? ROW_EST_PX + ROW_BAND_EXTRA_PX : ROW_EST_PX,
    overscan: 5,
    getItemKey: (index) => {
      const start = index * cols;
      const end = Math.min(start + cols, visible.length);
      let key = `r${index}`;
      for (let i = start; i < end; i++) key += `:${taskId(visible[i]!)}`;
      if (index === selectedRow && selectedId) key += `:band:${selectedId}`;
      return key;
    },
  });

  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedRow, cols, visible.length]);

  useEffect(() => {
    if (selectedRow < 0) return;
    rowVirtualizer.scrollToIndex(selectedRow, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow, selectedId]);

  useEffect(() => {
    if (!active || !bandRef.current) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bandRef.current.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [active, selectedId, selectedRow]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedId((cur) => (cur === id ? null : id));
    },
    [setSelectedId],
  );

  if (records.length === 0) {
    return (
      <div className="td-gw-sigil">
        <p className="td-gw-sigil__empty">No tasks loaded.</p>
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
    <div className="td-gw-sigil">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-gw-sigil__shell">
        {/* Quill-grade thin track: fixed cluster never hides; crest rail scrolls */}
        <div className="td-gw-sigil__track" role="toolbar" aria-label="Task filters">
          <div className="td-gw-sigil__cluster">
            <h3 className="td-gw-sigil__title">Sigil</h3>
            <span className="td-gw-sigil__count">
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
              className="td-gw-sigil__search"
            />

            <button
              type="button"
              className={`td-gw-sigil__chip${buildOnly ? " is-on" : ""}`}
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
              <span className="td-gw-sigil__note">
                Starters · <Link href="/build">Build</Link>
              </span>
            ) : null}

            <div role="group" aria-label="Filter by tier" className="td-gw-sigil__tiers">
              {(["all", ...tiersInUse] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`td-gw-sigil__chip td-gw-sigil__chip--tier${
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

          {regionRail.length > 0 ? (
            <>
              <span className="td-gw-sigil__rule" aria-hidden />
              <div
                role="group"
                aria-label="Filter by region"
                className="td-gw-sigil__regions"
              >
                <button
                  type="button"
                  className={`td-gw-sigil__crest-btn${region === "all" ? " is-on" : ""}`}
                  aria-pressed={region === "all"}
                  title={buildOnly ? "All unlocked" : "All regions"}
                  aria-label={
                    buildOnly
                      ? `All unlocked, ${regionCounts.get("all") ?? 0} tasks`
                      : `All regions, ${regionCounts.get("all") ?? 0} tasks`
                  }
                  onClick={() => setRegion("all")}
                >
                  <span className="td-gw-sigil__crest-glyph" aria-hidden>
                    Σ
                  </span>
                  <span className="td-gw-sigil__crest-n">
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
                      className={`td-gw-sigil__crest-btn${region === id ? " is-on" : ""}${
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
                      <span className="td-gw-sigil__crest-glyph" aria-hidden>
                        {id === "global" || !isLeagueRegionId(id) ? (
                          "G"
                        ) : (
                          <RegionCrest regionId={id} size={TRACK_CREST} />
                        )}
                      </span>
                      <span className="td-gw-sigil__crest-n">{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <p className="td-gw-sigil__empty">No tasks match.</p>
        ) : (
          <div ref={listRef} className="td-gw-sigil__board">
            <div
              className="td-gw-sigil__virt"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {virtualRows.map((vRow) => {
                const start = vRow.index * cols;
                const slice = visible.slice(start, start + cols);
                const open = vRow.index === selectedRow && active;
                const colForBand = open ? selectedCol : 0;

                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={`td-gw-sigil__row${open ? " is-open" : ""}`}
                    style={
                      {
                        transform: `translateY(${vRow.start}px)`,
                        ["--sg-cols" as string]: String(cols),
                        ["--sg-col" as string]: String(colForBand),
                      } as CSSProperties
                    }
                  >
                    <div className="td-gw-sigil__row-tiles">
                      {slice.map((record, i) => {
                        const id = taskId(record);
                        return (
                          <Tile
                            key={id}
                            record={record}
                            index={start + i}
                            done={completed.has(id)}
                            on={selectedId === id}
                            showComp={showComp}
                            tasksWikiUrl={tasksWikiUrl}
                            tierConfidence={tierConfidence}
                            taskId={taskId}
                            taskPoints={taskPoints}
                            isLeagueRegionId={isLeagueRegionId}
                            regionDisplayName={regionDisplayName}
                            onToggle={onToggle}
                            onSelect={toggleSelect}
                          />
                        );
                      })}
                    </div>

                    {open && active ? (
                      <FocusBand
                        bandRef={bandRef}
                        record={active}
                        done={completed.has(taskId(active))}
                        showComp={showComp}
                        tasksWikiUrl={tasksWikiUrl}
                        tierConfidence={tierConfidence}
                        taskPoints={taskPoints}
                        isLeagueRegionId={isLeagueRegionId}
                        regionDisplayName={regionDisplayName}
                        onClose={() => setSelectedId(null)}
                      />
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

type TileProps = {
  record: TaskRecord;
  index: number;
  done: boolean;
  on: boolean;
  showComp: boolean;
  tasksWikiUrl: string;
  tierConfidence: Record<string, string>;
  taskId: (r: TaskRecord) => string;
  taskPoints: (r: TaskRecord) => number | null;
  isLeagueRegionId: (id: string) => boolean;
  regionDisplayName: (id: TaskRegionId) => string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

function Tile({
  record,
  index,
  done,
  on,
  showComp,
  tasksWikiUrl,
  tierConfidence,
  taskId,
  taskPoints,
  isLeagueRegionId,
  regionDisplayName,
  onToggle,
  onSelect,
}: TileProps) {
  const id = taskId(record);
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
  const tierLabel = isTaskTier(record.tier) ? record.tier : record.tier;
  const domId = `sigil-r3-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${index}`;

  return (
    <article
      className={`td-gw-sigil__tile${on ? " is-on" : ""}${done ? " is-done" : ""}`}
      data-task-id={id}
    >
      <div
        className="td-gw-sigil__tile-face"
        role="button"
        tabIndex={0}
        aria-expanded={on}
        aria-controls={on ? "sigil-focus-band" : undefined}
        onClick={() => onSelect(id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(id);
          }
        }}
      >
        <input
          type="checkbox"
          id={domId}
          checked={done}
          className="td-gw-sigil__check"
          aria-label={
            done ? `Mark incomplete: ${record.name}` : `Mark complete: ${record.name}`
          }
          onChange={() => onToggle(id)}
          onClick={(e) => e.stopPropagation()}
        />

        <div
          className={`td-gw-sigil__crest${rid === "global" || !rid ? " is-global" : ""}`}
          aria-hidden
        >
          {rid && isLeagueRegionId(rid) ? (
            <RegionCrest regionId={rid} size={CREST} />
          ) : (
            "G"
          )}
        </div>

        <p className="td-gw-sigil__tile-name">{record.name}</p>
      </div>

      {/* Cipher mono ribbon — sole scan instrument; no foot restatement */}
      <div
        className="td-gw-sigil__ribbon"
        onClick={() => onSelect(id)}
        role="presentation"
      >
        <span className="td-gw-sigil__loc">
          {tierLabel}
          {rid ? ` · ${regionLabel}` : ""}
        </span>
        <span className="td-gw-sigil__figures">
          {showComp ? (
            <span className="td-gw-sigil__comp">
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
          <span className="td-gw-sigil__pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
            <span className="unit">pts</span>
          </span>
        </span>
      </div>
    </article>
  );
}

type BandProps = {
  bandRef: RefObject<HTMLDivElement | null>;
  record: TaskRecord;
  done: boolean;
  showComp: boolean;
  tasksWikiUrl: string;
  tierConfidence: Record<string, string>;
  taskPoints: (r: TaskRecord) => number | null;
  isLeagueRegionId: (id: string) => boolean;
  regionDisplayName: (id: TaskRegionId) => string;
  onClose: () => void;
};

function FocusBand({
  bandRef,
  record,
  done,
  showComp,
  tasksWikiUrl,
  tierConfidence,
  taskPoints,
  isLeagueRegionId,
  regionDisplayName,
  onClose,
}: BandProps) {
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
  const hasBody = Boolean(record.description || record.requirements);

  return (
    <section
      ref={bandRef}
      id="sigil-focus-band"
      className="td-gw-sigil__band"
      aria-label={`Focus: ${record.name}`}
    >
      <div className="td-gw-sigil__band-mark" aria-hidden />

      <div className="td-gw-sigil__band-head">
        <div className="td-gw-sigil__band-id">
          {rid && isLeagueRegionId(rid) ? (
            <RegionCrest regionId={rid} size={28} />
          ) : null}
          <div>
            <p className={`td-gw-sigil__band-name${done ? " is-done" : ""}`}>
              {record.name}
              {done ? " · done" : ""}
            </p>
            <p className="td-gw-sigil__band-meta">
              {isTaskTier(record.tier) ? record.tier : record.tier}
              {rid ? ` · ${regionLabel}` : ""}
            </p>
          </div>
        </div>

        <div className="td-gw-sigil__band-facts">
          <span className="is-pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"} pts
          </span>
          {showComp ? (
            <span>
              Comp%{" "}
              {rate !== null ? (
                wikiHref ? (
                  <a
                    href={wikiHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Wiki Comp% for ${record.name}`}
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
        </div>

        <button type="button" className="td-gw-sigil__close" onClick={onClose}>
          Close
        </button>
      </div>

      {record.description ? (
        <p className="td-gw-sigil__band-body">{record.description}</p>
      ) : null}
      {record.requirements ? (
        <p className="td-gw-sigil__band-req">
          <strong>Requires:</strong> {record.requirements}
        </p>
      ) : null}
      {!hasBody ? (
        <p className="td-gw-sigil__band-empty">No detail text on this task.</p>
      ) : null}
      {wikiHref ? (
        <a
          href={wikiHref}
          target="_blank"
          rel="noreferrer"
          className="td-gw-sigil__wiki"
          aria-label={`Wiki Comp% for ${record.name}`}
        >
          Open on Wiki
        </a>
      ) : null}
    </section>
  );
}
