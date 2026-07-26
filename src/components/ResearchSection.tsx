"use client";

import { useMemo, useState } from "react";

export type ResearchRow = Record<string, unknown>;

export interface ResearchTab {
  key: string;
  label: string;
  /** Optional one-liner under the tab; omit or "" when the label is enough. */
  description?: string;
  rows: ResearchRow[];
}

/**
 * Keys that never become detail lines: identity, region-combo plumbing,
 * provenance, and meta status. Region display uses its own helpers.
 */
const STRUCTURAL_KEYS = new Set([
  "id",
  "name",
  "category",
  "location",
  "region",
  "regionId",
  "region_hint",
  "region_hints",
  "regionHints",
  "region_status",
  "region_candidates",
  "region_pressure",
  "regionRequirementType",
  "collector_region",
  "collector_regions",
  "acquisition_region",
  "working_region",
  "required_region",
  "required_regions",
  "requiredRegions",
  "required_regions_for_collection_loop",
  "artifact_regions",
  "region_options",
  "acquisition_regions",
  "planner_default_region",
  "comboLabel",
  "isRegionCombo",
  "entry_side",
  "final_arena_side",
  "destination_side",
  "content",
  "component",
  "step",
  "relic",
  "relic_power",
  "monster",
  "collection",
  "perk",
  "source",
  "source_url",
  "source_urls",
  "sourceUrls",
  "source_refs",
  "secondary_source_url",
  "secondary_source_urls",
  "primary_source_url",
  "region_source_url",
  "sourceFile",
  "sourceFiles",
  "source_file",
  "source_policy",
  "source_type",
  "sourceType",
  "recordType",
  "confidence",
  "status",
  "freshness",
  "verified",
  "verifiedAt",
  "verified_at",
  "revision",
  "publishedAt",
  "published_at",
  "snapshot_date",
  "snapshotDate",
  "purpose",
  "policy",
  "modeled",
  "gapAction",
  "gap_action",
  "optionalRegions",
  "allRegions",
  "skills",
  "regions",
  "hard_region_requirement",
  "hardRegionRequirement",
]);

/** Nested object keys to strip when rendering object values. */
const NESTED_SKIP = new Set([
  "id",
  "source",
  "source_url",
  "source_urls",
  "sourceUrls",
  "source_refs",
  "secondary_source_url",
  "secondary_source_urls",
  "primary_source_url",
  "region_source_url",
  "sourceFile",
  "source_file",
  "source_type",
  "sourceType",
  "recordType",
  "confidence",
  "status",
  "freshness",
  "verified",
  "verifiedAt",
  "verified_at",
  "revision",
  "publishedAt",
  "published_at",
  "url",
  "type",
]);

/** Prefer these as bare lead sentences (no "Detail:" label). */
const LEAD_KEYS = ["detail", "description", "summary"] as const;

/** Always considered after the lead even when detail is present. */
const REQ_KEYS = ["requirements", "access_requirements", "access_requirement"] as const;

/**
 * Known useful body fields when detail/description is empty.
 * Order is display order. Unknown remaining keys still append after these.
 */
const KNOWN_BODY_KEYS = [
  "league_note",
  "requirements",
  "access_requirements",
  "access_requirement",
  "quest_dependencies",
  "dependency_notes",
  "dependency_note",
  "effect",
  "effects",
  "effect_summary",
  "relic_effect_summary",
  "support_item_effect",
  "planner_value",
  "pvme_position",
  "notes",
  "note",
  "reason",
  "why",
  "region_reason",
  "role",
  "method",
  "methods",
  "unlock",
  "unlocks",
  "rewards",
  "acquisition",
  "acquisition_routes",
  "recipe",
  "recipes",
  "representative_recipe",
  "recipe_result",
  "important_combinations",
  "materials",
  "material",
  "components",
  "component_sources",
  "source_items",
  "source_content",
  "source_routes",
  "desirable_drops",
  "current_metrics",
  "locations",
  "location_detail",
  "dig_sites",
  "dig_site",
  "dig_site_requirements",
  "collector",
  "first_reward",
  "monolith_energy",
  "archaeology_level",
  "slayer_level",
  "combat_level",
  "level",
  "tier",
  "quantity",
  "yield_each",
  "wield_requirement",
  "crafting_requirement",
  "officially_confirmed_path",
  "secondary_candidate_path",
  "promotion_rule",
  "correction",
  "stale_reason",
  "replacement",
  "recommended",
  "alternative",
  "alternatives",
  "chronotes",
  "cost",
  "kills_per_hour",
  "kph",
  "xp_per_hour",
  "release_date",
  "frequency",
  "duration",
  "adrenaline",
  "heal",
  "dose",
  "doses",
  "stack",
  "style",
  "styles",
  "gear",
  "setup",
  "rotation",
  "warning",
  "how",
  "where",
  "chain",
  "step_order",
  "order",
  "amount",
  "rate",
  "gp_per_hour",
  "xp",
  "experience",
  "gizmo",
  "rank",
  "ranks",
  "perks",
  "task",
  "tasks",
  "assignment",
  "monsters",
  "production",
  "supply",
  "bottleneck",
  "priority",
  "value",
  "wiki_note",
] as const;

/** Short player-facing labels for research detail keys. Unknown keys title-case. */
const FIELD_LABELS: Record<string, string> = {
  archaeology_level: "Arch level",
  collector: "Collector",
  first_reward: "First reward",
  relic_effect_summary: "Effect",
  effect_summary: "Effect",
  support_item_effect: "Support effect",
  monolith_energy: "Energy",
  dig_sites: "Dig sites",
  dig_site: "Dig site",
  dig_site_requirements: "Dig reqs",
  planner_value: "Value",
  release_date: "Released",
  officially_confirmed_path: "Path",
  secondary_candidate_path: "Also try",
  promotion_rule: "Note",
  region_reason: "Why",
  pvme_position: "PvME",
  kills_per_hour: "KPH",
  kph: "KPH",
  xp_per_hour: "XP/hr",
  notes: "Notes",
  note: "Note",
  league_note: "League",
  requirements: "Reqs",
  access_requirements: "Access",
  access_requirement: "Access",
  quest_dependencies: "Quests",
  dependency_notes: "Depends on",
  dependency_note: "Depends on",
  method: "Method",
  methods: "Methods",
  unlock: "Unlock",
  unlocks: "Unlocks",
  rewards: "Rewards",
  cost: "Cost",
  materials: "Mats",
  material: "Mat",
  components: "Components",
  component_sources: "Sources",
  source_items: "From",
  source_content: "Content",
  source_routes: "Routes",
  gizmo: "Gizmo",
  recipe: "Recipe",
  recipes: "Recipes",
  representative_recipe: "Recipe",
  recipe_result: "Result",
  important_combinations: "Combos",
  perk: "Perk",
  perks: "Perks",
  rank: "Rank",
  ranks: "Ranks",
  level: "Level",
  slayer_level: "Slayer",
  combat_level: "Combat",
  style: "Style",
  styles: "Styles",
  gear: "Gear",
  setup: "Setup",
  rotation: "Rotation",
  frequency: "How often",
  duration: "Duration",
  effect: "Effect",
  effects: "Effects",
  summary: "Summary",
  description: "Detail",
  detail: "Detail",
  acquisition: "How to get",
  acquisition_routes: "Routes",
  production: "Make",
  stack: "Stack",
  dose: "Dose",
  doses: "Doses",
  heal: "Heal",
  adrenaline: "Adren",
  poison: "Poison",
  bomb: "Bomb",
  overload: "Overload",
  tier: "Tier",
  type: "Type",
  reason: "Why",
  why: "Why",
  value: "Value",
  priority: "Priority",
  bottleneck: "Bottleneck",
  supply: "Supply",
  sources: "Sources",
  wiki_note: "Wiki",
  correction: "Fix",
  stale_reason: "Why stale",
  replacement: "Use instead",
  recommended: "Rec",
  alternative: "Alt",
  alternatives: "Alts",
  monsters: "Monsters",
  task: "Task",
  tasks: "Tasks",
  assignment: "Assignment",
  location_detail: "Where",
  locations: "Where",
  where: "Where",
  how: "How",
  chain: "Chain",
  step_order: "Step",
  order: "Order",
  quantity: "Qty",
  amount: "Amount",
  yield_each: "Yield",
  rate: "Rate",
  gp_per_hour: "GP/hr",
  xp: "XP",
  experience: "XP",
  desirable_drops: "Drops",
  current_metrics: "Metrics",
  wield_requirement: "Wield",
  crafting_requirement: "Craft",
  chronotes: "Chronotes",
  warning: "Warning",
  role: "Role",
};

function fieldLabel(value: string): string {
  if (FIELD_LABELS[value]) return FIELD_LABELS[value];
  const cleaned = value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bkph\b/gi, "KPH")
    .replace(/\bxp\b/gi, "XP")
    .replace(/\s+/g, " ")
    .trim();
  // Title-case; trim long underscore dumps to first three words.
  if (cleaned.length > 28) {
    const short = cleaned.split(" ").slice(0, 3).join(" ");
    return short.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSourceRef(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as ResearchRow;
  if (typeof row.url === "string" && row.url.startsWith("https://")) return true;
  // SourceKind + optional url envelope without forcing https on every fixture.
  if (typeof row.source === "string" && ("url" in row || "verifiedAt" in row || "verified_at" in row)) {
    return true;
  }
  return false;
}

function isPlainObject(value: unknown): value is ResearchRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, depth = 0): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value;
  if (depth > 2) return "";
  if (isSourceRef(value)) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => text(item, depth + 1))
      .filter(Boolean)
      .join(" · ");
  }
  if (isPlainObject(value)) {
    const row = value;
    const label =
      (typeof row.name === "string" && row.name) ||
      (typeof row.perk === "string" && row.perk) ||
      (typeof row.title === "string" && row.title) ||
      "";
    const rest = Object.entries(row)
      .filter(([key]) => {
        if (NESTED_SKIP.has(key)) return false;
        if (key === "name" || key === "perk" || key === "title") return false;
        return true;
      })
      .map(([key, item]) => {
        const rendered = text(item, depth + 1);
        return rendered ? `${fieldLabel(key)} ${rendered}` : "";
      })
      .filter(Boolean)
      .slice(0, 8);
    if (label) return rest.length ? `${label} (${rest.join(", ")})` : label;
    return rest.join(" · ");
  }
  return String(value);
}

/** Only string/number scalars — never a SourceReference or nested object. */
function scalarTitle(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

const TITLE_KEYS = [
  "name",
  "monster",
  "relic",
  "relic_power",
  "collection",
  "component",
  "perk",
  "step",
  "content",
  "method",
  "unlock",
  "id",
] as const;

/** Unit-testable row title — never stringifies a source object. */
export function researchRowTitle(row: ResearchRow): string {
  for (const key of TITLE_KEYS) {
    const title = scalarTitle(row[key]);
    if (title) return title;
  }
  return "—";
}

function title(row: ResearchRow): string {
  return researchRowTitle(row);
}

function subtitle(row: ResearchRow): string {
  const head = researchRowTitle(row);
  const candidates: unknown[] = [
    row.category,
    row.location,
    row.effect_summary,
    row.support_item_effect,
    row.region_reason,
    row.pvme_position,
    row.slayer_level != null ? `Slayer ${row.slayer_level}` : "",
    row.role,
  ];
  for (const candidate of candidates) {
    const value = text(candidate);
    if (value && value !== head) return value;
  }
  return "";
}

function regionName(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function regionList(values: unknown[], joiner: string): string {
  return values.map(regionName).filter(Boolean).join(joiner);
}

function nestedRegion(side: unknown): unknown {
  if (!side || typeof side !== "object") return null;
  const row = side as ResearchRow;
  return row.working_region || row.geographic_region || row.region_hint || row.region || null;
}

function region(row: ResearchRow): string {
  // Combat/skilling sync rows use camelCase comboLabel + requiredRegions.
  if (typeof row.comboLabel === "string" && row.comboLabel.trim()) {
    return row.comboLabel;
  }

  const required = Array.isArray(row.requiredRegions)
    ? row.requiredRegions
    : Array.isArray(row.required_regions)
      ? row.required_regions
      : null;
  if (required?.length) {
    const type = String(row.regionRequirementType || "").toLowerCase();
    if (required.length > 1) {
      if (type === "support") return `Chain: ${regionList(required, " / ")}`;
      return `Combo: ${regionList(required, " + ")}`;
    }
    return `Needs ${regionName(required[0])}`;
  }

  if (Array.isArray(row.required_regions_for_collection_loop) && row.required_regions_for_collection_loop.length) {
    return `Loop: ${regionList(row.required_regions_for_collection_loop, " + ")}`;
  }

  if (Array.isArray(row.artifact_regions) && row.artifact_regions.length) {
    const artifacts = regionList(row.artifact_regions, " / ");
    if (Array.isArray(row.collector_regions) && row.collector_regions.length) {
      return `Artifacts ${artifacts} · Collector ${regionList(row.collector_regions, " / ")}`;
    }
    return `Artifacts ${artifacts}`;
  }

  if (Array.isArray(row.collector_regions) && row.collector_regions.length) {
    return `Collector ${regionList(row.collector_regions, " / ")}`;
  }

  if (Array.isArray(row.region_candidates) && row.region_candidates.length) {
    return `Could be ${regionList(row.region_candidates, " / ")}`;
  }

  if (Array.isArray(row.region_options) && row.region_options.length) {
    const options = regionList(row.region_options, " / ");
    const preferred = row.planner_default_region ? ` · Prefer ${regionName(row.planner_default_region)}` : "";
    return `Pick: ${options}${preferred}`;
  }

  if (Array.isArray(row.acquisition_regions) && row.acquisition_regions.length) {
    return `From ${regionList(row.acquisition_regions, " / ")}`;
  }

  // Combo datasets put hard locks in `regions` and soft pressure in optionalRegions.
  if (Array.isArray(row.regions) && row.regions.length) {
    const hard = regionList(row.regions, " + ");
    if (Array.isArray(row.optionalRegions) && row.optionalRegions.length) {
      return `Needs ${hard} · Soft ${regionList(row.optionalRegions, " / ")}`;
    }
    return row.regions.length > 1 ? `Combo: ${hard}` : `Needs ${regionName(row.regions[0])}`;
  }

  if (Array.isArray(row.optionalRegions) && row.optionalRegions.length) {
    return `Soft ${regionList(row.optionalRegions, " / ")}`;
  }

  const hints = Array.isArray(row.regionHints)
    ? row.regionHints
    : Array.isArray(row.region_hints)
      ? row.region_hints
      : null;
  if (hints && hints.length > 1) {
    const type = String(row.regionRequirementType || "").toLowerCase();
    if (type === "all_required") return `Combo: ${regionList(hints, " + ")}`;
    return `Chain: ${regionList(hints, " / ")}`;
  }

  const entry = nestedRegion(row.entry_side);
  const destination = nestedRegion(row.destination_side || row.final_arena_side);
  if (entry || destination) {
    if (entry && destination) return `${regionName(entry)} → ${regionName(destination)}`;
    if (entry) return `Start ${regionName(entry)}`;
    return `End ${regionName(destination)}`;
  }

  const direct =
    row.region_hint ||
    row.collector_region ||
    row.acquisition_region ||
    row.working_region ||
    row.required_region ||
    (hints && hints.length === 1 ? hints[0] : null) ||
    row.region ||
    row.region_status;
  if (!direct) return "—";
  return regionName(direct);
}

function sourceName(url: string): string {
  if (url.includes("runescape.wiki")) return "Wiki";
  if (url.includes("runescape.com")) return "Jagex";
  if (url.includes("pvme.io")) return "PvME";
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

/** Accept string URLs or SourceReference objects (`source: { url }`). */
export function researchRowLinks(row: ResearchRow): string[] {
  const raw: unknown[] = [
    row.source,
    row.source_url,
    row.primary_source_url,
    row.secondary_source_url,
    row.region_source_url,
    ...(Array.isArray(row.source_urls) ? row.source_urls : []),
    ...(Array.isArray(row.sourceUrls) ? row.sourceUrls : []),
    ...(Array.isArray(row.source_refs) ? row.source_refs : []),
    ...(Array.isArray(row.secondary_source_urls) ? row.secondary_source_urls : []),
  ];
  const out: string[] = [];
  for (const item of raw) {
    const url = pullUrl(item);
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

function links(row: ResearchRow): string[] {
  return researchRowLinks(row);
}

function leadSentence(row: ResearchRow): string {
  for (const key of LEAD_KEYS) {
    const rendered = text(row[key]);
    if (rendered) return rendered;
  }
  return "";
}

function formatBodyLine(key: string, value: unknown): string {
  const rendered = text(value);
  if (!rendered) return "";
  // Requirements / access lists read better as labeled short lines.
  if ((REQ_KEYS as readonly string[]).includes(key)) {
    return `${fieldLabel(key)}: ${rendered}`;
  }
  // Long prose-ish strings from known narrative keys stay bare when they weren't the lead.
  if (
    (key === "note" ||
      key === "notes" ||
      key === "league_note" ||
      key === "planner_value" ||
      key === "effect" ||
      key === "effects" ||
      key === "officially_confirmed_path") &&
    typeof value === "string" &&
    value.length > 48
  ) {
    return rendered;
  }
  return `${fieldLabel(key)}: ${rendered}`;
}

function pushLine(lines: string[], used: Set<string>, key: string, value: unknown): void {
  if (used.has(key) || STRUCTURAL_KEYS.has(key)) return;
  const line = formatBodyLine(key, value);
  if (!line) return;
  lines.push(line);
  used.add(key);
}

/**
 * Unit-testable detail lines:
 * 1. Prefer detail/description as bare main sentence
 * 2. Then requirements
 * 3. When detail is empty, show useful short lines from known fields
 * 4. Never dump source / confidence / combo plumbing / nested junk
 */
export function researchRowDetails(row: ResearchRow): string[] {
  const lines: string[] = [];
  const used = new Set<string>();
  const sub = subtitle(row);

  const lead = leadSentence(row);
  if (lead) {
    lines.push(lead);
    for (const key of LEAD_KEYS) {
      if (text(row[key]) === lead) used.add(key);
    }
  }

  // Requirements always sit under the lead when present.
  for (const key of REQ_KEYS) {
    if (key in row) pushLine(lines, used, key, row[key]);
  }

  // Detail/description already is the body — do not re-emit packed sibling fields.
  if (lead) {
    const seen = new Set<string>();
    return lines.filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });
  }

  // No detail: surface known useful fields, then any remaining short non-structural values.
  for (const key of KNOWN_BODY_KEYS) {
    if (!(key in row) || used.has(key) || STRUCTURAL_KEYS.has(key)) continue;
    // Skip fields already used as subtitle so the body does not repeat them.
    if (
      key === "effect_summary" ||
      key === "support_item_effect" ||
      key === "region_reason" ||
      key === "pvme_position" ||
      key === "role"
    ) {
      if (sub && text(row[key]) === sub) {
        used.add(key);
        continue;
      }
    }
    pushLine(lines, used, key, row[key]);
  }

  for (const [key, value] of Object.entries(row)) {
    if (used.has(key) || STRUCTURAL_KEYS.has(key)) continue;
    if ((LEAD_KEYS as readonly string[]).includes(key)) continue;
    if ((REQ_KEYS as readonly string[]).includes(key)) continue;
    if (isSourceRef(value)) continue;
    // Skip deep nested bags unless they render compactly.
    if (isPlainObject(value) && !("name" in value || "perk" in value)) {
      const nested = text(value);
      if (!nested || nested.length > 180) continue;
    }
    pushLine(lines, used, key, value);
  }

  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
}

function details(row: ResearchRow): string[] {
  return researchRowDetails(row);
}

export function ResearchSection({
  title: heading,
  intro,
  tabs,
  searchPlaceholder,
  searchLabel,
}: {
  title: string;
  intro?: string;
  tabs: ResearchTab[];
  searchPlaceholder: string;
  searchLabel: string;
}) {
  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const selected = tabs.find((tab) => tab.key === tabKey) ?? tabs[0];
  const blurb = (selected?.description ?? "").trim();
  const lead = (intro ?? "").trim();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selected.rows;
    return selected.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [query, selected]);

  return (
    <section className="border-t border-stone-750 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 text-[13px] font-medium tracking-wide text-parch-100">{heading}</h2>
          {lead ? <p className="m-0 mt-0.5 max-w-2xl text-[13px] leading-5 text-parch-300">{lead}</p> : null}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="w-full border border-stone-750 bg-stone-900 px-2.5 py-1.5 text-[13px] text-parch-50 placeholder:text-parch-400 focus:border-gem-400 sm:w-56"
        />
      </div>

      <div
        role="tablist"
        aria-label={`${heading} sections`}
        className="comp-seg mt-2 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const active = tabKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabKey(tab.key)}
              className={`comp-seg__btn${active ? " is-active" : ""}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {blurb ? <p className="m-0 text-[12px] leading-5 text-parch-300">{blurb}</p> : <span />}
          <span className="font-mono text-[11px] text-parch-400">{rows.length}</span>
        </div>

        <div className="mt-1.5 border-t border-stone-750">
          {rows.length ? (
            rows.map((row, index) => {
              const sourceLinks = links(row);
              const rowDetails = details(row);
              return (
                <article
                  key={String(row.id || `${title(row)}-${index}`)}
                  className={`grid gap-1.5 border-b border-stone-750/70 py-2 lg:grid-cols-[minmax(170px,0.28fr)_minmax(0,1fr)] lg:gap-4 ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
                >
                  <div className="min-w-0">
                    <h3 className="m-0 text-[14px] font-medium text-parch-50">
                      {title(row)}
                      {sourceLinks.length ? (
                        <span className="ml-1.5 font-normal">
                          {sourceLinks.map((url, linkIndex) => (
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
                    {subtitle(row) ? (
                      <p className="m-0 mt-0.5 text-[11px] leading-4 text-parch-300">{subtitle(row)}</p>
                    ) : null}
                    <p className="m-0 mt-0.5 text-[11px] text-parch-400">{region(row)}</p>
                  </div>
                  <div className="space-y-0.5 text-[13px] leading-5 text-parch-50">
                    {rowDetails.length
                      ? rowDetails.map((item, itemIndex) => <p key={itemIndex} className="m-0">{item}</p>)
                      : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="py-3 text-[13px] text-parch-300">No matches.</p>
          )}
        </div>
      </div>
    </section>
  );
}
