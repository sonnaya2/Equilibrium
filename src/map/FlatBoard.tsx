"use client";

/**
 * The 2D board: the same REGION_SHAPES rings rendered as SVG polygons, with
 * the same crests, lock states and quest counts as the 3D table. It is the
 * loading skeleton, the no-WebGPU state, and the sub-760px board — a real
 * planner surface, not an apology. It stays three-free so it can render
 * anywhere; pick interaction runs through the shared build store.
 *
 * The whole board is aria-hidden on purpose: nothing in it may carry a
 * region's accessible name, or it double-matches the DOM ledger's buttons
 * (wartable plan, risk 5). Keyboard parity lives in the ledger.
 */

import { useState } from "react";
import {
  canSelectElective,
  ELECTIVE_REGIONS,
  isRegionUnlocked,
  type RegionId,
} from "@/league";
import { useBuild } from "@/league/useBuild";
import { REGION_SHAPES } from "./data/regionShapes";
import { smoothRing } from "./data/regionCurve";
import { REGION_METRICS_BY_ID } from "./data/regionMetrics";
import { MAP_WORLD, REGION_ANCHOR_BY_ID } from "./data/regionAnchors";
import { useMapFocus } from "./useMapFocus";

const VB_W = 1000;
const VB_H = (1000 * MAP_WORLD.height) / MAP_WORLD.width;
const X = (u: number) => u * VB_W;
const Y = (v: number) => v * VB_H;

export function FlatBoard() {
  const { build, toggleRegion } = useBuild();
  const { focusRegion } = useMapFocus();
  const [hovered, setHovered] = useState<RegionId | null>(null);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      // Fills board-sky__canvas-host (absolute inset) like the WebGPU canvas.
      // h-auto grew the flex chain and could crush the under-board ledger.
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      role="presentation"
    >
      {REGION_SHAPES.map((shape) => {
        const id = shape.id;
        const unlocked = isRegionUnlocked(build, id);
        const elective = (ELECTIVE_REGIONS as readonly RegionId[]).includes(id);
        const selectable = elective && canSelectElective(build, id);
        const isHover = hovered === id;
        const points = smoothRing(shape)
          .map(([u, v]) => `${X(u).toFixed(1)},${Y(v).toFixed(1)}`)
          .join(" ");
        const name = REGION_ANCHOR_BY_ID.get(id)?.name ?? id;
        return (
          <g
            key={id}
            onPointerEnter={() => setHovered(id)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => {
              focusRegion(id);
              if (selectable) toggleRegion(id);
            }}
            style={{
              cursor: selectable || !elective ? "pointer" : "not-allowed",
            }}
          >
            <title>{`${name}: ${unlocked ? "unlocked" : "locked"} · ${REGION_METRICS_BY_ID.get(id)?.quests ?? 0} quests touching`}</title>
            <polygon
              points={points}
              fill={unlocked ? "var(--color-stone-800)" : "var(--color-stone-900)"}
              stroke={
                isHover
                  ? "var(--color-gem-300)"
                  : unlocked
                    ? "var(--color-gem-600)"
                    : "var(--color-stone-750)"
              }
              strokeWidth={isHover ? 3 : 2}
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* Crests and counts in a second pass, over every polygon. SVG has no
          depth: drawn inside their own group, a later region's fill covers an
          earlier one's label wherever two rings sit close. */}
      {REGION_SHAPES.map((shape) => {
        const unlocked = isRegionUnlocked(build, shape.id);
        const [mu, mv] = shape.markerUv;
        return (
          <g key={`${shape.id}-mark`} pointerEvents="none">
            <image
              href={`/game/regions/${shape.id}.png`}
              x={X(mu) - 26}
              y={Y(mv) - 42}
              width={52}
              height={60}
              opacity={unlocked ? 1 : 0.35}
              preserveAspectRatio="xMidYMid meet"
            />
            <text
              x={X(mu)}
              y={Y(mv) + 34}
              textAnchor="middle"
              fontSize={24}
              fill="var(--color-parch-50)"
              fontFamily="var(--font-mono)"
              opacity={unlocked ? 1 : 0.45}
            >
              {REGION_METRICS_BY_ID.get(shape.id)?.quests ?? 0}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
