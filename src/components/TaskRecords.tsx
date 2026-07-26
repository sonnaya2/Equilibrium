"use client";

/**
 * Tasks — Cipher Gallery Board (hover-dock revision).
 * Crest / world-map identity · pts + Comp% stack · gem outline when done.
 * Hover (or keyboard focus) opens detail dock at TOP of board.
 * Left-click toggles complete — expand ≠ complete (dock is hover-only).
 * Row-virtualized board (full filtered set; no 120 cap).
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
import {
  formatCompRate,
  useTasksDesk,
  wikiTaskUrl,
} from "@/concepts/tasks-density/useTasksDesk";
import { worldMapIconPath } from "@/lib/gameArt";
import { isTaskTier, type TaskRecord, type TaskRegionId } from "@/tasks";
import { CATALYST_TASKS_URL } from "@/tasks/regionMap";

const CREST = 44;
const TRACK_CREST = 22;
const WORLD_ICON = worldMapIconPath();
/** ~14rem — crest + name face with room for the stats stack. */
const MIN_CARD_PX = 14 * 16;
const GAP_PX = 0.4 * 16;
/** Closed premium card height estimate (measureElement corrects live). */
const ROW_EST_PX = 128;
/** Clear hover only after leaving tile+dock (lets pointer travel to dock). */
const HOVER_CLEAR_MS = 140;

function WorldIcon({ size }: { size: number }) {
  return (
    <span
      aria-hidden
      className="tasks-gallery__world"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${WORLD_ICON})`,
      }}
    />
  );
}

export function TaskRecords({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl = CATALYST_TASKS_URL,
  completionLive = false,
}: {
  records: unknown[];
  tiers: Record<string, number>;
  tierConfidence: Record<string, string>;
  tasksWikiUrl?: string;
  completionLive?: boolean;
}) {
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

  const dockRef = useRef<HTMLDivElement>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cols, setCols] = useState(3);
  /** Hover / keyboard focus id for the top detail dock (not click-select). */
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  // Filters / list change: drop hover and any legacy selectedId.
  useEffect(() => {
    setHoverId(null);
    setSelectedId(null);
  }, [tier, region, query, buildOnly, setSelectedId]);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const rowCount = visible.length === 0 ? 0 : Math.ceil(visible.length / cols);

  const hoverIndex = useMemo(() => {
    if (hoverId === null) return -1;
    return visible.findIndex((r) => taskId(r) === hoverId);
  }, [hoverId, visible, taskId]);

  const hoverCol = hoverIndex >= 0 ? hoverIndex % cols : 0;

  const active = useMemo(() => {
    if (hoverId === null || hoverIndex < 0) return null;
    return visible[hoverIndex] ?? null;
  }, [hoverId, hoverIndex, visible]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_EST_PX,
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
  }, [cols, visible.length]);

  const cancelClear = useCallback(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  const scheduleClear = useCallback(() => {
    cancelClear();
    clearTimer.current = setTimeout(() => {
      setHoverId(null);
      clearTimer.current = null;
    }, HOVER_CLEAR_MS);
  }, [cancelClear]);

  const openHover = useCallback(
    (id: string) => {
      cancelClear();
      setHoverId(id);
    },
    [cancelClear],
  );

  if (records.length === 0) return null;

  const startersOnly = buildOnly && build.elective.length === 0;
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="tasks-gallery">
      {crestRegionIds.length > 0 ? (
        <RegionCrestPreload regionIds={crestRegionIds} />
      ) : null}

      <div className="tasks-gallery__shell">
        <div className="tasks-gallery__track" role="toolbar" aria-label="Task filters">
          <div className="tasks-gallery__cluster">
            <h3 className="tasks-gallery__title">Tasks</h3>
            <span className="tasks-gallery__count">
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
            </span>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter"
              aria-label="Filter tasks"
              className="tasks-gallery__search"
            />

            <button
              type="button"
              className={`tasks-gallery__chip${buildOnly ? " is-on" : ""}`}
              aria-pressed={buildOnly}
              title={buildOnly ? `Unlocked: ${unlockLabel}` : "Show every region"}
              onClick={() => setBuildOnly((v) => !v)}
            >
              My build
            </button>

            {startersOnly ? (
              <span className="tasks-gallery__note">
                Starters · <Link href="/build">Build</Link>
              </span>
            ) : null}

            <div role="group" aria-label="Filter by tier" className="tasks-gallery__tiers">
              {(["all", ...tiersInUse] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`tasks-gallery__chip tasks-gallery__chip--tier${
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
              <span className="tasks-gallery__rule" aria-hidden />
              <div
                role="group"
                aria-label="Filter by region"
                className="tasks-gallery__regions"
              >
                <button
                  type="button"
                  className={`tasks-gallery__crest-btn${region === "all" ? " is-on" : ""}`}
                  aria-pressed={region === "all"}
                  title={buildOnly ? "All unlocked" : "All regions"}
                  aria-label={
                    buildOnly
                      ? `All unlocked, ${regionCounts.get("all") ?? 0} tasks`
                      : `All regions, ${regionCounts.get("all") ?? 0} tasks`
                  }
                  onClick={() => setRegion("all")}
                >
                  <span className="tasks-gallery__crest-glyph" aria-hidden>
                    Σ
                  </span>
                  <span className="tasks-gallery__crest-n">
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
                      className={`tasks-gallery__crest-btn${
                        region === id ? " is-on" : ""
                      }${locked ? " is-locked" : ""}`}
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
                        <WorldIcon size={TRACK_CREST} />
                      )}
                      <span className="tasks-gallery__crest-n">{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        {active ? (
          <FocusDock
            dockRef={dockRef}
            record={active}
            done={completed.has(taskId(active))}
            showComp={showComp}
            tasksWikiUrl={tasksWikiUrl}
            tierConfidence={tierConfidence}
            taskPoints={taskPoints}
            isLeagueRegionId={isLeagueRegionId}
            regionDisplayName={regionDisplayName}
            onClose={() => setHoverId(null)}
            onPointerEnter={cancelClear}
            onPointerLeave={scheduleClear}
          />
        ) : null}

        {visible.length === 0 ? (
          <p className="tasks-gallery__empty">No tasks match.</p>
        ) : (
          <div
            ref={listRef}
            className="tasks-gallery__board"
            aria-label="Tasks"
            style={
              {
                ["--tg-cols" as string]: String(cols),
                ["--tg-col" as string]: String(hoverCol),
              } as CSSProperties
            }
          >
            <div
              className="tasks-gallery__virt"
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
                    className="tasks-gallery__row"
                    style={{ transform: `translateY(${vRow.start}px)` }}
                  >
                    <div className="tasks-gallery__tiles">
                      {slice.map((record) => {
                        const id = taskId(record);
                        return (
                          <GalleryTile
                            key={id}
                            id={id}
                            record={record}
                            done={completed.has(id)}
                            on={hoverId === id}
                            points={taskPoints(record)}
                            provisional={
                              tierConfidence[record.tier]?.startsWith("provisional") ??
                              false
                            }
                            showComp={showComp}
                            onToggle={() => onToggle(id)}
                            onHover={() => openHover(id)}
                            onLeave={scheduleClear}
                            isLeagueRegionId={isLeagueRegionId}
                          />
                        );
                      })}
                    </div>
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

function GalleryTile({
  record,
  done,
  on,
  points,
  provisional,
  showComp,
  onToggle,
  onHover,
  onLeave,
  isLeagueRegionId,
}: {
  id: string;
  record: TaskRecord;
  done: boolean;
  on: boolean;
  points: number | null;
  provisional: boolean;
  showComp: boolean;
  onToggle: () => void;
  onHover: () => void;
  onLeave: () => void;
  isLeagueRegionId: (id: string) => boolean;
}) {
  const rid = record.regionId;
  const rate =
    typeof record.catalystCompletionRate === "number"
      ? record.catalystCompletionRate
      : null;
  return (
    <article
      className={`tasks-gallery__tile${on ? " is-on" : ""}${done ? " is-done" : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onPointerDown={(e) => {
        // Touch has no hover — open dock on press; click still completes.
        if (e.pointerType === "touch" || e.pointerType === "pen") onHover();
      }}
      onFocus={onHover}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onLeave();
      }}
    >
      <button
        type="button"
        className="tasks-gallery__face"
        aria-pressed={done}
        aria-label={
          done
            ? `Mark incomplete: ${record.name}`
            : `Mark complete: ${record.name}`
        }
        onClick={onToggle}
      >
        <span
          className={`tasks-gallery__mark${done ? " is-done" : ""}`}
          aria-hidden
        >
          <span
            className={`tasks-gallery__crest${
              rid === "global" || !rid ? " is-global" : ""
            }`}
          >
            {rid && isLeagueRegionId(rid) ? (
              <RegionCrest regionId={rid} size={CREST} />
            ) : (
              <WorldIcon size={CREST} />
            )}
          </span>
        </span>

        <span className="tasks-gallery__body">
          <span className="tasks-gallery__name">{record.name}</span>

          <span className="tasks-gallery__stats">
            <span className="tasks-gallery__pts">
              {points !== null ? `${points}${provisional ? "*" : ""}` : "—"}
              <span className="unit">pts</span>
            </span>
            {showComp ? (
              <span className="tasks-gallery__comp">
                {rate !== null
                  ? formatCompRate(rate, record.catalystCompletionRateQualifier)
                  : "—"}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </article>
  );
}

function FocusDock({
  dockRef,
  record,
  done,
  showComp,
  tasksWikiUrl,
  tierConfidence,
  taskPoints,
  isLeagueRegionId,
  regionDisplayName,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: {
  dockRef: RefObject<HTMLDivElement | null>;
  record: TaskRecord;
  done: boolean;
  showComp: boolean;
  tasksWikiUrl: string;
  tierConfidence: Record<string, string>;
  taskPoints: (r: TaskRecord) => number | null;
  isLeagueRegionId: (id: string) => boolean;
  regionDisplayName: (id: TaskRegionId) => string;
  onClose: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
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
      ref={dockRef}
      id="tasks-gallery-focus-band"
      className="tasks-gallery__dock"
      aria-label={`Details: ${record.name}`}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div className="tasks-gallery__dock-head">
        <div className="tasks-gallery__dock-id">
          {rid && isLeagueRegionId(rid) ? (
            <RegionCrest regionId={rid} size={36} />
          ) : (
            <WorldIcon size={36} />
          )}
          <div>
            <p className={`tasks-gallery__dock-name${done ? " is-done" : ""}`}>
              {record.name}
              {done ? " · done" : ""}
            </p>
            <p className="tasks-gallery__dock-meta">
              {isTaskTier(record.tier) ? record.tier : record.tier}
              {rid ? ` · ${regionLabel}` : ""}
              <span className="tasks-gallery__dock-hint"> · hover · click marks done</span>
            </p>
          </div>
        </div>

        <div className="tasks-gallery__dock-facts">
          {showComp ? (
            <span className="tasks-gallery__dock-comp">
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

        <button type="button" className="tasks-gallery__close" onClick={onClose}>
          Close
        </button>
      </div>

      {record.description ? (
        <p className="tasks-gallery__dock-body">{record.description}</p>
      ) : null}
      {record.requirements ? (
        <p className="tasks-gallery__dock-req">
          <strong>Requires:</strong> {record.requirements}
        </p>
      ) : null}
      {!hasBody ? (
        <p className="tasks-gallery__dock-empty">No detail text on this task.</p>
      ) : null}
      {wikiHref ? (
        <a
          href={wikiHref}
          target="_blank"
          rel="noreferrer"
          className="tasks-gallery__wiki"
          aria-label={`Wiki Comp% for ${record.name}`}
        >
          Wiki
        </a>
      ) : null}
    </section>
  );
}
