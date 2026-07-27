"use client";

import { useCallback, useMemo, useState } from "react";
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
import { GameIcon } from "@/components/GameIcon";
import { dataEntityIconPath } from "@/lib/gameArt";
import { presentInterestMeta, presentInterestName } from "@/lib/dataContentPresentation";
import { safeExternalHref } from "@/lib/safeHref";
import { DataTableOrganizeBar, useDataTableOrganize } from "./DataTableOrganize";
import { clipProse, researchRowMatchesRegion } from "./ResearchSection";
import { DataViewHeader, useDataRegion } from "./DataWorkbench";
import { PROGRESSION_SYSTEM_TABS } from "./ProgressionSystemsResearch";

type Row = Record<string, unknown>;
type SectionKey =
  | "combat_training_spots"
  | "runecrafting_altars"
  | "invention_progression"
  | "invention_component_sources"
  | "archaeology_progression"
  | "archaeology_combat_relics"
  | "regional_unique_drops";

const SYSTEM_TABS = PROGRESSION_SYSTEM_TABS.filter((tab) => tab.key !== "archaeology");

const SECTIONS: Array<{ key: string; label: string }> = [
  { key: "combat_training_spots", label: "Combat spots" },
  { key: "runecrafting_altars", label: "Runecrafting" },
  { key: "invention_progression", label: "Invention" },
  { key: "invention_component_sources", label: "Components" },
  { key: "archaeology_progression", label: "Archaeology" },
  { key: "archaeology_combat_relics", label: "Arch relics" },
  { key: "regional_unique_drops", label: "Uniques" },
  ...SYSTEM_TABS.map((tab) => ({
    key: `system-${tab.key}`,
    label: tab.label,
  })),
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
  global_if_materials_available: "Any region if supplied",
  global_once_unlocked: "Any region once unlocked",
  not_mapped_yet: "Unmapped",
  unresolved: "Unresolved",
  unresolved_cross_boundary: "Cross-region?",
};

/** Plain player-facing string — never a URL, never a SourceReference dump. */
function humanString(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("https://") || trimmed.startsWith("http://")) return "";
  return trimmed;
}

function isSourceRef(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Row;
  return typeof row.url === "string" || (typeof row.source === "string" && "verifiedAt" in row);
}

function text(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return clipProse(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 4).map(text).filter(Boolean).join(" · ");
  }
  if (typeof value === "object") {
    if (isSourceRef(value)) return "";
    const row = value as Row;
    const primary =
      humanString(row.name) ||
      humanString(row.item) ||
      humanString(row.route) ||
      humanString(row.method);
    if (primary) return clipProse(primary, 80);
    return "";
  }
  return String(value);
}
function regionName(value: unknown): string {
  const raw = String(value ?? "").toLowerCase();
  return (
    REGION_LABELS[raw] ??
    raw.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function rowRegionLabel(row: Row): string {
  if (Array.isArray(row.required_regions) && row.required_regions.length) {
    const list = row.required_regions.map(regionName).join(" + ");
    return row.required_regions.length > 1 ? `Combo ${list}` : list;
  }

  if (Array.isArray(row.region_candidates) && row.region_candidates.length) {
    return `Maybe ${row.region_candidates.map(regionName).join(" / ")}`;
  }

  if (Array.isArray(row.region_hints) && row.region_hints.length > 1) {
    return `Chain ${row.region_hints.map(regionName).join(" / ")}`;
  }

  if (Array.isArray(row.acquisition_regions) && row.acquisition_regions.length) {
    return `From ${row.acquisition_regions.map(regionName).join(" / ")}`;
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

function pullUrl(value: unknown): string | null {
  if (typeof value === "string") return safeExternalHref(value);
  if (value && typeof value === "object" && "url" in value) {
    return safeExternalHref((value as { url?: unknown }).url);
  }
  return null;
}

function sourceLinks(row: Row): string[] {
  const raw: unknown[] = [
    row.source,
    row.source_url,
    row.primary_source_url,
    row.secondary_source_url,
    row.region_evidence_url,
    ...(Array.isArray(row.source_urls) ? row.source_urls : []),
    ...(Array.isArray(row.sourceUrls) ? row.sourceUrls : []),
    ...(Array.isArray(row.secondary_source_urls) ? row.secondary_source_urls : []),
    ...(Array.isArray(row.source_refs) ? row.source_refs : []),
  ];
  const out: string[] = [];
  for (const item of raw) {
    const url = pullUrl(item);
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

function rowTitle(row: Row): string {
  // Prefer explicit names. Plain-string `source` is the drop-source boss label on unique-drop rows
  // (never a SourceReference — those are objects and are filtered by humanString).
  // presentInterestName only trims planner hub suffixes; icons still resolve from raw row.name.
  const raw =
    humanString(row.name) ||
    humanString(row.method) ||
    humanString(row.unlock) ||
    humanString(row.relic) ||
    humanString(row.rune) ||
    humanString(row.component) ||
    humanString(row.location) ||
    humanString(row.source) ||
    "";
  if (!raw) return "—";
  return presentInterestName(raw) || raw;
}

function rowSubtitle(row: Row): string {
  const title = rowTitle(row);
  const rawName = humanString(row.name);
  // When location is the title, prefer level band under it.
  if (humanString(row.location) === title || humanString(row.location) === rawName) {
    return humanString(row.level_range) || presentInterestMeta(humanString(row.category), 80) || "";
  }
  const location = humanString(row.location);
  if (location && location !== title && location !== rawName) {
    return clipProse(location, 80);
  }
  const category = humanString(row.category);
  if (category) {
    const meta = presentInterestMeta(category, 80);
    if (meta && meta !== title) return meta;
  }
  const value =
    humanString(row.level_range) ||
    humanString(row.effect_summary) ||
    humanString(row.support_item_effect) ||
    humanString(row.region_reason);
  if (!value || value === title) return "";
  return clipProse(value, 80);
}
const DETAIL_FIELDS: Array<{ key: string; label: string }> = [
  { key: "methods", label: "Methods" },
  { key: "target_tags", label: "Tags" },
  { key: "planner_value", label: "Value" },
  { key: "effect", label: "Effect" },
  { key: "effect_summary", label: "Effect" },
  { key: "support_item_effect", label: "Support" },
  { key: "recommended_unlocks", label: "Unlocks" },
  { key: "supporting_regions", label: "Also needs" },
  { key: "alternate_region_routes", label: "Alt routes" },
  { key: "dependency_note", label: "Depends on" },
  { key: "self_source_routes", label: "Routes" },
  { key: "region_evidence", label: "Why" },
  { key: "region_note", label: "Region" },
  { key: "training_rule", label: "How" },
  { key: "notes", label: "Notes" },
  { key: "requirements", label: "Reqs" },
  { key: "access_requirement", label: "Access" },
  { key: "uniques", label: "Uniques" },
  { key: "sources", label: "Sources" },
  { key: "alternate_sources", label: "Also from" },
  { key: "current_metrics", label: "Metrics" },
  { key: "archaeology_level", label: "Arch" },
  { key: "monolith_energy", label: "Energy" },
  { key: "acquisition", label: "How" },
  { key: "level", label: "Level" },
  { key: "effects", label: "Effects" },
];

function rowDetails(row: Row): string[] {
  const lines: string[] = [];
  for (const { key, label } of DETAIL_FIELDS) {
    if (lines.length >= 2) break;
    if (
      key === "support_item_effect" &&
      humanString(row.support_item_effect) === rowSubtitle(row)
    ) {
      continue;
    }
    if (key === "effect_summary" && humanString(row.effect_summary) === rowSubtitle(row)) {
      continue;
    }
    const rendered = text(row[key]);
    if (!rendered) continue;
    lines.push(
      typeof row[key] === "string" && rendered.length > 48 ? rendered : `${label}: ${rendered}`,
    );
  }
  return lines
    .map((l) => clipProse(l))
    .filter(Boolean)
    .slice(0, 2);
}

function rowsFor(section: string): Row[] {
  const system = SYSTEM_TABS.find((tab) => `system-${tab.key}` === section);
  if (system) return system.rows as Row[];

  const key = section as SectionKey;
  const base = BASE[key]();
  const rows = new Map<string, Row>();
  // Base first, then supplements — on id collision the newer supplement wins.
  for (const row of base) rows.set(String(row.id || rowTitle(row)), row);
  for (const row of SUPPLEMENTS[key]) rows.set(String(row.id || rowTitle(row)), row);
  if (key === "archaeology_combat_relics") {
    const relics = PROGRESSION_SYSTEM_TABS.find((tab) => tab.key === "archaeology")?.rows ?? [];
    for (const row of relics as Row[]) rows.set(String(row.id || rowTitle(row)), row);
  }
  return [...rows.values()];
}

export function ProgressionResearch() {
  const selectedRegion = useDataRegion();
  const [section, setSection] = useState("combat_training_spots");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = rowsFor(section).filter((row) => researchRowMatchesRegion(row, selectedRegion));
    if (!needle) return source;
    return source.filter((row) => {
      const hay = [
        rowTitle(row),
        rowSubtitle(row),
        rowRegionLabel(row),
        ...rowDetails(row),
        ...sourceLinks(row),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [query, section, selectedRegion]);
  const labelOf = useCallback((row: Row) => rowTitle(row), []);
  const typeOf = useCallback(
    (row: Row) =>
      humanString(row.category) ||
      humanString(row.kind) ||
      humanString(row.recordType) ||
      humanString(row.skill) ||
      "—",
    [],
  );
  const {
    dir,
    toggleDir,
    typeOptions,
    activeTypes,
    toggleType,
    clearTypes,
    organized: rows,
  } = useDataTableOrganize({ rows: filtered, labelOf, typeOf });
  const sectionLabel = SECTIONS.find((item) => item.key === section)?.label ?? "Progression";

  return (
    <section className="data-progression">
      <DataViewHeader title="Progression" count={rows.length} countLabel="routes">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search progression"
          className="field-inset data-view-search"
        />
        <DataTableOrganizeBar
          dir={dir}
          onToggleDir={toggleDir}
          typeOptions={typeOptions}
          activeTypes={activeTypes}
          onToggleType={toggleType}
          onClearTypes={clearTypes}
        />
      </DataViewHeader>

      <div
        role="tablist"
        aria-label="Progression sections"
        className="comp-seg data-progression__tabs"
      >
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

      <div className="data-progression__body">
        <div className="data-ledger-head" aria-hidden="true">
          <span>Name</span>
          <span>Regions</span>
          <span>Notes</span>
        </div>

        <div className="data-progression__list">
          {rows.length ? (
            rows.map((row, index) => {
              const rowLinks = sourceLinks(row);
              const details = rowDetails(row);
              const subtitle = rowSubtitle(row);
              const heading = rowTitle(row);
              const rawName =
                humanString(row.name) ||
                humanString(row.method) ||
                humanString(row.unlock) ||
                (heading !== "—" ? heading : "");
              const iconSrc = dataEntityIconPath({
                name: rawName || null,
                kind: String(row.recordType || row.category || row.kind || ""),
                id: row.id != null ? String(row.id) : null,
              });
              return (
                <article
                  key={String(row.id || `${heading}-${index}`)}
                  className={`data-progression__row${index % 2 === 1 ? " is-zebra" : ""}`}
                >
                  <div className="data-progression__identity data-record-row__identity">
                    <span
                      className={
                        iconSrc ? "data-icon-well" : "data-icon-well data-icon-well--empty"
                      }
                    >
                      {iconSrc ? <GameIcon src={iconSrc} size={24} /> : null}
                    </span>
                    <div className="data-record-row__copy min-w-0">
                      <h4>
                        {heading}
                        {rowLinks.length ? (
                          <span className="ml-1.5 font-normal">
                            {rowLinks.map((url, linkIndex) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gem-300 hover:underline"
                              >
                                {linkIndex > 0 ? " · " : "· "}
                                {sourceName(url)}
                              </a>
                            ))}
                          </span>
                        ) : null}
                      </h4>
                      {subtitle ? <p>{subtitle}</p> : null}
                    </div>
                  </div>
                  <p className="data-progression__region">{rowRegionLabel(row)}</p>
                  <div className="data-progression__details">
                    {details.map((detail, detailIndex) => (
                      <p key={detailIndex} className="m-0">
                        {detail}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="data-empty">
              {query
                ? "Nothing matches."
                : `No ${sectionLabel.toLowerCase()} in ${selectedRegion?.name ?? "this region"}.`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
