"use client";

/**
 * Concept: pick your three regions on the real world map.
 *
 * The war table at /map is original geometry on purpose — this is the opposite
 * bet, and the point of putting it in the lab is to see them side by side. It
 * reads and writes the same build store, so picks made here show up everywhere.
 *
 * Pan and zoom are a CSS transform on one wrapper, not a mapping library. There
 * are no tiles to schedule (the RS3 tile server the wiki's own map uses is not
 * public), so a library would be ~40kB to move one <img> around.
 */

import { useCallback, useRef, useState } from "react";
import {
  canSelectElective,
  ELECTIVE_CAP,
  isRegionUnlocked,
  MILESTONE_REGION,
  STARTING_REGIONS,
  type RegionId,
} from "@/league";
import { useBuild } from "@/league/useBuild";
import { ATLAS_CREDIT, ATLAS_IMAGE, ATLAS_REGIONS } from "./atlasRegions";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function statusOf(id: RegionId, unlocked: boolean, selectable: boolean): string {
  if ((STARTING_REGIONS as readonly RegionId[]).includes(id)) return "start";
  if (id === MILESTONE_REGION) return "first milestone";
  if (unlocked) return "picked";
  return selectable ? "available" : "no picks left";
}

export function AtlasMap() {
  const { build, loaded, toggleRegion, clearElectives } = useBuild();
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const moved = useRef(false);

  /** Keep the board inside the frame at every zoom, so it cannot be lost. */
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const el = frame.current;
    if (!el) return { x, y };
    const limitX = (el.clientWidth * (scale - 1)) / 2;
    const limitY = (el.clientHeight * (scale - 1)) / 2;
    return { x: clamp(x, -limitX, limitX), y: clamp(y, -limitY, limitY) };
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    const el = frame.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Zoom toward the pointer rather than the centre, or zooming in on a corner
    // walks the thing you were looking at off the edge.
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    setView((v) => {
      const scale = clamp(v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_SCALE, MAX_SCALE);
      const k = scale / v.scale;
      return { scale, ...clampPan(px - (px - v.x) * k, py - (py - v.y) * k, scale) };
    });
  };

  // Deliberately no setPointerCapture. Capturing on the frame retargets the
  // pointerup to the frame, so the click event resolves against the frame
  // instead of the marker under the cursor and every pick silently no-ops.
  // Losing the drag when the pointer exits is the cheaper trade.
  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = false;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setView((v) => ({ ...v, ...clampPan(d.vx + dx, d.vy + dy, v.scale) }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const picks = build.elective.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="num text-2xl leading-none text-parch-50">
          {loaded ? `${picks}/${ELECTIVE_CAP}` : `…/${ELECTIVE_CAP}`}
        </span>
        <span className="text-xs text-parch-300">
          Scroll to zoom, drag to pan. Click a region to pick it.
        </span>
        <button
          type="button"
          disabled={!loaded || picks === 0}
          onClick={clearElectives}
          className="ml-auto text-xs text-parch-100 transition-colors duration-150 hover:text-parch-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear picks
        </button>
        <button
          type="button"
          onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          className="text-xs text-parch-100 transition-colors duration-150 hover:text-parch-50"
        >
          Reset view
        </button>
      </div>

      <div
        ref={frame}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        className="panel relative touch-none overflow-hidden"
        style={{ aspectRatio: String(ATLAS_IMAGE.aspect), cursor: drag.current ? "grabbing" : "grab" }}
      >
        <div
          className="absolute inset-0 origin-center"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: drag.current ? "none" : "transform 120ms ease-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ATLAS_IMAGE.large}
            srcSet={`${ATLAS_IMAGE.small} 1600w, ${ATLAS_IMAGE.large} 3200w`}
            sizes="100vw"
            alt="RuneScape world map"
            draggable={false}
            className="h-full w-full select-none object-cover"
          />

          {ATLAS_REGIONS.map((region) => {
            const unlocked = isRegionUnlocked(build, region.id);
            const selectable = loaded && canSelectElective(build, region.id);
            const fixed =
              (STARTING_REGIONS as readonly RegionId[]).includes(region.id) ||
              region.id === MILESTONE_REGION;
            return (
              <button
                key={region.id}
                type="button"
                aria-pressed={unlocked}
                aria-disabled={(!fixed && !unlocked && !selectable) || undefined}
                onClick={() => {
                  // A drag that ends over a marker is a pan, not a pick.
                  if (moved.current || fixed || !loaded) return;
                  if (unlocked || selectable) toggleRegion(region.id);
                }}
                style={{
                  left: `${region.uv[0] * 100}%`,
                  top: `${region.uv[1] * 100}%`,
                  // Counter-scale so labels stay legible as the map zooms.
                  transform: `translate(-50%, -50%) scale(${1 / view.scale})`,
                }}
                className="absolute flex flex-col items-center gap-1"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M8 1 14 4.5v7L8 15 2 11.5v-7z"
                    fill={unlocked ? "var(--color-gem-500)" : "rgb(13 10 7 / 70%)"}
                    stroke={unlocked ? "var(--color-gem-300)" : "var(--color-stone-750)"}
                    strokeWidth="1.5"
                  />
                </svg>
                <span className="map-chip">
                  <span className="map-chip-name">{region.name}</span>
                  <span className="map-chip-state">
                    {statusOf(region.id, unlocked, selectable)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-parch-500">
        <a
          href={ATLAS_CREDIT.href}
          target="_blank"
          rel="noreferrer"
          className="hover:text-parch-300"
        >
          {ATLAS_CREDIT.text}
        </a>
        {" · "}
        <a
          href={ATLAS_CREDIT.licence}
          target="_blank"
          rel="noreferrer"
          className="hover:text-parch-300"
        >
          licence
        </a>
      </p>
    </div>
  );
}
