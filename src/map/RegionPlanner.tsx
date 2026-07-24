"use client";

import { useState } from "react";
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

/** Slim region row for the planner; the server page projects the research catalog into this. */
export interface PlannerRegion {
  id: RegionId;
  name: string;
  availability: "starting" | "automatic_early" | "elective";
  areas: string[];
  content: Array<{ name: string; kind: string; confidence: string }>;
  hardRules: string[];
  warnings: string[];
  sourceTitle: string | null;
  verifiedAt: string | null;
}

const UNLOCK_TEXT = {
  starting: "Unlocked from the start",
  automatic_early: "Unlocks at the first task milestone",
  elective: "Elective pick — 3 of 8",
} as const;

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

export function RegionPlanner({ regions }: { regions: PlannerRegion[] }) {
  const { build, toggleRegion, resetBuild } = useBuild();
  const [focus, setFocus] = useState<RegionId>("misthalin");

  const regionById = new Map(regions.map((r) => [r.id, r]));
  const detail = regionById.get(focus);

  const pick = (id: RegionId) => {
    setFocus(id);
    toggleRegion(id);
  };

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
          onClick={() => (fixed ? setFocus(id) : pick(id))}
          className={`flex w-full items-center gap-2.5 border-b border-stone-800 px-3.5 py-2 text-left transition-colors duration-150 last:border-b-0 ${
            focus === id ? "bg-stone-800" : ""
          } ${fixed || selectable ? "" : "cursor-not-allowed opacity-40"} ${
            selected ? "text-gem-300" : unlocked ? "text-parch-50" : "text-parch-300"
          } hover:text-parch-50`}
        >
          <Hex on={unlocked} />
          <span className="text-sm font-medium">{region.name}</span>
          <span className="ml-auto text-xs text-parch-500">
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
    <div className="grid gap-4 md:grid-cols-5">
      <section className="panel md:col-span-2">
        <div className="panel-head flex items-center justify-between">
          Regions
          <span className="inline-flex items-center gap-2 normal-case tracking-normal">
            <Pips total={ELECTIVE_CAP} filled={build.elective.length} label={`${build.elective.length} of ${ELECTIVE_CAP} elective picks used`} />
            <span className="num text-xs text-parch-300">
              {build.elective.length}/{ELECTIVE_CAP}
            </span>
          </span>
        </div>
        <ul>
          {[...STARTING_REGIONS, MILESTONE_REGION].map(row)}
        </ul>
        <div className="border-t border-stone-750 px-3.5 py-2 text-xs text-parch-500">
          Elective — pick 3 of 8
        </div>
        <ul>{ELECTIVE_REGIONS.map(row)}</ul>
        {build.elective.length > 0 ? (
          <div className="border-t border-stone-750 px-3.5 py-2">
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

      {detail ? (
        <section className="panel md:col-span-3" aria-live="polite">
          <div className="panel-head flex items-baseline justify-between">
            {detail.name}
            <span className="text-xs normal-case tracking-normal text-parch-300">
              {UNLOCK_TEXT[detail.availability]}
            </span>
          </div>
          <div className="panel-body">
            {detail.areas.length > 0 ? (
              <p className="mb-3 text-sm text-parch-300">{detail.areas.join(" · ")}</p>
            ) : null}

            {detail.hardRules.map((rule) => (
              <p key={rule} className="mb-3 border-l-2 border-gem-500 pl-3 text-sm text-parch-100">
                {rule}
              </p>
            ))}

            {detail.content.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Content</th>
                    <th>Kind</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.content.map((c) => (
                    <tr key={c.name}>
                      <td className="text-parch-50">{c.name}</td>
                      <td>{c.kind}</td>
                      <td>
                        {c.confidence.startsWith("confirmed") ? (
                          <span className="text-parch-500">confirmed</span>
                        ) : (
                          <span className="tag">inferred</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-parch-300">No content mapped yet.</p>
            )}

            {detail.warnings.map((w) => (
              <p key={w} className="mt-3 text-xs text-parch-500">
                Note: {w}
              </p>
            ))}

            <p className="num mt-4 text-xs text-parch-500">
              {detail.sourceTitle ?? "No source"} · verified {detail.verifiedAt ?? "never"}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
