"use client";

/**
 * Guthixian growth around the board's edge, bound to the pick counter.
 *
 * Not decoration: its extent *is* the count. Zero picks, bare corners; three
 * picks, a closed frame. It is a peripheral read of "how much of my build have
 * I spent" that works while your eyes are on the board and not on the counter,
 * and that is the only reason it earns its pixels.
 *
 * It lives in the DOM rather than the scene on purpose. Vines at the viewport
 * edge have to track the camera, so in-scene they would end up screen-space
 * anyway; here they cost no draw calls, stay crisp at any DPR, render in the
 * WebGPU-less fallback from the same component, and — the load-bearing one —
 * they animate as CSS transitions while the canvas stays asleep under
 * frameloop="demand". Motion is one state-change transition per element; the
 * global prefers-reduced-motion rule in globals.css already stops it.
 */

import type { CSSProperties } from "react";
import { ELECTIVE_CAP } from "@/league";
import { useBuild } from "@/league/useBuild";

/** Four corners, staggered so the frame closes as a sweep rather than a snap. */
const CORNERS = [
  { transform: "none", delay: 0 },
  { transform: "scaleX(-1)", delay: 60 },
  { transform: "scale(-1, -1)", delay: 120 },
  { transform: "scaleY(-1)", delay: 180 },
];

/** Leaves along each stem, as [x, y, rotation, order]. */
const LEAVES = [
  [30, 8.5, -8, 0],
  [58, 7, -4, 2],
  [8.5, 30, 82, 1],
  [7, 58, 86, 3],
] as const;

function Corner({ transform, delay }: { transform: string; delay: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width="132"
      height="132"
      className="block"
      // Positioned by its wrapper. An `absolute` here would resolve against
      // .vine-frame instead, stacking all four corners in the top-left.
      style={{ transform, transformOrigin: "center" }}
      aria-hidden="true"
    >
      <g fill="none" stroke="var(--color-gem-600)" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
        <path d="M14 14C30 9 58 7 96 6" pathLength="1" strokeDasharray="1" style={{ transitionDelay: `${delay}ms` }} />
        <path d="M14 14C9 30 7 58 6 96" pathLength="1" strokeDasharray="1" style={{ transitionDelay: `${delay}ms` }} />
      </g>
      <g fill="var(--color-gem-500)" opacity="0.5">
        {LEAVES.map(([x, y, rotation, order]) => (
          <ellipse
            key={`${x}-${y}`}
            className="leaf"
            cx={x}
            cy={y}
            rx="4.4"
            ry="2.1"
            transform={`rotate(${rotation} ${x} ${y})`}
            style={{ transitionDelay: `${delay + order * 45}ms` }}
          />
        ))}
      </g>
    </svg>
  );
}

export function VineFrame() {
  const { build } = useBuild();
  const grown = Math.min(1, build.elective.length / ELECTIVE_CAP);

  return (
    <div
      className="vine-frame"
      aria-hidden="true"
      // 1 = fully retracted, 0 = closed frame. Both directions are the same
      // transition run the other way, so Clear picks retracts for free.
      style={
        {
          "--vine-grow": String(1 - grown),
          "--leaf-on": String(grown),
        } as CSSProperties
      }
    >
      {/* Each corner is the same drawing, mirrored into place. */}
      <div className="absolute top-0 left-0">
        <Corner {...CORNERS[0]} />
      </div>
      <div className="absolute top-0 right-0">
        <Corner {...CORNERS[1]} />
      </div>
      <div className="absolute right-0 bottom-0">
        <Corner {...CORNERS[2]} />
      </div>
      <div className="absolute bottom-0 left-0">
        <Corner {...CORNERS[3]} />
      </div>
    </div>
  );
}
