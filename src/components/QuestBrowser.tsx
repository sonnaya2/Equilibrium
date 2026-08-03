"use client";

/**
 * Dense quest catalog for League region planning.
 * Source is data/league/quests.json (quests array) - planner region mappings,
 * not official Equilibrium auto-completion. Filter by primary region or
 * recursive required-region group; search by title.
 */

import { useCallback, useMemo, useState } from "react";
import questsData from "#shard/league/quests.json";
import { safeExternalHref } from "@/lib/safeHref";
import { DataTableOrganizeBar, useDataTableOrganize } from "./DataTableOrganize";
import { DataViewHeader, useDataRegion } from "./DataBrowser";

type Quest = (typeof questsData.quests)[number];

const QUESTS = questsData.quests as readonly Quest[];

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
  const required = quest.required_regions ?? [];
  return (
    required.includes(region) ||
    (quest.primary_region === "global" && required.every((id) => id === "global"))
  );
}

export function QuestBrowser() {
  const selectedRegion = useDataRegion();
  const region = selectedRegion?.id ?? "";
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return QUESTS.filter((q) => {
      if (region && !touchesRegion(q, region)) return false;
      if (needle && !q.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [region, query]);

  const labelOf = useCallback((q: Quest) => q.title, []);
  const typeOf = useCallback((q: Quest) => membersLabel(q.members), []);
  const {
    dir,
    toggleDir,
    typeOptions,
    activeTypes,
    toggleType,
    clearTypes,
    organized: rows,
  } = useDataTableOrganize({ rows: filtered, labelOf, typeOf });

  return (
    <section className="data-record-view">
      <DataViewHeader title="Quests" count={rows.length} countLabel="quests">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search quests"
          className="ui-field data-view-search"
        />
        <DataTableOrganizeBar
          dir={dir}
          onToggleDir={toggleDir}
          typeOptions={typeOptions}
          activeTypes={activeTypes}
          onToggleType={toggleType}
          onClearTypes={clearTypes}
          typeLabel="Access"
        />
      </DataViewHeader>

      <div className="panel data-record-surface data-quest-surface overflow-auto">
        <table className="data-table data-quest-table">
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
                  {query
                    ? "Nothing matches."
                    : `No quests in ${selectedRegion?.name ?? "this region"}.`}
                </td>
              </tr>
            ) : (
              rows.map((q) => {
                const required = q.required_regions ?? [];
                const extra = required.filter((r) => r !== q.primary_region);
                const sourceHref = safeExternalHref(q.source_url);
                return (
                  <tr key={q.title}>
                    <td className="text-parch-50">
                      {sourceHref ? (
                        <a
                          href={sourceHref}
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
                        <span className="ml-1.5 text-[12px] text-parch-400">cross-region</span>
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
    </section>
  );
}
