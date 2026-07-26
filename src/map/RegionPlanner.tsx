"use client";

/**
 * Orbit Board Sky (champion Map DNA):
 * ledger rail left | 3D board right (primary height).
 * Region detail under the board stack — not a side inspector column.
 * Ledger owns a11y + frozen e2e picks.
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
    <div className="flex min-h-0 flex-col gap-3">
      <div className="comp-map" data-signature="board-sky">
        <div className="comp-ledger-col" aria-label="Region ledger column">
          <RegionLedger regions={regions} />
        </div>
        <div className="comp-board">
          <p className="comp-board__label">Board Sky</p>
          <div className="min-h-0 flex-1">
            <MapLoader />
          </div>
        </div>
      </div>
      <RegionInspector regions={regions} boundaryRules={boundaryRules} />
    </div>
  );
}
