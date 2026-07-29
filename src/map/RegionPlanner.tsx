"use client";

import { useEffect } from "react";
import { MapLoader } from "./MapLoader";
import { MapLookChrome } from "./MapLookChrome";
import { PlaceRail } from "./PlaceRail";
import { RegionInspector } from "./RegionInspector";
import { RegionLedger } from "./RegionLedger";
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
