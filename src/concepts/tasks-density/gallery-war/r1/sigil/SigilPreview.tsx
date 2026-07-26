"use client";

/**
 * Sigil Focus — Gallery War R1
 * Gallery grid; expand = full-width focus band under the selected card's row.
 * Checkbox completes only (≠ expand). Editorial tokens. useTasksDesk.
 */

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import { isTaskTier, type TaskRecord, type TaskRegionId } from "@/tasks";
import type { TasksDensityPreviewProps } from "../../../TasksDensityTeamMount";
import { formatCompRate, useTasksDesk, wikiTaskUrl } from "../../../useTasksDesk";
import "./sigil.css";

const TILE_CAP = 120;
/** Must match --sg-min-card (17rem) and --sg-gap (0.5rem) in sigil.css */
const MIN_CARD_PX = 17 * 16;
const GAP_PX = 0.5 * 16;

function useGridColumns(el: HTMLElement | null): number {
  const [cols, setCols] = useState(1);

  useEffect(() => {
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const next = Math.max(1, Math.floor((w + GAP_PX) / (MIN_CARD_PX + GAP_PX)));
      setCols((prev) => (prev === next ? prev : next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return cols;
}

export function SigilPreview({
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

  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const cols = useGridColumns(gridEl);

  const showComp = useMemo(
    () => records.some((r) => typeof r.catalystCompletionRate === "number"),
    [records],
  );

  const tiles = useMemo(() => visible.slice(0, TILE_CAP), [visible]);

  /** Explicit selection only — ignore desk first-row fallback. */
  const active = useMemo(() => {
    if (selectedId === null) return null;
    return tiles.find((r) => taskId(r) === selectedId) ?? null;
  }, [selectedId, tiles, taskId]);

  const selectedIndex = useMemo(() => {
    if (!active) return -1;
    return tiles.findIndex((r) => taskId(r) === selectedId);
  }, [active, tiles, taskId, selectedId]);

  const selectedRow = selectedIndex >= 0 ? Math.floor(selectedIndex / cols) : -1;
  const selectedCol = selectedIndex >= 0 ? selectedIndex % cols : 0;
  const bandAfterIndex =
    selectedRow >= 0 ? Math.min((selectedRow + 1) * cols - 1, tiles.length - 1) : -1;

  useEffect(() => {
    if (!active || !bandRef.current) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bandRef.current.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [active, selectedId, bandAfterIndex]);

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

  const selectCrest =
    region !== "all" && isLeagueRegionId(region) ? region : null;

  const gridStyle = {
    "--sg-cols": String(cols),
    "--sg-col": String(selectedCol),
  } as CSSProperties;

  const boardNodes: ReactNode[] = [];
  for (let index = 0; index < tiles.length; index++) {
    const record = tiles[index]!;
    boardNodes.push(
      <Tile
        key={`${taskId(record)}-${index}`}
        record={record}
        index={index}
        done={completed.has(taskId(record))}
        on={selectedId === taskId(record)}
        showComp={showComp}
        tasksWikiUrl={tasksWikiUrl}
        tierConfidence={tierConfidence}
        taskId={taskId}
        taskPoints={taskPoints}
        isLeagueRegionId={isLeagueRegionId}
        regionDisplayName={regionDisplayName}
        onToggle={onToggle}
        onSelect={toggleSelect}
      />,
    );

    if (index === bandAfterIndex && active) {
      boardNodes.push(
        <FocusBand
          key={`band-${taskId(active)}`}
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
        />,
      );
    }
  }

  return (
    <div className="td-gw-sigil">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <div className="td-gw-sigil__shell">
        <div className="td-gw-sigil__bar">
          <h3 className="td-gw-sigil__title">Sigil Focus</h3>
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
            {visible.length > tiles.length ? ` · showing ${tiles.length}` : null}
          </span>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            className="td-gw-sigil__search"
          />

          <button
            type="button"
            className={`td-gw-sigil__chip${buildOnly ? " is-on" : ""}`}
            aria-pressed={buildOnly}
            title={buildOnly ? `Unlocked: ${unlockLabel}` : "Show every region"}
            onClick={() => setBuildOnly((v) => !v)}
          >
            My build
          </button>

          {regionRail.length > 0 ? (
            <label className="td-gw-sigil__region-wrap">
              {selectCrest ? <RegionCrest regionId={selectCrest} size={18} /> : null}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
                aria-label="Filter by region"
                className="td-gw-sigil__select"
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

        {buildOnly && build.elective.length === 0 ? (
          <p className="td-gw-sigil__hint">
            Starters only — electives on <Link href="/build">Build</Link>
          </p>
        ) : null}

        {tiles.length === 0 ? (
          <p className="td-gw-sigil__empty">No tasks match.</p>
        ) : (
          <div className="td-gw-sigil__board">
            <div ref={setGridEl} className="td-gw-sigil__grid" style={gridStyle}>
              {boardNodes}
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
  const domId = `sigil-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${index}`;

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
        <div
          className={`td-gw-sigil__crest${rid === "global" || !rid ? " is-global" : ""}`}
        >
          {rid && isLeagueRegionId(rid) ? (
            <RegionCrest regionId={rid} size={32} />
          ) : (
            "G"
          )}
        </div>

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

        <div className="td-gw-sigil__tile-copy">
          <p className="td-gw-sigil__tile-name">{record.name}</p>
          <p className="td-gw-sigil__tile-meta">
            {isTaskTier(record.tier) ? record.tier : record.tier}
            {rid ? ` · ${regionLabel}` : ""}
          </p>
        </div>

        <div className="td-gw-sigil__tile-stats">
          <span className="td-gw-sigil__tile-pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
            <span> pts</span>
          </span>
          {showComp ? (
            <span className="td-gw-sigil__tile-comp">
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
        </div>
      </div>

      <div className="td-gw-sigil__tile-foot">
        <span className="td-gw-sigil__tile-region">{regionLabel}</span>
        <span className="td-gw-sigil__tile-cue">{on ? "Open" : "Focus"}</span>
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
            <RegionCrest regionId={rid} size={36} />
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
