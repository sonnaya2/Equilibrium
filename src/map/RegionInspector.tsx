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
import autoQuests from "#data/league/equilibrium-auto-quests.json";
import { canSelectElective, isRegionUnlocked } from "@/league";
import { useBuild } from "@/league/useBuild";
import { getInventionComponentsByRegion } from "@/research/plannerExpansions";
import { getSlayerMethodsByRegion } from "@/research/slayerPlanner";
import { PLACES_BY_REGION, pinForHighlight } from "./data/placeAnchors";
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
  const { focus, selectPlace, hoverPlace } = useMapFocus();
  const { build, loaded, toggleRegion } = useBuild();
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

  // Top content + upgrades for the compact planner-value strip (not a second table).
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

  // How much of this region's content we can actually put on the board. Stated,
  // not hidden: most rows are items, perks and outfits with no position on
  // Gielinor, and the honest number is more useful than a map of guesses.
  const pinStats = useMemo(() => {
    const names = [
      ...new Set([
        ...(detail?.content ?? []).map((c) => c.name),
        ...(detail?.upgrades ?? []).map((u) => u.name),
      ]),
    ];
    const pinned = names.filter((n) => pinForHighlight(focus.region, n)).length;
    return { pinned, total: names.length };
  }, [detail, focus.region]);

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

  // Selecting a pin on the board brings its first row into view. One direction
  // only — deliberately no scroll-spy driving selection back the other way,
  // which would need a suppression flag to stop the two fighting and would
  // overwrite a deliberate selection every time the rail moved.
  useEffect(() => {
    if (!focus.place) return;
    document
      .querySelector(`[data-place="${CSS.escape(focus.place)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus.place]);

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

  const sourcesLine = `${detail.sourceCount} source${detail.sourceCount === 1 ? "" : "s"} · verified ${detail.verifiedAt ?? "never"}`;

  // The board no longer toggles on click, so picking needs a control that says
  // so. Named "Pick <region>" / "Remove <region>" rather than the bare region
  // name: e2e locates ledger rows by /^<name>/ and a second match there is a
  // Playwright strict-mode failure.
  const elective = detail.availability === "elective";
  const picked = build.elective.includes(detail.id);
  const canPick = loaded && canSelectElective(build, detail.id);
  const pickBlocked = elective && !picked && !canPick;

  return (
    <section className="panel" aria-label="Region detail">
      <div className="panel-head flex flex-wrap items-center justify-between gap-2">
        {detail.name}
        <span className="flex items-center gap-2.5">
          <span className="text-xs normal-case tracking-normal text-parch-100">
            {UNLOCK_TEXT[detail.availability]}
          </span>
          {elective ? (
            <button
              type="button"
              onClick={() => {
                if (loaded && (picked || canPick)) toggleRegion(detail.id);
              }}
              aria-pressed={picked}
              aria-disabled={pickBlocked || !loaded || undefined}
              title={pickBlocked ? "All three elective picks are spent" : undefined}
              className={`rounded-sm border px-2 py-0.5 text-xs normal-case tracking-normal transition-colors duration-150 ${
                picked
                  ? "border-gem-500 bg-stone-800 text-gem-300 hover:text-gem-200"
                  : "border-stone-750 text-parch-100 hover:text-parch-50"
              } ${pickBlocked || !loaded ? "cursor-not-allowed opacity-40" : ""}`}
            >
              {picked ? "Remove" : "Pick"} {detail.name}
            </button>
          ) : (
            <span className="rounded-sm border border-stone-750 px-2 py-0.5 text-xs normal-case tracking-normal text-parch-300">
              {isRegionUnlocked(build, detail.id) ? "Unlocked" : "Unlocks automatically"}
            </span>
          )}
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

      {/* Compact planner-value strip: highlights + cheap research joins + auto-quest honesty. */}
      <div className="border-b border-stone-800 px-3.5 py-2.5">
        <div className="text-xs font-medium uppercase tracking-[0.13em] text-parch-300">
          Planner value
        </div>
        {plannerHighlights.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5 text-xs text-parch-100">
            {plannerHighlights.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs text-parch-300">No content or upgrades mapped yet.</p>
        )}
        {(slayerMethods.length > 0 || inventionComponents.length > 0) && (
          <p className="mt-1.5 text-xs text-parch-100">
            {slayerMethods.length > 0 ? (
              <span>
                Slayer: {slayerMethods.slice(0, 3).map(slayerLabel).join(", ")}
                {slayerMethods.length > 3 ? ` +${slayerMethods.length - 3}` : ""}
              </span>
            ) : null}
            {slayerMethods.length > 0 && inventionComponents.length > 0 ? " · " : null}
            {inventionComponents.length > 0 ? (
              <span>
                Invention: {inventionComponents.slice(0, 3).map((c) => c.component).join(", ")}
                {inventionComponents.length > 3 ? ` +${inventionComponents.length - 3}` : ""}
              </span>
            ) : null}
          </p>
        )}
        <p className="mt-1.5 text-xs text-parch-300">
          {pinStats.pinned} of {pinStats.total} pinned on the board — the rest are items,
          perks and outfits with no place on Gielinor.
        </p>
        {autoEmpty ? (
          <p className="mt-1.5 text-xs text-parch-300">
            Official auto-complete: none published yet
          </p>
        ) : null}
      </div>

      <div className="panel-body">
        {detail.areas.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {/* Anchored places are buttons so keyboard can light the marker;
                unanchored areas stay text — nothing on the board to focus.
                Sites join the same list, which is what keeps every pin on the
                board keyboard-reachable without a second nav list competing
                with the ledger for accessible names. */}
            {[
              ...new Set([
                ...detail.areas.filter(Boolean),
                ...(PLACES_BY_REGION.get(focus.region) ?? [])
                  .filter((p) => p.site)
                  .map((p) => p.area),
              ]),
            ].map((area) => {
              const isAnchored = anchored.has(area);
              const selected = focus.place === area;
              const lit = selected || focus.hover === area;
              // Selection is the sticky state a click makes, so it gets the ring;
              // hover is a preview and only borrows the colour.
              const chipClass = `rounded-sm border px-1.5 py-0.5 text-xs transition-colors duration-150 ${
                selected
                  ? "border-gem-500 bg-stone-800 text-gem-300"
                  : lit
                    ? "border-transparent bg-stone-800 text-gem-300"
                    : isAnchored
                      ? "border-transparent text-parch-100"
                      : "border-transparent text-parch-300"
              }`;
              if (isAnchored) {
                return (
                  <button
                    key={area}
                    type="button"
                    aria-pressed={selected}
                    onPointerEnter={() => hoverPlace(area)}
                    onPointerLeave={() => hoverPlace(null)}
                    onFocus={() => hoverPlace(area)}
                    onBlur={() => hoverPlace(null)}
                    onClick={() => selectPlace(selected ? null : area)}
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

        {/* Capped and scrolled below lg, where this panel is the page. From lg
            the section itself scrolls, so a second scrollbar here would nest
            inside it. Two columns once there is width for them — beside the
            ledger this panel runs most of the viewport. */}
        <div className="grid max-h-80 gap-4 overflow-y-auto lg:max-h-none lg:overflow-visible">
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
                {rows.map((c) => {
                  // A pinned row is a handle on the board. Pointer-only on
                  // purpose: the chips above are already the keyboard route to
                  // every pin, and a second focusable copy of the same name is
                  // a Playwright strict-mode failure waiting to happen.
                  const pin = pinForHighlight(focus.region, c.name);
                  return (
                  <tr
                    key={c.name}
                    onClick={pin ? () => selectPlace(pin.area === focus.place ? null : pin.area) : undefined}
                    onPointerEnter={pin ? () => hoverPlace(pin.area) : undefined}
                    onPointerLeave={pin ? () => hoverPlace(null) : undefined}
                    data-place={pin ? pin.area : undefined}
                    className={pin ? "cursor-pointer" : undefined}
                  >
                    <td className={pin && pin.area === focus.place ? "text-gem-300" : "text-parch-50"}>
                      {c.name}
                    </td>
                    <td>{c.kind}</td>
                    <td>
                      {c.confidence.startsWith("confirmed") ? (
                        <span className="text-parch-300">confirmed</span>
                      ) : (
                        <span className="tag">inferred</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
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
          <p key={w} className="mt-3 text-xs text-parch-300">
            Note: {w}
          </p>
        ))}

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-stone-800 pt-2">
          {/* Compact live status: name/unlock/sources only. Filters and the
              content table stay outside so chip/select churn is not announced.
              e2e pins section[aria-live] + the sources pattern (must be visible). */}
          <section aria-live="polite" className="num text-xs text-parch-300">
            <span className="sr-only">
              {detail.name}. {UNLOCK_TEXT[detail.availability]}.{" "}
            </span>
            {sourcesLine}
          </section>
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
