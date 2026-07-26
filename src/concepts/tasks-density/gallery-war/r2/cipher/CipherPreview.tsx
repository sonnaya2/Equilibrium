"use client";

/**
 * Cipher Strip R2 — scan ribbon + full-set virt + row focus band.
 * Steals Crucible reach, Sigil detail width, Grove column pressure.
 * Keeps mono Comp%/pts ribbon; foot is cue-only (no region restatement).
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
import "./cipher.css";

const CREST = 20;
/** Matches --cf-min-card (12.75rem) + denser Grove pressure without name crush. */
const MIN_CARD_PX = 12.75 * 16;
const GAP_PX = 0.35 * 16;
/** Closed tile row: head + ribbon + cue + gap. */
const ROW_EST_PX = 118;
/** Focus band under selected row (Sigil structure, measured live). */
const ROW_BAND_EXTRA_PX = 168;

export function CipherPreview({
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

  const bandRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  const showComp = useMemo(
    () => records.some((r) => typeof r.catalystCompletionRate === "number"),
    [records],
  );

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const measure = () => {
      const style = getComputedStyle(el);
      const pad =
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
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

  const selectedIndex = useMemo(() => {
    if (selectedId === null) return -1;
    return visible.findIndex((r) => taskId(r) === selectedId);
  }, [selectedId, visible, taskId]);

  const selectedRow = selectedIndex >= 0 ? Math.floor(selectedIndex / cols) : -1;
  const selectedCol = selectedIndex >= 0 ? selectedIndex % cols : 0;

  const active = useMemo(() => {
    if (selectedId === null || selectedIndex < 0) return null;
    return visible[selectedIndex] ?? null;
  }, [selectedId, selectedIndex, visible]);

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
      if (index === selectedRow && selectedId) key += `:on:${selectedId}`;
      return key;
    },
  });

  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedRow, cols, visible.length]);

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
      <div className="td-gw-cipher">
        <p className="td-gw-cipher__empty">No tasks loaded.</p>
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
    <div className="td-gw-cipher">
      {crestRegionIds.length > 0 ? (
        <RegionCrestPreload regionIds={crestRegionIds} />
      ) : null}

      <div className="td-gw-cipher__shell">
        <div className="td-gw-cipher__bar">
          <h3 className="td-gw-cipher__title">Cipher</h3>
          <span className="td-gw-cipher__count">
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
            className="td-gw-cipher__search"
          />

          <button
            type="button"
            className={`td-gw-cipher__chip${buildOnly ? " is-on" : ""}`}
            aria-pressed={buildOnly}
            title={buildOnly ? `Unlocked: ${unlockLabel}` : "Show every region"}
            onClick={() => setBuildOnly((v) => !v)}
          >
            My build
          </button>

          {regionRail.length > 0 ? (
            <label className="td-gw-cipher__region-wrap">
              {selectCrest ? <RegionCrest regionId={selectCrest} size={18} /> : null}
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as TaskRegionId | "all")}
                aria-label="Filter by region"
                className="td-gw-cipher__select"
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

          <div role="group" aria-label="Filter by tier" className="td-gw-cipher__tiers">
            {(["all", ...tiersInUse] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`td-gw-cipher__chip td-gw-cipher__chip--tier${
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
          <p className="td-gw-cipher__hint">
            Starters only — electives on <Link href="/build">Build</Link>
          </p>
        ) : null}

        {visible.length === 0 ? (
          <p className="td-gw-cipher__empty">No tasks match.</p>
        ) : (
          <div ref={listRef} className="td-gw-cipher__board">
            <div
              className="td-gw-cipher__virt"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {virtualRows.map((vRow) => {
                const start = vRow.index * cols;
                const slice = visible.slice(start, start + cols);
                const rowHasBand = vRow.index === selectedRow && active;

                return (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={`td-gw-cipher__row${rowHasBand ? " has-band" : ""}`}
                    style={
                      {
                        transform: `translateY(${vRow.start}px)`,
                        ["--cf-cols" as string]: String(cols),
                        ["--cf-col" as string]: String(selectedCol),
                      } as CSSProperties
                    }
                  >
                    <div className="td-gw-cipher__tiles">
                      {slice.map((record) => {
                        const id = taskId(record);
                        return (
                          <CipherTile
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
                            onSelect={() => toggleSelect(id)}
                            isLeagueRegionId={isLeagueRegionId}
                            regionDisplayName={regionDisplayName}
                          />
                        );
                      })}
                    </div>

                    {rowHasBand && active ? (
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

function CipherTile({
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
  isLeagueRegionId: (id: string) => boolean;
  regionDisplayName: (id: TaskRegionId) => string;
}) {
  const domId = `cipher-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
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
      className={`td-gw-cipher__tile${on ? " is-on" : ""}${done ? " is-done" : ""}`}
    >
      <div
        className="td-gw-cipher__head"
        role="button"
        tabIndex={0}
        aria-expanded={on}
        aria-controls={on ? "cipher-focus-band" : undefined}
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
          className="td-gw-cipher__check"
          aria-label={
            done
              ? `Mark incomplete: ${record.name}`
              : `Mark complete: ${record.name}`
          }
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
        <div
          className={`td-gw-cipher__crest${
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
        <p className="td-gw-cipher__name">{record.name}</p>
      </div>

      {/* Signature: mono cipher ribbon — Comp% · pts scan line */}
      <div className="td-gw-cipher__ribbon" onClick={onSelect}>
        <span className="td-gw-cipher__loc">
          {tierLabel}
          {rid ? ` · ${regionLabel}` : ""}
        </span>
        <span className="td-gw-cipher__figures">
          {showComp ? (
            <span className="td-gw-cipher__comp">
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
          <span className="td-gw-cipher__pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
            <span className="unit">pts</span>
          </span>
        </span>
      </div>

      {/* Foot: open-hint only — region lives on the ribbon, never restated */}
      <div className="td-gw-cipher__cue" aria-hidden>
        {on ? "Open" : "Details"}
      </div>
    </article>
  );
}

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
}: {
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
}) {
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
      id="cipher-focus-band"
      className="td-gw-cipher__band"
      aria-label={`Details: ${record.name}`}
    >
      <div className="td-gw-cipher__band-mark" aria-hidden />

      <div className="td-gw-cipher__band-head">
        <div className="td-gw-cipher__band-id">
          {rid && isLeagueRegionId(rid) ? (
            <RegionCrest regionId={rid} size={32} />
          ) : null}
          <div>
            <p className={`td-gw-cipher__band-name${done ? " is-done" : ""}`}>
              {record.name}
              {done ? " · done" : ""}
            </p>
            <p className="td-gw-cipher__band-meta">
              {isTaskTier(record.tier) ? record.tier : record.tier}
              {rid ? ` · ${regionLabel}` : ""}
            </p>
          </div>
        </div>

        <div className="td-gw-cipher__band-facts">
          {showComp ? (
            <span className="td-gw-cipher__band-comp">
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
          <span className="is-pts">
            {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
            <span className="unit">pts</span>
          </span>
        </div>

        <button type="button" className="td-gw-cipher__close" onClick={onClose}>
          Close
        </button>
      </div>

      {record.description ? (
        <p className="td-gw-cipher__band-body">{record.description}</p>
      ) : null}
      {record.requirements ? (
        <p className="td-gw-cipher__band-req">
          <strong>Requires:</strong> {record.requirements}
        </p>
      ) : null}
      {!hasBody ? (
        <p className="td-gw-cipher__band-empty">No detail text on this task.</p>
      ) : null}
      {wikiHref ? (
        <a
          href={wikiHref}
          target="_blank"
          rel="noreferrer"
          className="td-gw-cipher__wiki"
          aria-label={`Wiki Comp% for ${record.name}`}
        >
          Open on Wiki
        </a>
      ) : null}
    </section>
  );
}
