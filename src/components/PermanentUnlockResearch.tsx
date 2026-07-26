"use client";

import { useMemo, useState } from "react";
import unlockData from "../../data/reference/progression-unlocks.json";
import supportItems from "../../data/reference/progression-support-items-2026-07-25.json";
import containerBags from "../../data/reference/progression-container-bags-2026-07-25.json";


type Row = Record<string, unknown>;
type SectionKey = "quest_unlocks" | "ability_unlocks" | "prayer_unlocks" | "account_unlocks" | "activity_unlocks" | "equipment_models" | "consumable_unlocks";

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "quest_unlocks", label: "Quest unlocks" },
  { key: "ability_unlocks", label: "Abilities" },
  { key: "prayer_unlocks", label: "Prayers" },
  { key: "account_unlocks", label: "Account" },
  { key: "activity_unlocks", label: "Activities" },
  { key: "equipment_models", label: "Equipment rules" },
  { key: "consumable_unlocks", label: "Consumables" },
];

const SUPPLEMENTS: Record<SectionKey, Row[]> = {
  quest_unlocks: [],
  ability_unlocks: [],
  prayer_unlocks: [],
  account_unlocks: [],
  activity_unlocks: [],
  equipment_models: [
    ...(supportItems.equipment_models as unknown as Row[]),
    ...(containerBags.equipment_models as unknown as Row[]),
  ],
  consumable_unlocks: [],
};

/** Nested/detail keys that must never dump into the body. */
const NOISE_KEYS = new Set([
  "id",
  "source_url",
  "source_urls",
  "sourceUrls",
  "source_refs",
  "sourceFile",
  "secondary_source_url",
  "secondary_source_urls",
  "primary_source_url",
  "confidence",
  "recordType",
  "region_status",
  "region_requirement_type",
  "hard_region_requirement",
  "type",
]);

/** Provenance `source` (URL / SourceReference) is noise; plain labels like boss names stay. */
function isProvenanceSource(value: unknown): boolean {
  if (isSourceRef(value)) return true;
  return typeof value === "string" && (value.startsWith("https://") || value.startsWith("http://"));
}
const FIELD_LABELS: Record<string, string> = {
  unlocks: "Unlocks",
  rewards: "Rewards",
  access_requirements: "Access",
  requirements: "Reqs",
  quest_dependencies: "Quests",
  dependency_notes: "Depends on",
  acquisition_routes: "Routes",
  materials: "Mats",
  base: "Base",
  base_overload: "Base overload",
  recipe_shop_gate: "Recipe shop",
  records: "Records",
  boost: "Boost",
  gem_storage: "Gems",
  base_device_recipe: "Device recipe",
  tight_spring_recipe: "Spring recipe",
  upgrade_ladder: "Upgrades",
  supply_bottleneck: "Bottleneck",
  upgrade: "Upgrade",
  charges: "Charges",
  toolbelt_unlock: "Toolbelt",
  pickup_upgrade: "Pickup",
  effects: "Effects",
  effect: "Effect",
  milestones: "Milestones",
  rules: "Rules",
  prerequisite: "Prereq",
  historical_requirement: "Was",
  historical_source: "Was from",
  league_treatment: "League",
  notes: "Notes",
  tiers: "Tiers",
  stand_rule: "Stand",
  account_rule: "Rule",
  tier_1_rule: "Tier 1",
  tier_2_rule: "Tier 2",
  token_cost: "Tokens",
  base_requirements: "Base reqs",
  boss_kills: "Boss kills",
  quantity: "Qty",
  recipe: "Recipe",
  affected_item: "Affects",
  animal: "Animal",
  farming_level: "Farming",
  herblore_level: "Herblore",
  style: "Style",
  item: "Item",
  cost: "Cost",
  route: "Route",
  currency: "Currency",
  region_hint: "Region",
  source: "From",
};
function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replaceAll("boss_kills", "boss kills")
    .replaceAll("prayer_requirement", "Prayer")
    .replaceAll("necromancy_requirement", "Necromancy")
    .replaceAll("invention_requirement", "Invention")
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
  if (key === "name" || key === "quest" || key === "item" || key === "route") return false;
  if (key === "source") {
    if (isProvenanceSource(item)) return false;
    if (primary && primary === humanString(item)) return false;
  }
  return true;
}

function format(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(format).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    if (isSourceRef(value)) return "";
    const row = value as Row;
    const primary =
      humanString(row.name) ||
      humanString(row.quest) ||
      humanString(row.item) ||
      humanString(row.route) ||
      humanString(row.source);
    const rest = Object.entries(row)
      .filter(([key, item]) => keepEntry(key, item, primary))
      .map(([key, item]) => {
        const rendered = format(item);
        return rendered ? `${fieldLabel(key)} ${rendered}` : "";
      })
      .filter(Boolean)
      .join(", ");
    if (primary) return rest ? `${primary} (${rest})` : primary;
    return Object.entries(row)
      .filter(([key, item]) => keepEntry(key, item))
      .map(([key, item]) => {
        const rendered = format(item);
        return rendered ? `${fieldLabel(key)}: ${rendered}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(value);
}
function title(row: Row): string {
  return (
    humanString(row.name) ||
    humanString(row.quest) ||
    humanString(row.unlock) ||
    humanString(row.method) ||
    "Unlock"
  );
}

function regionName(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function region(row: Row): string {
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

  if (Array.isArray(row.region_pressure) && row.region_pressure.length) {
    return `Soft: ${row.region_pressure.map(format).join(" · ")}`;
  }

  const value = row.region_hint;
  if (!value) return "—";
  return regionName(value);
}

function pullUrl(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("https://")) return value;
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("https://")) return url;
  }
  return null;
}

function links(row: Row): string[] {
  const raw: unknown[] = [
    row.source,
    row.source_url,
    row.primary_source_url,
    row.secondary_source_url,
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

function sourceLabel(url: string): string {
  if (url.includes("runescape.wiki")) return "Wiki";
  if (url.includes("runescape.com")) return "Jagex";
  if (url.includes("pvme.io")) return "PvME";
  if (url.includes("rs-analysis")) return "RS Analysis";
  return "Source";
}

/** Detail fields to surface — content only, no provenance noise. */
const DETAIL_FIELDS: Array<{ key: string; label: string }> = [
  { key: "unlocks", label: "Unlocks" },
  { key: "rewards", label: "Rewards" },
  { key: "access_requirements", label: "Access" },
  { key: "requirements", label: "Reqs" },
  { key: "base_requirements", label: "Base reqs" },
  { key: "quest_dependencies", label: "Quests" },
  { key: "dependency_notes", label: "Depends on" },
  { key: "acquisition_routes", label: "Routes" },
  { key: "materials", label: "Mats" },
  { key: "base", label: "Base" },
  { key: "base_overload", label: "Base overload" },
  { key: "recipe_shop_gate", label: "Recipe shop" },
  { key: "records", label: "Records" },
  { key: "boost", label: "Boost" },
  { key: "gem_storage", label: "Gems" },
  { key: "base_device_recipe", label: "Device recipe" },
  { key: "tight_spring_recipe", label: "Spring recipe" },
  { key: "upgrade_ladder", label: "Upgrades" },
  { key: "supply_bottleneck", label: "Bottleneck" },
  { key: "upgrade", label: "Upgrade" },
  { key: "charges", label: "Charges" },
  { key: "toolbelt_unlock", label: "Toolbelt" },
  { key: "pickup_upgrade", label: "Pickup" },
  { key: "effects", label: "Effects" },
  { key: "effect", label: "Effect" },
  { key: "milestones", label: "Milestones" },
  { key: "tiers", label: "Tiers" },
  { key: "rules", label: "Rules" },
  { key: "account_rule", label: "Rule" },
  { key: "stand_rule", label: "Stand" },
  { key: "tier_1_rule", label: "Tier 1" },
  { key: "tier_2_rule", label: "Tier 2" },
  { key: "notes", label: "Notes" },
  { key: "prerequisite", label: "Prereq" },
  { key: "historical_requirement", label: "Was" },
  { key: "historical_source", label: "Was from" },
  { key: "token_cost", label: "Tokens" },
  { key: "league_treatment", label: "League" },
];

function details(row: Row): string[] {
  return DETAIL_FIELDS.map(({ key, label }) => {
    const rendered = format(row[key]);
    if (!rendered) return "";
    // Scalars / short strings: prefix. Long prose (league/notes): body only when already self-describing.
    if (typeof row[key] === "string" && rendered.length > 80) return rendered;
    return `${label}: ${rendered}`;
  }).filter(Boolean);
}

function mapKey(row: Row, index: number, prefix: string): string {
  if (row.id != null && row.id !== "") return String(row.id);
  if (typeof row.name === "string" && row.name) return `${prefix}:${row.name}`;
  if (typeof row.quest === "string" && row.quest) return `${prefix}:${row.quest}`;
  return `${prefix}:${index}`;
}

function rowsFor(section: SectionKey): Row[] {
  const base = unlockData[section] as unknown as Row[];
  const rows = new Map<string, Row>();
  // Base first, then supplements — on id collision the newer supplement wins.
  base.forEach((row, index) => {
    rows.set(mapKey(row, index, "base"), row);
  });
  SUPPLEMENTS[section].forEach((row, index) => {
    rows.set(mapKey(row, index, "supplement"), row);
  });
  return [...rows.values()];
}

export function PermanentUnlockResearch() {
  const [section, setSection] = useState<SectionKey>("quest_unlocks");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const source = rowsFor(section);
    const needle = query.trim().toLowerCase();
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
          aria-label="Search unlocks"
          className="w-full border border-stone-750 bg-stone-900 px-2.5 py-1.5 text-[13px] text-parch-50 placeholder:text-parch-400 focus:border-gem-400 sm:w-56"
        />
      </div>

      <div role="tablist" aria-label="Unlock sections" className="comp-seg mt-2 overflow-x-auto">
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
            const sourceLinks = links(row);
            const rowDetails = details(row);
            const category = humanString(row.category);
            return (
              <article
                key={mapKey(row, index, "row")}
                className={`grid gap-1.5 border-b border-stone-750/70 py-2 lg:grid-cols-[minmax(170px,0.28fr)_minmax(0,1fr)] lg:gap-4 ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
              >
                <div className="min-w-0">
                  <h3 className="m-0 text-[14px] font-medium text-parch-50">
                    {title(row)}
                    {sourceLinks.length ? (
                      <span className="ml-1.5 font-normal">
                        {sourceLinks.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gem-300 hover:underline"
                          >
                            {i > 0 ? " · " : "· "}
                            {sourceLabel(url)}
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </h3>
                  {category ? <p className="m-0 mt-0.5 text-[11px] leading-4 text-parch-300">{category}</p> : null}
                  <p className="m-0 mt-0.5 text-[11px] text-parch-400">{region(row)}</p>
                </div>
                <div className="space-y-0.5 text-[13px] leading-5 text-parch-50">
                  {rowDetails.map((item, i) => (
                    <p key={i} className="m-0">{item}</p>
                  ))}
                </div>
              </article>
            );
          }) : <p className="py-3 text-[13px] text-parch-300">No matches.</p>}
        </div>
      </div>
    </section>
  );
}
