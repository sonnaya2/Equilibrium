"use client";

/**
 * The eleven-row rail beside the board.
 *
 * It owns the route's whole keyboard and screen-reader surface, and every
 * assertion e2e/map.spec.ts pins: one `<button>` per region whose accessible
 * name starts with the display name, the `0/3` counter, a genuinely disabled
 * fourth elective, and `Clear picks`. Nothing inside the canvas may repeat any
 * of that — two matches is a Playwright strict-mode failure.
 *
 * Focusing a row also drives the camera, so the 3D is a view over the store and
 * never the only way to do anything.
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
  const { build, toggleRegion, resetBuild } = useBuild();
  const { focus, focusRegion } = useMapFocus();
  const regionById = new Map(regions.map((r) => [r.id, r]));

  const row = (id: RegionId) => {
    const region = regionById.get(id);
    if (!region) return null;
    const unlocked = isRegionUnlocked(build, id);
    const selectable = canSelectElective(build, id);
    const selected = build.elective.includes(id);
    const fixed = region.availability !== "elective";
    return (
      <li key={id}>
        <button
          type="button"
          aria-pressed={fixed || selected}
          disabled={!fixed && !selectable}
          onClick={() => {
            focusRegion(id);
            if (!fixed) toggleRegion(id);
          }}
          className={`flex w-full items-center gap-2.5 border-b border-stone-800 px-3 py-1.5 text-left transition-colors duration-150 last:border-b-0 ${
            focus.region === id ? "bg-stone-800" : ""
          } ${fixed || selectable ? "" : "cursor-not-allowed opacity-40"} ${
            selected ? "text-gem-300" : unlocked ? "text-parch-50" : "text-parch-300"
          } hover:text-parch-50`}
        >
          <Hex on={unlocked} />
          <span className="text-sm font-medium">{region.name}</span>
          {/* The row's one data value, so it clears the 13px floor the labels
              around it do not have to. */}
          <span className="num ml-auto text-sm text-parch-300">{region.quests}</span>
          <span className="w-20 text-right text-xs text-parch-500">
            {region.availability === "starting"
              ? "start"
              : region.availability === "automatic_early"
                ? "first milestone"
                : selected
                  ? "picked"
                  : ""}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className="panel flex flex-col">
      <div className="panel-head flex items-center justify-between">
        Regions
        <span className="inline-flex items-center gap-2 normal-case tracking-normal">
          <Pips
            total={ELECTIVE_CAP}
            filled={build.elective.length}
            label={`${build.elective.length} of ${ELECTIVE_CAP} elective picks used`}
          />
          {/* The focal point of the rail: how much of the build is spent is the
              one number you glance at while reading anything else on the page. */}
          <span className="num text-2xl leading-none text-parch-50">
            {build.elective.length}/{ELECTIVE_CAP}
          </span>
        </span>
      </div>
      <ul>{[...STARTING_REGIONS, MILESTONE_REGION].map(row)}</ul>
      <div className="border-t border-stone-750 px-3 py-1.5 text-xs text-parch-500">
        Elective — pick 3 of 8
      </div>
      <ul>{ELECTIVE_REGIONS.map(row)}</ul>
      {build.elective.length > 0 ? (
        <div className="border-t border-stone-750 px-3 py-1.5">
          <button
            type="button"
            onClick={resetBuild}
            className="text-xs text-parch-300 transition-colors duration-150 hover:text-parch-50"
          >
            Clear picks
          </button>
        </div>
      ) : null}
    </section>
  );
}
