"use client";

/**
 * Full-width region detail under Board Sky.
 *
 * Sits under the board + ledger as a deliberate instrument strip — not a
 * leftover side-rail panel. Crest + identity head, compact fact strip,
 * horizontal planner value, then the content/upgrade catalog at full width.
 *
 * Filters exist because the content list mixes what Jagex has confirmed with
 * what we inferred. Filtering to `confirmed` is the one view that answers
 * "what do I actually know".
 */

import { useEffect, useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";
import autoQuests from "#data/league/equilibrium-auto-quests.json";
import { getInventionComponentsByRegion } from "@/research/plannerExpansions";
import { getSlayerMethodsByRegion } from "@/research/slayerPlanner";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import type { PlannerRegion } from "./data/plannerRegion";
import { REGION_METRICS_BY_ID } from "./data/regionMetrics";
import { useMapFocus } from "./useMapFocus";

type AutoQuestRegionKey = keyof typeof autoQuests.regions;

function slayerLabel(method: { monster?: string; id?: string }): string {
  return method.monster || method.id || "Slayer route";
}

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
          : "border-stone-750 text-parch-100 hover:text-parch-50"
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

  // Top content + upgrades for the compact value band (not a second table).
  // Dedup by name so content+upgrade twins do not React-key-collide.
  const plannerHighlights = useMemo(() => {
    if (!detail) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [
      ...detail.content.map((c) => c.name),
      ...detail.upgrades.map((u) => u.name),
    ]) {
      const n = String(name || "").trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
      if (out.length >= 5) break;
    }
    return out;
  }, [detail]);

  const slayerMethods = useMemo(
    () => getSlayerMethodsByRegion(focus.region),
    [focus.region],
  );
  const inventionComponents = useMemo(
    () => getInventionComponentsByRegion(focus.region),
    [focus.region],
  );

  const autoRegion =
    focus.region in autoQuests.regions
      ? autoQuests.regions[focus.region as AutoQuestRegionKey]
      : null;
  const autoEmpty = !autoRegion || autoRegion.auto_completed_quests.length === 0;

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
  const researchBits: string[] = [];
  if (slayerMethods.length > 0) {
    researchBits.push(
      `Slayer: ${slayerMethods.slice(0, 3).map(slayerLabel).join(", ")}${
        slayerMethods.length > 3 ? ` +${slayerMethods.length - 3}` : ""
      }`,
    );
  }
  if (inventionComponents.length > 0) {
    researchBits.push(
      `Invention: ${inventionComponents
        .slice(0, 3)
        .map((c) => c.component)
        .join(", ")}${inventionComponents.length > 3 ? ` +${inventionComponents.length - 3}` : ""}`,
    );
  }

  return (
    <section className="panel map-detail-dock" aria-label="Region detail">
      <div className="panel-head flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <GameIcon src={regionCrestPath(detail.id)} size={20} className="shrink-0" />
          <span className="text-parch-50">{detail.name}</span>
          <span className="text-xs normal-case tracking-normal text-parch-100">
            {UNLOCK_TEXT[detail.availability]}
          </span>
        </div>
        <section aria-live="polite" className="num text-xs normal-case tracking-normal text-parch-300">
          <span className="sr-only">
            {detail.name}. {UNLOCK_TEXT[detail.availability]}.{" "}
          </span>
          {sourcesLine}
        </section>
      </div>

      <div className="stat-strip border-b border-stone-800">
        {[
          ["Quests", detail.quests],
          ["Content", metrics?.content ?? detail.content.length],
          ["Upgrades", metrics?.upgrades ?? detail.upgrades.length],
          ["Training", metrics?.training ?? detail.training],
          ["Combat", detail.combatUnlocks ?? 0],
          ["Multi", detail.multiRegionUnlocks ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      {(plannerHighlights.length > 0 || researchBits.length > 0 || autoEmpty) && (
        <div className="border-b border-stone-800 px-3 py-1.5 text-xs text-parch-100">
          {plannerHighlights.length > 0 ? plannerHighlights.slice(0, 4).join(" · ") : null}
          {researchBits.length > 0 ? (
            <span className="text-parch-300">
              {plannerHighlights.length ? " · " : ""}
              {researchBits.join(" · ")}
            </span>
          ) : null}
          {autoEmpty ? (
            <span className="text-parch-300">
              {plannerHighlights.length || researchBits.length ? " · " : ""}
              Auto-complete: none published
            </span>
          ) : null}
        </div>
      )}

      <div className="panel-body space-y-2 py-2">
        {(detail.areas.length > 0 || detail.hardRules.length > 0) && (
          <div className="space-y-1.5">
            {detail.areas.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {[...new Set(detail.areas.filter(Boolean))].map((area, i) => {
                  const isAnchored = anchored.has(area);
                  const lit = focus.place === area;
                  const chipClass = `rounded-sm px-1.5 py-0.5 text-xs transition-colors duration-150 ${
                    lit
                      ? "bg-stone-800 text-gem-300"
                      : isAnchored
                        ? "text-parch-100"
                        : "text-parch-300"
                  }`;
                  if (isAnchored) {
                    return (
                      <button
                        key={`area-${i}-${area}`}
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
                    <span key={`area-${i}-${area}`} className={chipClass}>
                      {area}
                    </span>
                  );
                })}
              </div>
            ) : null}

            {detail.hardRules.map((rule) => (
              <p
                key={rule}
                className="border-l-2 border-gem-500 pl-2.5 text-sm leading-snug text-parch-100"
              >
                {rule}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Kind is a select, not chips: freeform catalog kinds would become a wall. */}
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

        {/* Full-width catalog: two columns on lg so the strip uses the board span. */}
        <div className="grid max-h-72 gap-3 overflow-y-auto lg:grid-cols-2">
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
                {rows.map((c, i) => (
                  <tr key={`content-${i}-${c.name}`}>
                    <td className="text-parch-50">{c.name}</td>
                    <td>{c.kind}</td>
                    <td>
                      {c.confidence.startsWith("confirmed") ? (
                        <span className="text-parch-300">confirmed</span>
                      ) : (
                        <span className="tag">inferred</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-parch-100">
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
                {detail.upgrades.map((u, i) => (
                  <tr key={`upgrade-${i}-${u.name}`}>
                    <td className="text-parch-50">
                      <div>{u.name}</div>
                      {u.comboLabel ? (
                        <div className="mt-0.5 text-xs font-normal normal-case tracking-normal text-parch-300">
                          {u.comboLabel}
                        </div>
                      ) : null}
                    </td>
                    <td>{u.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        {detail.warnings.map((w) => (
          <p key={w} className="text-xs text-parch-300">
            Note: {w}
          </p>
        ))}

        <div className="flex flex-wrap items-baseline justify-end gap-2 border-t border-stone-800 pt-2">
          <details className="text-xs text-parch-100">
            <summary className="cursor-pointer text-parch-300 hover:text-parch-100">
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
