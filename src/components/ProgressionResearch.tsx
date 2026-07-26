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
import { clipProse } from "./ResearchSection";


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
  unresolved_cross_boundary: "Cross-region unclear",
};

/** Nested keys that must never dump into titles or detail bodies. */
const NOISE_KEYS = new Set([
  "id",
  "source_url",
  "source_urls",
  "sourceUrls",
  "source_refs",
  "sourceFile",
  "source_type",
  "secondary_source_url",
  "secondary_source_urls",
  "primary_source_url",
  "region_evidence_url",
  "confidence",
  "recordType",
  "region_status",
  "type",
]);

/** Provenance `source` (URL / SourceReference) is noise; plain labels like boss names stay. */
function isProvenanceSource(value: unknown): boolean {
  if (isSourceRef(value)) return true;
  return typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"));
}
const FIELD_LABELS: Record<string, string> = {
  methods: "Methods",
  target_tags: "Tags",
  planner_value: "Value",
  effect: "Effect",
  effect_summary: "Effect",
  support_item_effect: "Support",
  recommended_unlocks: "Unlocks",
  supporting_regions: "Also needs",
  alternate_region_routes: "Alt routes",
  dependency_note: "Depends on",
  self_source_routes: "Routes",
  region_evidence: "Evidence",
  region_note: "Region note",
  training_rule: "Rule",
  notes: "Notes",
  requirements: "Reqs",
  access_requirement: "Access",
  uniques: "Uniques",
  sources: "Sources",
  alternate_sources: "Also from",
  current_metrics: "Metrics",
  archaeology_level: "Arch",
  monolith_energy: "Energy",
  acquisition: "How",
  level: "Level",
  skills: "Skills",
  drop_rate_on_slayer_task: "On task",
  drop_rate_off_slayer_task: "Off task",
  drop_rate_per_player: "Per player",
  region: "Region",
  source: "From",
};
function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replaceAll("kph", "kills per hour")
    .replaceAll("xp", "XP")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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

function keepEntry(key: string, item: unknown, primary?: string): boolean {
  if (NOISE_KEYS.has(key)) return false;
  if (key === "name" || key === "item" || key === "route" || key === "method") return false;
  if (key === "source") {
    if (isProvenanceSource(item)) return false;
    if (primary && primary === humanString(item)) return false;
  }
  return true;
}

function text(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return clipProse(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 4)
      .map(text)
      .filter(Boolean)
      .join(" · ");
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
  return REGION_LABELS[raw] ?? raw.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rowRegionLabel(row: Row): string {
  if (Array.isArray(row.required_regions) && row.required_regions.length) {
    const list = row.required_regions.map(regionName).join(" + ");
    return row.required_regions.length > 1 ? `Combo: ${list}` : list;
  }

  if (Array.isArray(row.region_candidates) && row.region_candidates.length) {
    return `Could be: ${row.region_candidates.map(regionName).join(" / ")}`;
  }

  if (Array.isArray(row.region_hints) && row.region_hints.length > 1) {
    return `Chain: ${row.region_hints.map(regionName).join(" / ")}`;
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
  if (typeof value === "string" && value.startsWith("https://")) return value;
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("https://")) return url;
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
  return (
    humanString(row.name) ||
    humanString(row.method) ||
    humanString(row.unlock) ||
    humanString(row.relic) ||
    humanString(row.rune) ||
    humanString(row.component) ||
    humanString(row.location) ||
    humanString(row.source) ||
    "—"
  );
}

function rowSubtitle(row: Row): string {
  const title = rowTitle(row);
  // When location is the title, prefer level band under it.
  if (humanString(row.location) === title) {
    return humanString(row.level_range) || humanString(row.category) || "";
  }
  const value =
    humanString(row.location) ||
    humanString(row.category) ||
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
    if (key === "support_item_effect" && humanString(row.support_item_effect) === rowSubtitle(row)) {
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
  return lines.map((l) => clipProse(l)).filter(Boolean).slice(0, 2);
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

      <div role="tablist" aria-label="Progression sections" className="comp-seg mt-2 flex-nowrap overflow-x-auto">
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
                className={`grid gap-1.5 border-b border-stone-750/70 py-2 lg:grid-cols-[minmax(170px,0.28fr)_minmax(0,1fr)] lg:gap-4 ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
              >
                <div className="min-w-0">
                  <h3 className="m-0 text-[14px] font-medium text-parch-50">
                    {rowTitle(row)}
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
                  </h3>
                  {subtitle ? <p className="m-0 mt-0.5 text-[11px] leading-4 text-parch-300">{subtitle}</p> : null}
                  <p className="m-0 mt-0.5 text-[11px] text-parch-400">{rowRegionLabel(row)}</p>
                </div>
                <div className="space-y-0.5 text-[13px] leading-5 text-parch-50">
                  {details.map((detail, detailIndex) => <p key={detailIndex} className="m-0">{detail}</p>)}
                </div>
              </article>
            );
          }) : <p className="py-3 text-[13px] text-parch-300">No matches.</p>}
        </div>
      </div>
    </section>
  );
}
