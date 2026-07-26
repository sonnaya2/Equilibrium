"use client";

/**
 * Dense quest catalog for League region planning.
 * Source is data/league/quests.json (quests array) — planner region mappings,
 * not official Equilibrium auto-completion. Filter by primary region or
 * recursive required-region group; search by title.
 */

import { useMemo, useState } from "react";
import questsData from "#data/league/quests.json";

type Quest = (typeof questsData.quests)[number];

const QUESTS = questsData.quests as readonly Quest[];

/** Regions that actually appear on rows — includes global / unmapped. */
const REGION_OPTIONS = (() => {
  const seen = new Set<string>();
  for (const q of QUESTS) {
    if (q.primary_region) seen.add(q.primary_region);
    for (const r of q.required_regions ?? []) seen.add(r);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
})();

function regionLabel(id: string): string {
  return id.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function membersLabel(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "yes") return "Members";
  if (v === "no") return "Free";
  return value || "—";
}

function touchesRegion(quest: Quest, region: string): boolean {
  if (quest.primary_region === region) return true;
  return (quest.required_regions ?? []).includes(region);
}

export function QuestBrowser() {
  const [region, setRegion] = useState<string>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return QUESTS.filter((q) => {
      if (region !== "all" && !touchesRegion(q, region)) return false;
      if (needle && !q.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [region, query]);

  return (
    <section className="border-t border-stone-750 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-parch-50">Quests</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
            {questsData.quest_count} Wiki quest-list entries with primary and recursive required
            regions. Planner mappings only — official League auto-completion is a separate overlay.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Filter quests by region"
            className="rounded-sm border border-stone-750 bg-stone-900 px-2 py-1.5 text-sm text-parch-100 focus:border-gem-400"
          >
            <option value="all">All regions</option>
            {REGION_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {regionLabel(id)}
                {id in questsData.region_group_counts
                  ? ` (${(questsData.region_group_counts as Record<string, number>)[id]})`
                  : ""}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search quest name"
            aria-label="Search quests by name"
            className="w-full border border-stone-750 bg-transparent px-3 py-1.5 text-sm text-parch-50 placeholder:text-parch-300/70 focus:border-gem-400 sm:w-56"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-xs text-parch-300">
        <span>
          Snapshot {questsData.snapshot_date}
          {region !== "all" ? ` · ${regionLabel(region)}` : ""}
        </span>
        <span className="num">{rows.length} shown</span>
      </div>

      <div className="panel mt-3 max-h-[min(70vh,40rem)] overflow-auto">
        <table className="data-table">
          <thead className="sticky top-0 bg-stone-850">
            <tr>
              <th>Quest</th>
              <th>Primary</th>
              <th>Series</th>
              <th>Access</th>
              <th>Required regions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-parch-300">
                  Nothing matches those filters.
                </td>
              </tr>
            ) : (
              rows.map((q) => {
                const required = q.required_regions ?? [];
                const extra = required.filter((r) => r !== q.primary_region);
                return (
                  <tr key={q.title}>
                    <td className="text-parch-50">
                      {q.source_url ? (
                        <a
                          href={q.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
                        >
                          {q.title}
                        </a>
                      ) : (
                        q.title
                      )}
                      {q.cross_region ? (
                        <span className="ml-1.5 text-[11px] text-parch-500">cross-region</span>
                      ) : null}
                    </td>
                    <td>{regionLabel(q.primary_region)}</td>
                    <td>{q.series || "—"}</td>
                    <td>{membersLabel(q.members)}</td>
                    <td className="text-xs text-parch-300">
                      {required.length === 0
                        ? "—"
                        : extra.length === 0
                          ? regionLabel(q.primary_region)
                          : `${regionLabel(q.primary_region)} + ${extra.map(regionLabel).join(", ")}`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
