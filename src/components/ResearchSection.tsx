"use client";

import { useMemo, useState } from "react";
import type { ResearchRegion } from "@/research/catalog";
import { DataViewHeader, useDataRegion } from "./DataWorkbench";

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

/** Hard cap for any body line. Audit notes in JSON run 1–2k chars — never show that. */
const LINE_MAX = 120;
const BODY_MAX_LINES = 2;

const AUDIT_NOISE =
  /\b(wave[-\s]?\d|final pass|audit rank|rank-\d|first-class row|dual-claim|do not re-emit|does not re-emit|do not invent|do not dual|canonical emit|supersedes dual|residual-?[ab]|still-fucked|enrichment|planner stop|cross-region:|combat:|anachronia:|asgarnia:|kandarin:|tirannwn:|fremennik:|desert:|prifddinas:|slayer:|firemaking:)\b/i;

/** One short human sentence — never the full audit dump. */
export function clipProse(raw: string, max = LINE_MAX): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Prefer a sentence that is not maintainance/audit meta.
  const parts = s.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
  const human = parts.find(
    (p) => p.length >= 24 && p.length <= max * 1.4 && !AUDIT_NOISE.test(p),
  );
  if (human) s = human;
  else if (AUDIT_NOISE.test(s) && parts.length > 1) {
    const next = parts.find((p) => !AUDIT_NOISE.test(p) && p.length >= 20);
    if (next) s = next;
  }

  // Pure audit noise with no clean sentence — hide rather than show 120 chars of meta.
  if (AUDIT_NOISE.test(s) && !parts.some((p) => !AUDIT_NOISE.test(p) && p.length >= 20)) {
    return "";
  }

  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

function text(value: unknown, depth = 0): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return clipProse(value);
  if (depth > 1) return "";
  if (isSourceRef(value)) return "";
  if (Array.isArray(value)) {
    return value
      .slice(0, 4)
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
    if (label) return clipProse(label, 80);
    // Never explode nested bags into multi-field essays.
    return "";
  }
  return clipProse(String(value));
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
    row.region;
  // Never fall back to region_status / confidence meta — those are not place labels.
  if (!direct) return "—";
  return regionName(direct);
}

const REGION_SCOPE_KEYS = [
  "region",
  "regionId",
  "region_hint",
  "region_hints",
  "regionHints",
  "region_candidates",
  "region_pressure",
  "region_options",
  "regions",
  "optionalRegions",
  "allRegions",
  "required_region",
  "required_regions",
  "requiredRegions",
  "required_regions_for_collection_loop",
  "artifact_regions",
  "collector_region",
  "collector_regions",
  "acquisition_region",
  "acquisition_regions",
  "working_region",
  "geographic_region",
  "supporting_regions",
  "alternate_region_routes",
  "comboLabel",
] as const;

function collectRegionScope(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectRegionScope(item, out));
  else if (value && typeof value === "object") {
    Object.values(value as ResearchRow).forEach((item) => collectRegionScope(item, out));
  }
}

function normalizeRegionScope(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Strict regional rows plus records explicitly marked global. Unmapped rows stay out. */
export function researchRowMatchesRegion(
  row: ResearchRow,
  selectedRegion: Pick<ResearchRegion, "id" | "name" | "aliases"> | null,
): boolean {
  if (!selectedRegion) return true;
  const scope: string[] = [];
  for (const key of REGION_SCOPE_KEYS) collectRegionScope(row[key], scope);
  if (typeof row.id === "string" && row.id.includes(":")) scope.push(row.id.split(":", 1)[0]!);

  const normalized = scope.map(normalizeRegionScope).filter(Boolean);
  const concrete = normalized.filter(
    (value) => !value.includes("global") && !value.includes("allregions") && !value.includes("anyregion"),
  );
  if (!concrete.length) return normalized.length > 0;

  const aliases = [selectedRegion.id, selectedRegion.name, ...selectedRegion.aliases]
    .map(normalizeRegionScope)
    .filter(Boolean);
  return concrete.some((value) => aliases.some((alias) => value.includes(alias)));
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
 * Unit-testable detail lines — dense tool chrome only.
 * At most two short lines. Never the 1–2k char audit essay in `detail`.
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

  // One short reqs line if present (capped).
  for (const key of REQ_KEYS) {
    if (key in row && lines.length < BODY_MAX_LINES) pushLine(lines, used, key, row[key]);
  }

  // No essay lead: at most one extra known short field (role, recipe, level…).
  if (!lead) {
    for (const key of KNOWN_BODY_KEYS) {
      if (lines.length >= BODY_MAX_LINES) break;
      if (!(key in row) || used.has(key) || STRUCTURAL_KEYS.has(key)) continue;
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
      // Skip long narrative keys when they smell like audit notes.
      if (
        (key === "notes" || key === "note" || key === "planner_value" || key === "league_note") &&
        typeof row[key] === "string" &&
        (AUDIT_NOISE.test(row[key] as string) || (row[key] as string).length > 200)
      ) {
        const clipped = text(row[key]);
        if (!clipped || clipped.length < 16) continue;
      }
      pushLine(lines, used, key, row[key]);
    }
  }

  // Hard stop — never scan remaining keys (that was the wall-of-text path).
  const seen = new Set<string>();
  return lines
    .map((line) => clipProse(line, LINE_MAX))
    .filter((line) => {
      if (!line || seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .slice(0, BODY_MAX_LINES);
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
  const selectedRegion = useDataRegion();
  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const selected = tabs.find((tab) => tab.key === tabKey) ?? tabs[0];
  const blurb = (selected?.description ?? "").trim();
  const lead = (intro ?? "").trim();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const regionalRows = selected.rows.filter((row) => researchRowMatchesRegion(row, selectedRegion));
    if (!needle) return regionalRows;
    // Title + region + clipped details only — never stringify full audit bags.
    return regionalRows.filter((row) => {
      const hay = [
        researchRowTitle(row),
        region(row),
        subtitle(row),
        ...researchRowDetails(row),
        ...researchRowLinks(row),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [query, selected, selectedRegion]);

  return (
    <section className="data-record-view">
      <DataViewHeader
        title={heading}
        description={blurb || lead || selected.label}
        count={rows.length}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="field-inset data-view-search"
        />
      </DataViewHeader>

      <div
        role="tablist"
        aria-label={`${heading} sections`}
        className="comp-seg data-record-tabs"
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

      <div className="data-record-surface">
        <div className="data-ledger-head" aria-hidden="true">
          <span>Record</span>
          <span>Region access</span>
          <span>Details</span>
        </div>
        <div>
          {rows.length ? (
            rows.map((row, index) => {
              const sourceLinks = links(row);
              const rowDetails = details(row);
              return (
                <article
                  key={String(row.id || `${title(row)}-${index}`)}
                  className={`data-record-row${index % 2 === 1 ? " is-zebra" : ""}`}
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
                  </div>
                  <p className="data-record-row__region">{region(row)}</p>
                  <div className="data-record-row__details">
                    {rowDetails.length
                      ? rowDetails.map((item, itemIndex) => <p key={itemIndex} className="m-0">{item}</p>)
                      : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="data-empty">{query ? "No records match this search." : `No ${selected.label.toLowerCase()} records are mapped to ${selectedRegion?.name ?? "this region"}.`}</p>
          )}
        </div>
      </div>
    </section>
  );
}
