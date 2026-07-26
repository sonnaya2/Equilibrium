"use client";

import { useMemo, useState } from "react";
import unlockData from "../../data/reference/progression-unlocks.json";
import supportItems from "../../data/reference/progression-support-items-2026-07-25.json";
import containerBags from "../../data/reference/progression-container-bags-2026-07-25.json";
import { confidenceLabel } from "@/components/researchStatus";

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

  const rows = useMemo(() => {
    const source = rowsFor(section);
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [query, section]);

  return (
    <section className="border-t border-stone-750 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 text-[13px] font-medium tracking-wide text-parch-100">Permanent unlocks</h2>
          <p className="m-0 mt-0.5 text-[13px] leading-5 text-parch-300">
            Base-game deps first; League overrides second.
          </p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search unlocks"
          aria-label="Search permanent unlocks"
          className="w-full border border-stone-750 bg-stone-900 px-2.5 py-1.5 text-[13px] text-parch-50 placeholder:text-parch-400 focus:border-gem-400 sm:w-56"
        />
      </div>

      <div role="tablist" aria-label="Permanent unlock sections" className="comp-seg mt-2 overflow-x-auto">
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
            const category = format(row.category);
            return (
              <article
                key={mapKey(row, index, "row")}
                className={`grid gap-1.5 border-b border-stone-750/70 py-2 lg:grid-cols-[minmax(170px,0.28fr)_minmax(0,1fr)_140px] lg:gap-4 ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
              >
                <div className="min-w-0">
                  <h3 className="m-0 text-[14px] font-medium text-parch-50">{title(row)}</h3>
                  {category ? <p className="m-0 mt-0.5 text-[11px] leading-4 text-parch-300">{category}</p> : null}
                  <p className="m-0 mt-0.5 text-[11px] text-parch-400">{region(row)}</p>
                </div>
                <div className="space-y-0.5 text-[13px] leading-5 text-parch-50">
                  {rowDetails.map((item, i) => (
                    <p key={i} className="m-0">{item}</p>
                  ))}
                </div>
                <div className="text-[11px] lg:text-right">
                  <div className="text-parch-300">{confidenceLabel(row.confidence)}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 lg:justify-end">
                    {sourceLinks.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-gem-300 hover:underline">
                        {i === 0 ? sourceLabel(url) : `Source ${i + 1}`}
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
