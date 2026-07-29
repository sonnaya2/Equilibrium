"use client";

import { useEffect } from "react";
import { MapLoader } from "./MapLoader";
import { MapToolbar } from "./MapToolbar";
import { PlaceList } from "./PlaceList";
import { RegionDetails } from "./RegionDetails";
import { RegionPicker } from "./RegionPicker";
import type { PlannerRegion } from "./data/plannerRegion";
import { hydrateFlatBoard, useMapHashSync } from "./useMapFocus";
import "@/components/map-board.css";

export type { PlannerRegion };

export function RegionPlanner({
  regions,
  boundaryRules,
}: {
  regions: PlannerRegion[];
  boundaryRules: string[];
}) {
  useMapHashSync();
  // Read the fallback preference after mount to keep hydration deterministic.
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
