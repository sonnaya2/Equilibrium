"use client";

/**
 * The map route's working surface: board, ledger rail, inspector.
 *
 * One client boundary for the three, because all three read the same focus
 * store and the board must not server-render (three/webgpu would land in the
 * shared chunk).
 *
 * Board beside a rail, both full height. Which layout is bigger depends
 * entirely on the board's own aspect, and that changed when MAP_WORLD stopped
 * being derived from a 2.14:1 banner crop: the board is a ~1.9:1 shape now, not
 * a ~3:1 one. Handed a full-width 3.2:1 cell it needs only 60% of the width and
 * wastes the rest, which measured 100px *smaller* per region than this. So the
 * rail goes back beside it, where it costs width the board was not using.
 *
 * Rule of thumb for anyone re-tuning: the fit crosses over at a cell aspect of
 * `FIT_HALF_WIDTH / (tan(fov/2) * forDepthRadius)`, about 1.93. Wider than that
 * and depth binds, so region size tracks canvas *height*; narrower and width
 * binds, so it tracks canvas *width*. Measure with `window.__mapFitProbe()`.
 *
 * `min-h-0` on every box between the shell and the canvas is load-bearing: a
 * flex/grid child defaults to `min-height: auto` and will not shrink below its
 * content, which is what turns a full-height board into an overflowing one.
 */

import { MapLoader } from "./MapLoader";
import { RegionInspector } from "./RegionInspector";
import { RegionLedger } from "./RegionLedger";
import type { PlannerRegion } from "./data/plannerRegion";
import { useMapHashSync } from "./useMapFocus";

export type { PlannerRegion };

export function RegionPlanner({
  regions,
  boundaryRules,
}: {
  regions: PlannerRegion[];
  boundaryRules: string[];
}) {
  useMapHashSync();
  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-h-0 flex-col">
        <MapLoader />
      </div>
      {/* One scroll container for the reading surface, so the ledger and the
          inspector move together and a pin stays beside the text about it. */}
      <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
        <RegionLedger regions={regions} />
        <RegionInspector regions={regions} boundaryRules={boundaryRules} />
      </div>
    </div>
  );
}
