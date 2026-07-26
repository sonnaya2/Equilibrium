"use client";

/**
 * Everything known about the region currently in focus, in one panel.
 *
 * This absorbed the two stacked sections that used to sit under the planner —
 * "What each pick opens" repeated the ledger's numbers, and "Boundary rules"
 * repeated rules already shown here — so comparing two regions is a click
 * rather than a 2600px scroll.
 *
 * The filters exist because the content list mixes what Jagex has confirmed
 * with what we inferred. Filtering to `confirmed` is the one view that answers
 * "what do I actually know", and it is why the status column carries provenance
 * instead of being flattened to a yes.
 */

import { useEffect, useMemo, useState } from "react";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import type { PlannerRegion } from "./data/plannerRegion";
import { REGION_METRICS_BY_ID } from "./data/regionMetrics";
import { useMapFocus } from "./useMapFocus";

const UNLOCK_TEXT = {
  starting: "Unlocked from the start",
  automatic_early: "Unlocks at the first task milestone",
  elective: "Elective pick — 3 of 8",
} as const;

type StatusFilter = "all" | "confirmed" | "inferred";

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-sm border px-2 py-0.5 text-xs transition-colors duration-150 ${
        on
          ? "border-gem-500 bg-stone-800 text-gem-300"
          : "border-stone-750 text-parch-300 hover:text-parch-50"
      }`}
    >
      {children}
    </button>
  );
}

export function RegionInspector({
  regions,
  boundaryRules,
}: {
  regions: PlannerRegion[];
  boundaryRules: string[];
}) {
  const { focus, focusPlace, focusRegion } = useMapFocus();
  const [kind, setKind] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const detail = regions.find((r) => r.id === focus.region);
  const metrics = REGION_METRICS_BY_ID.get(focus.region);
  const anchored = new Set((PLACES_BY_REGION.get(focus.region) ?? []).map((p) => p.area));

  const kinds = useMemo(
    () => [...new Set((detail?.content ?? []).map((c) => c.kind))].sort(),
    [detail],
  );

  // Stale kind from a previous region would empty the table with no chip on.
  useEffect(() => {
    setKind("all");
    setStatus("all");
    setQuery("");
  }, [focus.region]);

  if (!detail) return null;

  const activeKind = kind === "all" || kinds.includes(kind) ? kind : "all";
  const needle = query.trim().toLowerCase();
  const rows = detail.content.filter((c) => {
    if (activeKind !== "all" && c.kind !== activeKind) return false;
    const confirmed = c.confidence.startsWith("confirmed");
    if (status === "confirmed" && !confirmed) return false;
    if (status === "inferred" && confirmed) return false;
    if (needle && !c.name.toLowerCase().includes(needle)) return false;
    return true;
  });

  // PlaceMarkers only mounts while framed. focusPlace alone lights the chip
  // CSS but leaves the pin off the board after an unframe (or on first load).
  const lightPlace = (area: string | null) => {
    if (area !== null && !focus.framed) focusRegion(focus.region);
    focusPlace(area);
  };

  const sourcesLine = `${detail.sourceCount} source${detail.sourceCount === 1 ? "" : "s"} · verified ${detail.verifiedAt ?? "never"}`;

  return (
    <section className="panel" aria-label="Region detail">
      <div className="panel-head flex flex-wrap items-baseline justify-between gap-2">
        {detail.name}
        <span className="text-xs normal-case tracking-normal text-parch-300">
          {UNLOCK_TEXT[detail.availability]}
        </span>
      </div>

      <div className="stat-strip border-b border-stone-800 px-3.5 py-2.5">
        {[
          ["Quests touching", detail.quests],
          ["Content", metrics?.content ?? detail.content.length],
          ["Upgrades", metrics?.upgrades ?? detail.upgrades.length],
          ["Training", metrics?.training ?? detail.training],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="panel-body">
        {detail.areas.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {/* Anchored places are buttons so keyboard can light the marker;
                unanchored areas stay text — nothing on the board to focus. */}
            {detail.areas.map((area) => {
              const isAnchored = anchored.has(area);
              const lit = focus.place === area;
              const chipClass = `rounded-sm px-1.5 py-0.5 text-xs transition-colors duration-150 ${
                lit
                  ? "bg-stone-800 text-gem-300"
                  : isAnchored
                    ? "text-parch-100"
                    : "text-parch-500"
              }`;
              if (isAnchored) {
                return (
                  <button
                    key={area}
                    type="button"
                    onPointerEnter={() => lightPlace(area)}
                    onPointerLeave={() => lightPlace(null)}
                    onFocus={() => lightPlace(area)}
                    onBlur={() => lightPlace(null)}
                    onClick={() => lightPlace(area)}
                    className={chipClass}
                  >
                    {area}
                  </button>
                );
              }
              return (
                <span key={area} className={chipClass}>
                  {area}
                </span>
              );
            })}
          </div>
        ) : null}

        {detail.hardRules.map((rule) => (
          <p key={rule} className="mb-3 border-l-2 border-gem-500 pl-3 text-sm text-parch-100">
            {rule}
          </p>
        ))}

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {/* Kind is a select, not chips: the catalog's kinds are freeform
              strings and Misthalin alone has twelve, which as buttons is a
              two-row wall above a table with sixteen rows in it. */}
          <select
            value={activeKind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Filter content by kind"
            className="max-w-56 rounded-sm border border-stone-750 bg-stone-900 px-2 py-0.5 text-xs text-parch-100 focus:border-gem-400"
          >
            <option value="all">all kinds ({detail.content.length})</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <span className="mx-1 h-4 w-px bg-stone-750" aria-hidden="true" />
          {(["all", "confirmed", "inferred"] as const).map((s) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
              {s}
            </Chip>
          ))}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find content"
            aria-label="Filter content by name"
            className="ml-auto w-40 rounded-sm border border-stone-750 bg-stone-900 px-2 py-0.5 text-xs text-parch-100 placeholder:text-parch-500 focus:border-gem-400"
          />
        </div>

        {/* Capped and scrolled rather than pushing the page down: comparing two
            regions has to stay a click, and Misthalin alone runs to 16 rows. */}
        <div className="grid max-h-80 gap-4 overflow-y-auto lg:grid-cols-2">
          {rows.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Content</th>
                  <th>Kind</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
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
            <p className="text-sm text-parch-300">
              {detail.content.length === 0
                ? "No content mapped yet."
                : "Nothing matches those filters."}
            </p>
          )}

          {detail.upgrades.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Upgrade</th>
                  <th>Kind</th>
                </tr>
              </thead>
              <tbody>
                {detail.upgrades.map((u) => (
                  <tr key={u.name}>
                    <td className="text-parch-50">{u.name}</td>
                    <td>{u.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        {detail.warnings.map((w) => (
          <p key={w} className="mt-3 text-xs text-parch-500">
            Note: {w}
          </p>
        ))}

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-stone-800 pt-2">
          {/* Compact live status: name/unlock/sources only. Filters and the
              content table stay outside so chip/select churn is not announced.
              e2e pins section[aria-live] + the sources pattern (must be visible). */}
          <section aria-live="polite" className="num text-xs text-parch-500">
            <span className="sr-only">
              {detail.name}. {UNLOCK_TEXT[detail.availability]}.{" "}
            </span>
            {sourcesLine}
          </section>
          <details className="text-xs text-parch-300">
            <summary className="cursor-pointer text-parch-500 hover:text-parch-300">
              Boundary rules ({boundaryRules.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {boundaryRules.map((rule) => (
                <p key={rule}>{rule}</p>
              ))}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
