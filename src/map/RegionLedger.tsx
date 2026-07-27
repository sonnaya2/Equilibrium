"use client";

/**
 * The region pick rail under Board Sky.
 *
 * It owns the route's whole keyboard and screen-reader surface, and every
 * assertion e2e/map.spec.ts pins: one `<button>` per region whose accessible
 * name starts with the display name, the `0/3` counter, a fourth elective with
 * aria-disabled at cap (still focusable), and always-mounted `Clear picks`.
 * Nothing inside the canvas may repeat any of that — two matches is a
 * Playwright strict-mode failure.
 *
 * Focusing a chip also drives the camera. Elective chips toggle pick when
 * allowed; fixed regions only frame.
 */

import { Pips } from "@/components/Pips";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import {
  canSelectElective,
  ELECTIVE_CAP,
  ELECTIVE_REGIONS,
  isRegionUnlocked,
  MILESTONE_REGION,
  STARTING_REGIONS,
  type RegionId,
} from "@/league";
import { useBuild } from "@/league/useBuild";
import type { PlannerRegion } from "./RegionPlanner";
import { useMapFocus } from "./useMapFocus";

const ORDER: RegionId[] = [...STARTING_REGIONS, MILESTONE_REGION, ...ELECTIVE_REGIONS];

export function RegionLedger({ regions }: { regions: PlannerRegion[] }) {
  const { build, loaded, toggleRegion, clearElectives } = useBuild();
  const { focus, focusRegion } = useMapFocus();
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const pickCount = build.elective.length;
  const counterLabel = loaded ? `${pickCount}/${ELECTIVE_CAP}` : `…/${ELECTIVE_CAP}`;
  // Native `disabled` must be a real boolean on every render, and it must be
  // gated on `loaded`. The server snapshot is an empty build, so SSR always
  // ships `disabled`; but this subtree renders late (Suspense + next/dynamic),
  // by which point the store can already hold real localStorage picks — and a
  // first paint computed straight off `build` would drop the attribute the HTML
  // has, which React reports as an unpatchable mismatch. `loaded` is false for
  // every instance's first render, so this matches the HTML either way.
  const clearDisabled = !loaded || pickCount === 0;

  return (
    <section className="board-sky__regions" aria-busy={!loaded}>
      <RegionCrestPreload regionIds={ORDER} />
      <div className="board-sky__regions-head">
        <h2 className="board-sky__rail-label">Regions</h2>
        <span className={`comp-pick-count${loaded ? "" : " opacity-60"}`} aria-live="polite">
          {counterLabel}
        </span>
        <Pips
          total={ELECTIVE_CAP}
          filled={loaded ? pickCount : 0}
          label={loaded ? `${pickCount} of ${ELECTIVE_CAP} elective picks used` : "Loading picks"}
        />
        <button
          type="button"
          disabled={clearDisabled}
          onClick={clearElectives}
          className="board-sky__clear"
        >
          Clear picks
        </button>
      </div>
      <ul className={`board-sky__region-chips${loaded ? "" : " pointer-events-none opacity-60"}`}>
        {ORDER.map((id) => {
          const region = regionById.get(id);
          if (!region) return null;
          const unlocked = isRegionUnlocked(build, id);
          const selectable = canSelectElective(build, id);
          const selected = build.elective.includes(id);
          const fixed = region.availability !== "elective";
          const pickBlocked = Boolean(!fixed && (!loaded || !selectable));
          const focusOn = focus.region === id;
          const picked = selected || fixed;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={picked}
                // Omit when false so SSR/client both lack the attr when open;
                // only emit the literal true when blocked (e2e pins that).
                aria-disabled={pickBlocked ? true : undefined}
                data-locked={unlocked ? undefined : "true"}
                onClick={() => {
                  focusRegion(id);
                  if (!fixed && loaded && selectable) toggleRegion(id);
                }}
                className={[
                  "board-sky__region-chip",
                  picked ? "is-picked" : "",
                  focusOn ? "is-focus" : "",
                  !unlocked ? "is-locked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <RegionCrest regionId={id} size={12} className="board-sky__region-crest" />
                <span className="board-sky__region-name">{region.name}</span>
                {!unlocked ? <span className="board-sky__lock"> locked</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
