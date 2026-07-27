"use client";

/**
 * The map route's working surface: map board.
 *
 * Board majority height on top; ledger · places · region detail under the board.
 * No side inspector column (Hybrid map board DNA).
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
import { MapToolbar } from "./MapToolbar";
import { PlaceList } from "./PlaceList";
import { RegionDetails } from "./RegionDetails";
import { RegionPicker } from "./RegionPicker";
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
    <div className="map-layout">
      <div className="map-layout__board">
        <div className="map-layout__scene-slot">
          <MapLoader />
        </div>
        <MapToolbar />
      </div>
      <div className="map-layout__under">
        <div className="map-layout__ledger">
          <RegionPicker regions={regions} />
        </div>
        <PlaceList />
        <RegionDetails regions={regions} boundaryRules={boundaryRules} />
      </div>
    </div>
  );
}
