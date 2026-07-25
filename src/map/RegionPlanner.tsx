"use client";

/**
 * The map route's working surface: board, ledger rail, inspector.
 *
 * One client boundary for the three, because all three read the same focus
 * store and the board must not server-render (three/webgpu would land in the
 * shared chunk). The ledger sits beside the board rather than under it so a
 * region's row and the shape it names are one eye move apart.
 */

import { MapLoader } from "./MapLoader";
import { RegionInspector } from "./RegionInspector";
import { RegionLedger } from "./RegionLedger";
import type { PlannerRegion } from "./data/plannerRegion";

export type { PlannerRegion };

export function RegionPlanner({
  regions,
  boundaryRules,
}: {
  regions: PlannerRegion[];
  boundaryRules: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <MapLoader />
        <RegionLedger regions={regions} />
      </div>
      <RegionInspector regions={regions} boundaryRules={boundaryRules} />
    </div>
  );
}
