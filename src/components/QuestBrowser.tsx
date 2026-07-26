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
    <section className="border-t border-stone-750 pt-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Region"
          className="rounded-sm border border-stone-750 bg-stone-900 px-2 py-1.5 text-[13px] text-parch-100 focus:border-gem-400"
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
          placeholder="Search"
          aria-label="Search quests"
          className="w-full border border-stone-750 bg-stone-900 px-2.5 py-1.5 text-[13px] text-parch-50 placeholder:text-parch-400 focus:border-gem-400 sm:w-56"
        />
      </div>

      <div className="py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-parch-400">
          <span>
            {questsData.quest_count} quests · as of {questsData.snapshot_date}
            {region !== "all" ? ` · ${regionLabel(region)}` : ""}
          </span>
          <span className="font-mono">{rows.length} shown</span>
        </div>

        <div className="panel mt-1.5 max-h-[min(70vh,40rem)] overflow-auto">
          <table className="data-table text-[13px] leading-5 [&_td]:py-1.5 [&_th]:py-1.5">
            <thead className="sticky top-0 bg-stone-850">
              <tr>
                <th>Quest</th>
                <th>Primary</th>
                <th>Series</th>
                <th>Access</th>
                <th>Needs</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-parch-300">
                    No matches.
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
                            className="text-gem-300 hover:underline"
                          >
                            {q.title}
                          </a>
                        ) : (
                          q.title
                        )}
                        {q.cross_region ? (
                          <span className="ml-1.5 text-[11px] text-parch-400">cross-region</span>
                        ) : null}
                      </td>
                      <td>{regionLabel(q.primary_region)}</td>
                      <td>{q.series || "—"}</td>
                      <td>{membersLabel(q.members)}</td>
                      <td className="text-parch-300">
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
      </div>
    </section>
  );
}
