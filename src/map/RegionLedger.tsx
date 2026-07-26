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
 * Focusing a row also drives the camera, so the 3D is a view over the store and
 * never the only way to do anything. Full-width under the board uses a dense
 * multi-column grid so the rail does not read as a sparse single-file list.
 */

import { Pips } from "@/components/Pips";
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

function Hex({ on }: { on: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <path
        d="M8 1 14 4.5v7L8 15 2 11.5v-7z"
        fill={on ? "var(--color-gem-500)" : "none"}
        stroke={on ? "var(--color-gem-400)" : "var(--color-stone-750)"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function RegionLedger({ regions }: { regions: PlannerRegion[] }) {
  const { build, loaded, toggleRegion, clearElectives } = useBuild();
  const { focus, focusRegion } = useMapFocus();
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const pickCount = build.elective.length;
  // Empty-store SSR/hydrate frame must not read as a final 0/3; e2e waits for
  // the real counter after localStorage lands.
  const counterLabel = loaded ? `${pickCount}/${ELECTIVE_CAP}` : `…/${ELECTIVE_CAP}`;

  const row = (id: RegionId) => {
    const region = regionById.get(id);
    if (!region) return null;
    const unlocked = isRegionUnlocked(build, id);
    const selectable = canSelectElective(build, id);
    const selected = build.elective.includes(id);
    const fixed = region.availability !== "elective";
    // Cap and pre-hydrate both block toggle only — keep the button focusable so
    // inspector/camera still work. aria-disabled marks the inert pick state.
    const pickBlocked = !fixed && (!loaded || !selectable);
    const focusOn = focus.region === id;
    return (
      <li key={id}>
        <button
          type="button"
          aria-pressed={fixed || selected}
          aria-disabled={pickBlocked || undefined}
          onClick={() => {
            focusRegion(id);
            if (!fixed && loaded && selectable) toggleRegion(id);
          }}
          className={`comp-region-btn${selected ? " is-picked" : ""}${focusOn ? " is-focus" : ""}${
            pickBlocked ? "" : ""
          }`}
        >
          <Hex on={unlocked} />
          <span className="min-w-0 flex-1 truncate font-medium">{region.name}</span>
          <span className="comp-pick-count text-[11px]" title="Quests touching this region">
            {region.quests}
          </span>
        </button>
      </li>
    );
  };

  const hasElectives = pickCount > 0;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-busy={!loaded}>
      <div className="comp-ledger-head">
        <h2 className="comp-ledger-title">Region ledger</h2>
        <span className={`comp-pick-count${loaded ? "" : " opacity-60"}`} aria-live="polite">
          {counterLabel}
        </span>
        <Pips
          total={ELECTIVE_CAP}
          filled={loaded ? pickCount : 0}
          label={
            loaded
              ? `${pickCount} of ${ELECTIVE_CAP} elective picks used`
              : "Loading elective picks"
          }
        />
      </div>
      <ul className={`comp-region-list${loaded ? "" : " pointer-events-none opacity-60"}`}>
        {[...STARTING_REGIONS, MILESTONE_REGION].map(row)}
      </ul>
      <div className="border-t border-stone-750 px-3 py-1 text-[11px] uppercase tracking-wide text-parch-300">
        Elective — pick 3 of 8
      </div>
      <ul className={`comp-region-list${loaded ? "" : " pointer-events-none opacity-60"}`}>
        {ELECTIVE_REGIONS.map(row)}
      </ul>
      <div className="mt-auto border-t border-stone-750 px-3 py-1.5">
        <button
          type="button"
          disabled={!loaded || !hasElectives}
          onClick={clearElectives}
          className="text-xs text-parch-100 transition-colors duration-150 hover:text-parch-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-parch-100"
        >
          Clear picks
        </button>
      </div>
    </section>
  );
}

