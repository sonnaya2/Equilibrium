"use client";

/** Region details grouped into tabs; hard rules and sources apply to every tab. */

import { useMemo, useState } from "react";
import { contentDetailOrRewards } from "@/lib/researchRewards";
import { useResearchRegion } from "@/research/regionStore";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import type { DetailRow, RegionDetail, TrainingRow } from "./data/regionDetail";
import { makeRegionDetail } from "./data/regionDetail";
import type { PlannerRegion } from "./data/plannerRegion";
import { useMapFocus } from "./useMapFocus";

const UNLOCK_TEXT = {
  starting: "From start",
  automatic_early: "First milestone",
  elective: "Elective · 3 of 8",
} as const;

type TabId = "bosses" | "skilling" | "gear" | "items" | "training" | "places";

const TABS: { id: TabId; label: string }[] = [
  { id: "bosses", label: "Bosses" },
  { id: "skilling", label: "Skilling" },
  { id: "gear", label: "Gear" },
  { id: "items", label: "Items" },
  { id: "training", label: "Training" },
  { id: "places", label: "Places" },
];

function countFor(detail: RegionDetail, tab: TabId): number {
  if (tab === "bosses") return detail.bosses.length;
  if (tab === "skilling") return detail.skilling.length + detail.otherContent.length;
  if (tab === "gear") return detail.gear.length;
  if (tab === "items") return detail.skillItems.length;
  if (tab === "training") return detail.training.length;
  return detail.areas.length;
}

/** "189473.7" -> "189,474". Blank stays blank; the source had no number. */
function xpPerHour(raw: string): string {
  const value = Number(raw);
  if (!raw || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("en-GB");
}

function RowTable({
  rows,
  header,
  upgrades = [],
}: {
  rows: DetailRow[];
  header: string;
  /** Region upgrades for empty-detail reward fallback on content majors. */
  upgrades?: DetailRow[];
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{header}</th>
          <th>Kind</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          // Empty catalog detail is common on majors - show clipped rewards under name.
          const subtitle = contentDetailOrRewards(row, upgrades);
          return (
            <tr key={`${row.name}-${row.kind}`}>
              <td className="text-parch-50">
                {row.name}
                {subtitle ? <span className="block text-xs text-parch-400">{subtitle}</span> : null}
              </td>
              <td>{row.kind || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TrainingTable({ rows }: { rows: TrainingRow[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Method</th>
          <th>Skill</th>
          <th>Levels</th>
          <th className="num">XP/hr</th>
          <th>Where</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="text-parch-50">
              {row.method}
              {row.warning ? (
                <span className="block text-xs text-parch-400">{row.warning}</span>
              ) : null}
            </td>
            <td>{row.skill}</td>
            <td>{row.levelRange || "—"}</td>
            {/* The rating players actually compare on, so it is the one number
                that gets mono and right alignment. */}
            <td className="num text-right text-parch-50">{xpPerHour(row.xpRate)}</td>
            <td>
              {row.location || "—"}
              {row.regionLocked ? (
                <span className="ml-1.5 text-xs text-gem-300">needs region</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RegionDetails({
  regions,
  boundaryRules,
}: {
  regions: PlannerRegion[];
  boundaryRules: string[];
}) {
  const { focus, selectPlace, hoverPlace } = useMapFocus();
  const [tab, setTab] = useState<TabId>("bosses");
  const [query, setQuery] = useState("");

  const planner = regions.find((r) => r.id === focus.region);
  const { region } = useResearchRegion(focus.region);
  const detail = useMemo(() => (region ? makeRegionDetail(region) : null), [region]);
  // Names on the board (catalog areas + content-row sites). Sites never pad the
  // places-pinned ratio - that meter is catalog areas only.
  const anchored = useMemo(
    () => new Set((PLACES_BY_REGION.get(focus.region) ?? []).map((p) => p.area)),
    [focus.region],
  );

  if (!planner || !detail) return null;

  const needle = query.trim().toLowerCase();
  const keep = (row: DetailRow) =>
    !needle || row.name.toLowerCase().includes(needle) || row.kind.toLowerCase().includes(needle);

  const bosses = detail.bosses.filter(keep);
  const skilling = [...detail.skilling, ...detail.otherContent].filter(keep);
  const gear = detail.gear.filter(keep);
  const items = detail.skillItems.filter(keep);
  // gear + skillItems are the region's full upgrade set (name/detail for reward resolve).
  const upgrades = [...detail.gear, ...detail.skillItems];
  const training = detail.training.filter(
    (row) =>
      !needle ||
      row.method.toLowerCase().includes(needle) ||
      row.skill.toLowerCase().includes(needle) ||
      row.location.toLowerCase().includes(needle),
  );
  const places = detail.areas.filter((area) => !needle || area.toLowerCase().includes(needle));

  // Honest meter: catalog areas with a board pin / catalog areas. Site pins
  // (bosses, guilds) sit on the rail separately and do not inflate the ratio.
  const placesTotal = detail.areas.length;
  const pinnedTotal = detail.areas.reduce((n, area) => n + (anchored.has(area) ? 1 : 0), 0);
  const pinSegs = Math.min(12, Math.max(placesTotal, 1));
  const pinLit =
    placesTotal <= pinSegs
      ? pinnedTotal
      : Math.round((pinnedTotal / Math.max(placesTotal, 1)) * pinSegs);
  const framedNote = focus.framed ? "Framed" : "Unframed";

  const empty = <p className="py-2 text-sm text-parch-300">Nothing mapped.</p>;

  return (
    <section className="panel" aria-label="Region detail" aria-live="polite">
      <div className="map-layout__dossier-band">
        <div className="map-layout__dossier-copy">
          <div className="panel-head flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-0 bg-transparent p-0">
            <span>
              {planner.name}
              <span className="ml-2 text-xs normal-case tracking-normal text-parch-300">
                · {framedNote}
              </span>
            </span>
            <span className="text-xs normal-case tracking-normal text-parch-300">
              {UNLOCK_TEXT[planner.availability]}
            </span>
          </div>
        </div>
        <div className="map-layout__pin-meter" aria-label="Places pinned">
          <div className="text-[11px] uppercase tracking-wide text-parch-400">Places pinned</div>
          <div className="stat-key text-gem-400">
            <span className="num">
              {pinnedTotal}/{placesTotal}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] normal-case tracking-normal text-parch-500">
            catalog areas on the board
          </p>
          <div className="map-layout__pin-track" aria-hidden="true">
            {Array.from({ length: pinSegs }).map((_, i) => (
              <span key={i} className={`map-layout__pin-seg${i < pinLit ? " is-on" : ""}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="stat-strip border-b border-stone-800 px-3.5 py-2">
        {[
          ["Quests", planner.quests],
          ["Bosses", detail.bosses.length],
          ["Upgrades", detail.gear.length + detail.skillItems.length],
          ["Training", detail.training.length],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      {detail.hardRules.length > 0 || detail.skills.length > 0 ? (
        <div className="border-b border-stone-800 px-3.5 py-2">
          {detail.skills.length > 0 ? (
            <p className="mb-1.5 text-xs text-parch-400">
              Skills · <span className="text-parch-100">{detail.skills.join(" · ")}</span>
            </p>
          ) : null}
          {detail.hardRules.map((rule) => (
            <p
              key={rule}
              className="mb-1.5 border-l-2 border-gem-500 pl-3 text-sm text-parch-100 last:mb-0"
            >
              {rule}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-800 px-3.5 py-1.5">
        {TABS.map(({ id, label }) => {
          const count = countFor(detail, id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`rounded-sm border px-2 py-0.5 text-xs transition-colors duration-150 ${
                tab === id
                  ? "border-gem-500 bg-stone-800 text-gem-300"
                  : count === 0
                    ? "border-stone-800 text-parch-500"
                    : "border-stone-750 text-parch-300 hover:text-parch-50"
              }`}
            >
              {label} <span className="num ml-0.5">{count}</span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find"
            aria-label="Filter region"
            className="w-36 rounded-sm border border-stone-750 bg-stone-900 px-2 py-0.5 text-xs text-parch-100 placeholder:text-parch-500 focus:border-gem-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="panel-body max-h-96 overflow-y-auto">
        {tab === "bosses" ? (
          bosses.length ? (
            <RowTable rows={bosses} header="Boss" upgrades={upgrades} />
          ) : (
            empty
          )
        ) : null}
        {tab === "skilling" ? (
          skilling.length ? (
            <RowTable rows={skilling} header="Content" upgrades={upgrades} />
          ) : (
            empty
          )
        ) : null}
        {tab === "gear" ? gear.length ? <RowTable rows={gear} header="Upgrade" /> : empty : null}
        {tab === "items" ? (
          items.length ? (
            <RowTable rows={items} header="Skill item" />
          ) : (
            empty
          )
        ) : null}
        {tab === "training" ? training.length ? <TrainingTable rows={training} /> : empty : null}
        {tab === "places" ? (
          places.length ? (
            <div className="flex flex-wrap gap-1.5 py-1">
              {/* Hover state is shared with the matching map marker. */}
              {places.map((area) => {
                const pinned = anchored.has(area);
                const on = focus.place === area;
                const lit = pinned && focus.hover === area;
                return (
                  <span
                    key={area}
                    onPointerEnter={() => pinned && hoverPlace(area)}
                    onPointerLeave={() => hoverPlace(null)}
                    onClick={() => (pinned ? selectPlace(on ? null : area) : undefined)}
                    className={`rounded-sm px-2 py-1 text-sm transition-colors duration-150 ${
                      on
                        ? "bg-stone-800 text-gem-300"
                        : lit
                          ? "text-parch-50"
                          : pinned
                            ? "text-parch-100"
                            : "text-parch-500"
                    }`}
                  >
                    {area}
                  </span>
                );
              })}
            </div>
          ) : (
            empty
          )
        ) : null}
      </div>

      {detail.warnings.length > 0 ? (
        <div className="border-t border-stone-800 px-3.5 py-2">
          {detail.warnings.map((w) => (
            <p key={w} className="text-xs text-parch-500">
              {w}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-stone-800 px-3.5 py-2">
        <p className="num text-xs text-parch-500">
          {detail.sourceCount} source{detail.sourceCount === 1 ? "" : "s"} · verified{" "}
          {detail.verifiedAt ?? "never"}
        </p>
        <details className="text-xs text-parch-300">
          <summary className="cursor-pointer text-parch-500 hover:text-parch-300">
            Boundaries ({boundaryRules.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {boundaryRules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
