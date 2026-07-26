"use client";

import { useMemo, useState } from "react";
import {
  getAllRegionalUniqueDrops,
  getArchaeologyCombatRelics,
  getArchaeologyProgression,
  getCombatTrainingSpots,
  getInventionComponentSources,
  getInventionProgression,
  getRunecraftingAltars,
  getSupportUniqueDropOverlay,
} from "@/research/plannerExpansions";
import { confidenceLabel } from "@/components/researchStatus";

type Row = Record<string, unknown>;
type SectionKey =
  | "combat_training_spots"
  | "runecrafting_altars"
  | "invention_progression"
  | "invention_component_sources"
  | "archaeology_progression"
  | "archaeology_combat_relics"
  | "regional_unique_drops";

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "combat_training_spots", label: "Combat spots" },
  { key: "runecrafting_altars", label: "Runecrafting" },
  { key: "invention_progression", label: "Invention" },
  { key: "invention_component_sources", label: "Components" },
  { key: "archaeology_progression", label: "Archaeology" },
  { key: "archaeology_combat_relics", label: "Arch relics" },
  { key: "regional_unique_drops", label: "Unique drops" },
];

/** Section loaders via plannerExpansions typed getters (not raw JSON). */
const BASE: Record<SectionKey, () => Row[]> = {
  combat_training_spots: () => getCombatTrainingSpots() as unknown as Row[],
  runecrafting_altars: () => getRunecraftingAltars() as unknown as Row[],
  invention_progression: () => getInventionProgression() as unknown as Row[],
  invention_component_sources: () => getInventionComponentSources() as unknown as Row[],
  archaeology_progression: () => getArchaeologyProgression() as unknown as Row[],
  archaeology_combat_relics: () => getArchaeologyCombatRelics() as unknown as Row[],
  regional_unique_drops: () => getAllRegionalUniqueDrops() as unknown as Row[],
};

// Overlay only — base unique drops come from getAllRegionalUniqueDrops.
const SUPPLEMENTS: Record<SectionKey, Row[]> = {
  combat_training_spots: [],
  runecrafting_altars: [],
  invention_progression: [],
  invention_component_sources: [],
  archaeology_progression: [],
  archaeology_combat_relics: [],
  regional_unique_drops: getSupportUniqueDropOverlay() as unknown as Row[],
};

const REGION_LABELS: Record<string, string> = {
  global_if_materials_available: "Global if supplied",
  global_once_unlocked: "Global once unlocked",
  not_mapped_yet: "Unmapped",
  unresolved: "Unresolved",
  unresolved_cross_boundary: "Cross-boundary unresolved",
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

function regionName(value: unknown): string {
  const raw = String(value ?? "").toLowerCase();
  return REGION_LABELS[raw] ?? raw.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rowRegionLabel(row: Row): string {
  if (Array.isArray(row.required_regions) && row.required_regions.length) {
    const list = row.required_regions.map(regionName).join(" + ");
    return row.required_regions.length > 1 ? `Combo: ${list}` : list;
  }

  if (Array.isArray(row.region_candidates) && row.region_candidates.length) {
    return `Unresolved: ${row.region_candidates.map(regionName).join(" / ")}`;
  }

  if (Array.isArray(row.region_hints) && row.region_hints.length > 1) {
    return `Chain: ${row.region_hints.map(regionName).join(" / ")}`;
  }

  const direct = row.region || row.acquisition_region || row.region_hint;
  if (!direct) return "—";
  return regionName(direct);
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
    ...(Array.isArray(row.source_urls) ? row.source_urls : []),
    ...(Array.isArray(row.secondary_source_urls) ? row.secondary_source_urls : []),
  ];
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.startsWith("https://")))];
}

function rowTitle(row: Row): string {
  return text(row.name || row.method || row.unlock || row.relic || row.rune || row.component || row.source || row.location || "Entry");
}

function rowSubtitle(row: Row): string {
  const value = text(row.location || row.category || row.level_range || row.effect_summary || row.support_item_effect || row.region_reason || row.source);
  return value === rowTitle(row) ? "" : value;
}

function rowDetails(row: Row): string[] {
  const details = [
    row.methods,
    row.target_tags ? { target_tags: row.target_tags } : null,
    row.planner_value,
    row.effect,
    row.support_item_effect,
    row.recommended_unlocks ? { recommended_unlocks: row.recommended_unlocks } : null,
    row.supporting_regions ? { supporting_regions: row.supporting_regions } : null,
    row.alternate_region_routes ? { alternate_region_routes: row.alternate_region_routes } : null,
    row.dependency_note,
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
  const base = BASE[section]();
  const rows = new Map<string, Row>();
  // Base first, then supplements — on id collision the newer supplement wins.
  for (const row of base) rows.set(String(row.id || rowTitle(row)), row);
  for (const row of SUPPLEMENTS[section]) rows.set(String(row.id || rowTitle(row)), row);
  return [...rows.values()];
}

export function ProgressionResearch() {
  const [section, setSection] = useState<SectionKey>("combat_training_spots");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = rowsFor(section);
    if (!needle) return source;
    return source.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [query, section]);

  return (
    <section className="border-t border-stone-750 pt-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search progression"
          className="w-full border border-stone-750 bg-stone-900 px-2.5 py-1.5 text-[13px] text-parch-50 placeholder:text-parch-400 focus:border-gem-400 sm:w-56"
        />
      </div>

      <div role="tablist" aria-label="Progression sections" className="comp-seg mt-2 overflow-x-auto">
        {SECTIONS.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(item.key)}
              className={`comp-seg__btn${active ? " is-active" : ""}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="py-2">
        <div className="flex justify-end">
          <span className="font-mono text-[11px] text-parch-400">{rows.length} shown</span>
        </div>

        <div className="mt-1.5 border-t border-stone-750">
          {rows.length ? rows.map((row, index) => {
            const rowLinks = sourceLinks(row);
            const details = rowDetails(row);
            const subtitle = rowSubtitle(row);
            return (
              <article
                key={String(row.id || `${rowTitle(row)}-${index}`)}
                className={`grid gap-1.5 border-b border-stone-750/70 py-2 lg:grid-cols-[minmax(170px,0.28fr)_minmax(0,1fr)_140px] lg:gap-4 ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
              >
                <div className="min-w-0">
                  <h3 className="m-0 text-[14px] font-medium text-parch-50">{rowTitle(row)}</h3>
                  {subtitle ? <p className="m-0 mt-0.5 text-[11px] leading-4 text-parch-300">{subtitle}</p> : null}
                  <p className="m-0 mt-0.5 text-[11px] text-parch-400">{rowRegionLabel(row)}</p>
                </div>
                <div className="space-y-0.5 text-[13px] leading-5 text-parch-50">
                  {details.map((detail, detailIndex) => <p key={detailIndex} className="m-0">{detail}</p>)}
                </div>
                <div className="text-[11px] lg:text-right">
                  <div className="text-parch-300">{confidenceLabel(row.confidence)}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 lg:justify-end">
                    {rowLinks.map((url, linkIndex) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-gem-300 hover:underline">
                        {linkIndex === 0 ? sourceName(url) : `Source ${linkIndex + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            );
          }) : <p className="py-3 text-[13px] text-parch-300">No matches.</p>}
        </div>
      </div>
    </section>
  );
}
