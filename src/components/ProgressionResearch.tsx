"use client";

import { useMemo, useState } from "react";
import plannerData from "../../data/research/planner-expansions.json";
import supportItems from "../../data/research/planner-support-items-2026-07-25.json";

type Row = Record<string, unknown>;
type SectionKey =
  | "combat_training_spots"
  | "runecrafting_altars"
  | "invention_progression"
  | "invention_component_sources"
  | "archaeology_progression"
  | "archaeology_combat_relics"
  | "regional_unique_drops";

const SECTIONS: Array<{ key: SectionKey; label: string; description: string }> = [
  { key: "combat_training_spots", label: "Combat spots", description: "Current method candidates without recycling stale combat XP tables." },
  { key: "runecrafting_altars", label: "Runecrafting", description: "Altar locations, levels and the access that can make a region matter." },
  { key: "invention_progression", label: "Invention", description: "Unlock milestones and the routes needed to reach them." },
  { key: "invention_component_sources", label: "Components", description: "Region-sensitive component supply for a self-sufficient account." },
  { key: "archaeology_progression", label: "Archaeology", description: "Dig sites, qualifications and progression gates." },
  { key: "archaeology_combat_relics", label: "Arch relics", description: "Combat relic milestones. Unmapped acquisition regions stay unmapped." },
  { key: "regional_unique_drops", label: "Unique drops", description: "Notable reward and support-item chains that can change the value of a region pick." },
];

const SUPPLEMENTS: Record<SectionKey, Row[]> = {
  combat_training_spots: [],
  runecrafting_altars: [],
  invention_progression: [],
  invention_component_sources: [],
  archaeology_progression: [],
  archaeology_combat_relics: [],
  regional_unique_drops: supportItems.regional_unique_drops as unknown as Row[],
};

const REGION_LABELS: Record<string, string> = {
  global_if_materials_available: "Global if supplied",
  global_once_unlocked: "Global once unlocked",
  not_mapped_yet: "Region not mapped",
  unresolved: "Region unresolved",
};

function fieldLabel(value: string): string {
  return value
    .replaceAll("kph", "kills per hour")
    .replaceAll("xp", "XP")
    .replaceAll("_", " ");
}

function text(value: unknown): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    return Object.entries(value as Row)
      .map(([key, item]) => `${fieldLabel(key)}: ${text(item)}`)
      .join(" · ");
  }
  return String(value);
}

function regionLabel(value: unknown): string {
  const raw = text(value).toLowerCase();
  if (!raw) return "No region set";
  return REGION_LABELS[raw] ?? raw.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(value: unknown): string {
  const raw = text(value).toLowerCase();
  if (!raw) return "Not checked";
  if (raw.includes("unresolved") || raw.includes("pending")) return "Still unresolved";
  if (raw.includes("historical") || raw.includes("working_") || raw.includes("inferred")) return "Working region map";
  if (raw.includes("pvme") && raw.includes("no_xp")) return "Current method; no XP claim";
  if (raw.includes("pvme")) return "PvME method";
  if (raw.includes("official")) return "Jagex checked";
  if (raw.includes("wiki") || raw.includes("confirmed")) return "Wiki checked";
  return "Needs review";
}

function sourceName(url: string): string {
  if (url.includes("pvme.io")) return "PvME";
  if (url.includes("runescape.wiki")) return "Wiki";
  if (url.includes("runescape.com")) return "Jagex";
  if (url.includes("rs-analysis")) return "RS Analysis";
  return "Source";
}

function sourceLinks(row: Row): string[] {
  const values = [
    row.source_url,
    row.secondary_source_url,
    row.region_evidence_url,
    ...(Array.isArray(row.secondary_source_urls) ? row.secondary_source_urls : []),
  ];
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.startsWith("https://")))];
}

function rowTitle(row: Row): string {
  return text(row.name || row.method || row.unlock || row.relic || row.rune || row.component || row.source || "Entry");
}

function rowSubtitle(row: Row): string {
  return text(row.location || row.category || row.level_range || row.effect_summary || row.support_item_effect || row.region_reason || row.source);
}

function rowDetails(row: Row): string[] {
  const details = [
    row.methods,
    row.planner_value,
    row.effect,
    row.support_item_effect,
    row.self_source_routes,
    row.region_evidence,
    row.training_rule,
    row.notes,
    row.requirements,
    row.access_requirement,
    row.uniques,
    row.sources,
    row.current_metrics,
  ];
  return details.map(text).filter(Boolean);
}

function rowsFor(section: SectionKey): Row[] {
  const base = plannerData[section] as unknown as Row[];
  const rows = new Map<string, Row>();
  for (const row of SUPPLEMENTS[section]) rows.set(String(row.id || rowTitle(row)), row);
  for (const row of base) rows.set(String(row.id || rowTitle(row)), row);
  return [...rows.values()];
}

export function ProgressionResearch() {
  const [section, setSection] = useState<SectionKey>("combat_training_spots");
  const [query, setQuery] = useState("");
  const selected = SECTIONS.find((item) => item.key === section) ?? SECTIONS[0];

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = rowsFor(section);
    if (!needle) return source;
    return source.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [query, section]);

  return (
    <section className="border-t border-stone-750 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-parch-50">Progression research</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
            Region-sensitive methods and unlock chains that do not fit cleanly in the skill catalog. Base-game access and League exceptions stay separate.
          </p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search progression"
          aria-label="Search progression research"
          className="w-full border border-stone-750 bg-transparent px-3 py-2 text-sm text-parch-50 outline-none placeholder:text-parch-300/70 focus:border-parch-300 sm:w-64"
        />
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-stone-750 pb-px">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs ${section === item.key ? "border-parch-50 text-parch-50" : "border-transparent text-parch-300 hover:text-parch-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm leading-6 text-parch-300">{selected.description}</p>
          <span className="text-xs text-parch-300">{rows.length} shown</span>
        </div>

        <div className="mt-3 border-t border-stone-750">
          {rows.length ? rows.map((row, index) => {
            const links = sourceLinks(row);
            const details = rowDetails(row);
            return (
              <article key={String(row.id || `${rowTitle(row)}-${index}`)} className="grid gap-2 border-b border-stone-750/70 py-4 lg:grid-cols-[minmax(180px,0.28fr)_minmax(0,1fr)_150px] lg:gap-6">
                <div>
                  <h3 className="text-sm font-medium text-parch-50">{rowTitle(row)}</h3>
                  {rowSubtitle(row) ? <p className="mt-1 text-xs leading-5 text-parch-300">{rowSubtitle(row)}</p> : null}
                  <p className="mt-1 text-[11px] text-parch-300/80">{regionLabel(row.region || row.acquisition_region)}</p>
                </div>
                <div className="space-y-1 text-xs leading-5 text-parch-300">
                  {details.length ? details.map((detail, detailIndex) => <p key={detailIndex}>{detail}</p>) : <p>No extra detail listed.</p>}
                </div>
                <div className="text-xs lg:text-right">
                  <div className="text-parch-300">{statusLabel(row.confidence)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 lg:justify-end">
                    {links.map((url, linkIndex) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300">
                        {linkIndex === 0 ? sourceName(url) : `Source ${linkIndex + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            );
          }) : <p className="py-5 text-sm text-parch-300">Nothing matches that search.</p>}
        </div>
      </div>
    </section>
  );
}
