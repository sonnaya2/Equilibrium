"use client";

/**
 * The map route's working surface: Board Sky.
 *
 * Board majority height on top; ledger · places · region detail under the board.
 * No side inspector column (Hybrid Board Sky DNA).
 *
 * One client boundary for board + under stack because all read the same focus
 * store and the board must not server-render (three/webgpu would land in the
 * shared chunk).
 *
 * `min-h-0` on every box between the shell and the canvas is load-bearing: a
 * flex/grid child defaults to `min-height: auto` and will not shrink below its
 * content, which is what turns a full-height board into an overflowing one.
 */

import { useEffect } from "react";
import { MapLoader } from "./MapLoader";
import { MapLookChrome } from "./MapLookChrome";
import { PlaceRail } from "./PlaceRail";
import { RegionInspector } from "./RegionInspector";
import { RegionLedger } from "./RegionLedger";
import type { PlannerRegion } from "./data/plannerRegion";
import { hydrateFlatBoard, useMapHashSync } from "./useMapFocus";

export type { PlannerRegion };

export function RegionPlanner({
  regions,
  boundaryRules,
}: {
  regions: PlannerRegion[];
  boundaryRules: string[];
}) {
  useMapHashSync();
  // After mount only: the server snapshot has flat=false, so reading storage
  // during render would make the first client paint disagree with the HTML.
  useEffect(() => {
    hydrateFlatBoard();
  }, []);
  return (
    <div className="board-sky">
      <div className="board-sky__board">
        <div className="board-sky__scene-slot">
          <MapLoader />
        </div>
        <MapLookChrome />
      </div>
      <div className="board-sky__under">
        <div className="board-sky__ledger">
          <RegionLedger regions={regions} />
        </div>
        <PlaceRail />
        <RegionInspector regions={regions} boundaryRules={boundaryRules} />
      </div>
    </div>
  );
}
