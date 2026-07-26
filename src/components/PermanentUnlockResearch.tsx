"use client";

import { useMemo, useState } from "react";
import unlockData from "../../data/reference/progression-unlocks.json";
import supportItems from "../../data/reference/progression-support-items-2026-07-25.json";
import containerBags from "../../data/reference/progression-container-bags-2026-07-25.json";

type Row = Record<string, unknown>;
type SectionKey = "quest_unlocks" | "ability_unlocks" | "prayer_unlocks" | "account_unlocks" | "activity_unlocks" | "equipment_models" | "consumable_unlocks";

const SECTIONS: Array<{ key: SectionKey; label: string; description: string }> = [
  { key: "quest_unlocks", label: "Quest unlocks", description: "Normal-game quest dependencies before the official Equilibrium auto-quest overlay is applied." },
  { key: "ability_unlocks", label: "Abilities", description: "Codices, materials and region hints for permanent ability unlocks." },
  { key: "prayer_unlocks", label: "Prayers", description: "Prayer and curse unlocks, including their base prerequisites." },
  { key: "account_unlocks", label: "Account", description: "Skill, boss-kill and account-wide progression milestones." },
  { key: "activity_unlocks", label: "Activities", description: "Permanent rewards earned through repeatable activities." },
  { key: "equipment_models", label: "Equipment rules", description: "Persistent equipment interactions the planner and combat model need to understand." },
  { key: "consumable_unlocks", label: "Consumables", description: "Permanent consumable progression such as the overload recipe chain, with per-step levels, costs and unlock sources." },
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

function labelKey(value: string): string {
  return value
    .replaceAll("boss_kills", "boss kills")
    .replaceAll("prayer_requirement", "Prayer")
    .replaceAll("necromancy_requirement", "Necromancy")
    .replaceAll("invention_requirement", "Invention")
    .replaceAll("_", " ");
}

function format(value: unknown): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map(format).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    const row = value as Row;
    if (typeof row.name === "string") {
      const rest = Object.entries(row)
        .filter(([key]) => key !== "name" && key !== "type" && key !== "source")
        .map(([key, item]) => `${labelKey(key)} ${format(item)}`)
        .filter(Boolean)
        .join(", ");
      const source = typeof row.source === "string" ? ` - ${row.source}` : "";
      return `${row.name}${source}${rest ? ` (${rest})` : ""}`;
    }
    return Object.entries(row).map(([key, item]) => `${labelKey(key)}: ${format(item)}`).join(" · ");
  }
  return String(value);
}

function title(row: Row): string {
  return format(row.name || row.quest || row.id || "Unlock");
}

function regionName(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function region(row: Row): string {
  if (Array.isArray(row.required_regions) && row.required_regions.length) {
    return `Requires regions: ${row.required_regions.map(regionName).join(" + ")}`;
  }

  if (Array.isArray(row.region_candidates) && row.region_candidates.length) {
    return `Region unresolved: ${row.region_candidates.map(regionName).join(" / ")}`;
  }

  if (Array.isArray(row.region_hints) && row.region_hints.length > 1) {
    return `Region chain: ${row.region_hints.map(regionName).join(" / ")}`;
  }

  if (Array.isArray(row.region_pressure) && row.region_pressure.length) {
    return `Region pressure: ${row.region_pressure.map(format).join(" · ")}`;
  }

  const value = row.region_hint;
  if (!value) return "No hard region set";
  return regionName(value);
}

function status(value: unknown): string {
  const raw = format(value).toLowerCase();
  if (raw.includes("unresolved")) return "Region unresolved";
  if (raw.includes("historical") || raw.includes("working")) return "Working League map";
  if (raw.includes("official")) return "Jagex checked";
  if (raw.includes("wiki") || raw.includes("confirmed")) return "Wiki checked";
  return "Needs review";
}

function links(row: Row): string[] {
  const values = row.source_urls || row.source_url;
  if (Array.isArray(values)) return values.filter((value): value is string => typeof value === "string");
  return typeof values === "string" ? [values] : [];
}

function sourceLabel(url: string): string {
  if (url.includes("runescape.wiki")) return "Wiki";
  if (url.includes("runescape.com")) return "Jagex";
  if (url.includes("pvme.io")) return "PvME";
  return "Source";
}

function details(row: Row): string[] {
  return [
    row.unlocks,
    row.rewards,
    row.access_requirements,
    row.requirements,
    row.quest_dependencies,
    row.dependency_notes,
    row.acquisition_routes,
    row.materials,
    row.base,
    row.base_overload,
    row.recipe_shop_gate,
    row.records,
    row.boost,
    row.gem_storage,
    row.base_device_recipe,
    row.tight_spring_recipe,
    row.upgrade_ladder,
    row.supply_bottleneck,
    row.upgrade,
    row.charges,
    row.toolbelt_unlock,
    row.pickup_upgrade,
    row.effects,
    row.effect,
    row.milestones,
    row.rules,
    row.prerequisite,
    row.historical_requirement,
    row.historical_source,
    row.league_treatment,
  ].map(format).filter(Boolean);
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
  const selected = SECTIONS.find((item) => item.key === section) ?? SECTIONS[0];

  const rows = useMemo(() => {
    const source = rowsFor(section);
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [query, section]);

  return (
    <section className="border-t border-stone-750 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-parch-50">Permanent unlocks</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
            Base-game dependencies first, League overrides second. An auto-completed quest can satisfy a requirement later without rewriting what normally unlocks the reward.
          </p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search unlocks"
          aria-label="Search permanent unlocks"
          className="w-full border border-stone-750 bg-transparent px-3 py-2 text-sm text-parch-50 placeholder:text-parch-300/70 focus:border-gem-400 sm:w-64"
        />
      </div>

      <div role="tablist" aria-label="Permanent unlock sections" className="mt-5 flex gap-1 overflow-x-auto border-b border-stone-750 pb-px">
        {SECTIONS.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(item.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs transition-colors duration-150 ${
                active
                  ? "border-gem-400 text-gem-300"
                  : "border-transparent text-parch-300 hover:text-parch-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm leading-6 text-parch-300">{selected.description}</p>
          <span className="text-xs text-parch-300">{rows.length} shown</span>
        </div>

        <div className="mt-3 border-t border-stone-750">
          {rows.length ? rows.map((row, index) => {
            const sourceLinks = links(row);
            const rowDetails = details(row);
            return (
              <article key={mapKey(row, index, "row")} className="grid gap-2 border-b border-stone-750/70 py-2.5 lg:grid-cols-[minmax(190px,0.3fr)_minmax(0,1fr)_160px] lg:gap-6">
                <div>
                  <h3 className="text-sm font-medium text-parch-50">{title(row)}</h3>
                  <p className="mt-1 text-xs text-parch-300">{format(row.category)}</p>
                  <p className="mt-1 text-[11px] text-parch-300/80">{region(row)}</p>
                </div>
                <div className="space-y-1 text-xs leading-5 text-parch-300">
                  {rowDetails.length ? rowDetails.map((item, index) => <p key={index}>{item}</p>) : <p>No extra dependency detail listed.</p>}
                </div>
                <div className="text-xs lg:text-right">
                  <div className="text-parch-300">{status(row.confidence)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 lg:justify-end">
                    {sourceLinks.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300">
                        {index === 0 ? sourceLabel(url) : `Source ${index + 1}`}
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
