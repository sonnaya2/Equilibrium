"use client";

import { isRegionUnlocked } from "@/league";
import { useBuild } from "@/league/useBuild";
import { MAP_IMAGE, REGION_ANCHORS } from "./data/regionAnchors";
import { REGION_METRICS_BY_ID } from "./data/regionMetrics";
import { useMapFocus } from "./useMapFocus";

const W = 1000;
const H = (W * MAP_IMAGE.height) / MAP_IMAGE.width;

export function FlatBoard() {
  const { build } = useBuild();
  const { focus, focusRegion } = useMapFocus();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      role="presentation"
    >
      <image href={MAP_IMAGE.fallbackSrc} width={W} height={H} preserveAspectRatio="none" />
      {REGION_ANCHORS.map((region) => {
        const x = region.uv[0] * W;
        const y = region.uv[1] * H;
        const unlocked = isRegionUnlocked(build, region.id);
        const framed = focus.framed && focus.region === region.id;
        return (
          <g
            key={region.id}
            className={`flat-map-marker${unlocked ? " is-unlocked" : " is-locked"}${framed ? " is-focus" : ""}`}
            onClick={() => focusRegion(region.id)}
          >
            <circle cx={x} cy={y} r={34} fill="transparent" />
            <image
              href={`/game/regions/${region.id}.png`}
              x={x - 20}
              y={y - 34}
              width={40}
              height={46}
              preserveAspectRatio="xMidYMid meet"
            />
            <text x={x} y={y + 24} textAnchor="middle">
              {region.name}
            </text>
            <text x={x} y={y + 38} textAnchor="middle" className="flat-map-marker__count">
              {REGION_METRICS_BY_ID.get(region.id)?.quests ?? 0} quests
            </text>
          </g>
        );
      })}
    </svg>
  );
}
