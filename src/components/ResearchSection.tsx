"use client";

import { useMemo, useState } from "react";

export type ResearchRow = Record<string, unknown>;

export interface ResearchTab {
  key: string;
  label: string;
  description: string;
  rows: ResearchRow[];
}

const STRUCTURAL_KEYS = new Set([
  "id",
  "name",
  "category",
  "location",
  "region",
  "region_hint",
  "region_hints",
  "region_status",
  "region_candidates",
  "region_pressure",
  "collector_region",
  "collector_regions",
  "acquisition_region",
  "working_region",
  "required_region",
  "required_regions",
  "required_regions_for_collection_loop",
  "artifact_regions",
  "region_options",
  "acquisition_regions",
  "planner_default_region",
  "entry_side",
  "final_arena_side",
  "destination_side",
  "content",
  "component",
  "step",
  "relic_power",
  "monster",
  "perk",
  "source_url",
  "source_urls",
  "source_refs",
  "secondary_source_url",
  "secondary_source_urls",
  "primary_source_url",
  "confidence",
  "snapshot_date",
  "purpose",
  "policy",
]);

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
    const row = value as ResearchRow;
    if (typeof row.name === "string") {
      const rest = Object.entries(row)
        .filter(([key]) => key !== "name" && key !== "type" && key !== "source")
        .map(([key, item]) => `${fieldLabel(key)} ${text(item)}`)
        .filter(Boolean)
        .join(", ");
      const source = typeof row.source === "string" ? ` — ${row.source}` : "";
      return `${row.name}${source}${rest ? ` (${rest})` : ""}`;
    }
    return Object.entries(row)
      .map(([key, item]) => `${fieldLabel(key)}: ${text(item)}`)
      .join(" · ");
  }
  return String(value);
}

function title(row: ResearchRow): string {
  return text(
    row.name ||
      row.monster ||
      row.relic ||
      row.relic_power ||
      row.collection ||
      row.component ||
      row.perk ||
      row.step ||
      row.content ||
      row.method ||
      row.unlock ||
      row.id ||
      "Entry",
  );
}

function subtitle(row: ResearchRow): string {
  return text(
    row.category ||
      row.location ||
      row.effect_summary ||
      row.support_item_effect ||
      row.region_reason ||
      row.pvme_position ||
      (row.slayer_level != null ? `Slayer ${row.slayer_level}` : ""),
  );
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
  if (Array.isArray(row.required_regions) && row.required_regions.length) {
    return `Requires regions: ${regionList(row.required_regions, " + ")}`;
  }

  if (Array.isArray(row.required_regions_for_collection_loop) && row.required_regions_for_collection_loop.length) {
    return `Collection loop: ${regionList(row.required_regions_for_collection_loop, " + ")}`;
  }

  if (Array.isArray(row.artifact_regions) && row.artifact_regions.length) {
    const artifacts = regionList(row.artifact_regions, " / ");
    if (Array.isArray(row.collector_regions) && row.collector_regions.length) {
      return `Artifacts: ${artifacts} · Collector: ${regionList(row.collector_regions, " / ")}`;
    }
    return `Artifact regions: ${artifacts}`;
  }

  if (Array.isArray(row.collector_regions) && row.collector_regions.length) {
    return `Collector regions: ${regionList(row.collector_regions, " / ")}`;
  }

  if (Array.isArray(row.region_candidates) && row.region_candidates.length) {
    return `Region unresolved: ${regionList(row.region_candidates, " / ")}`;
  }

  if (Array.isArray(row.region_options) && row.region_options.length) {
    const options = regionList(row.region_options, " / ");
    const preferred = row.planner_default_region ? ` · Default: ${regionName(row.planner_default_region)}` : "";
    return `Region options: ${options}${preferred}`;
  }

  if (Array.isArray(row.acquisition_regions) && row.acquisition_regions.length) {
    return `Acquisition: ${regionList(row.acquisition_regions, " / ")}`;
  }

  if (Array.isArray(row.region_hints) && row.region_hints.length > 1) {
    return `Region chain: ${regionList(row.region_hints, " / ")}`;
  }

  const entry = nestedRegion(row.entry_side);
  const destination = nestedRegion(row.destination_side || row.final_arena_side);
  if (entry || destination) {
    if (entry && destination) return `Entry: ${regionName(entry)} · Destination: ${regionName(destination)}`;
    if (entry) return `Entry: ${regionName(entry)}`;
    return `Destination: ${regionName(destination)}`;
  }

  const direct =
    row.region_hint ||
    row.collector_region ||
    row.acquisition_region ||
    row.working_region ||
    row.required_region ||
    (Array.isArray(row.region_hints) && row.region_hints.length === 1 ? row.region_hints[0] : null) ||
    row.region ||
    row.region_status;
  if (!direct) return "No hard region set";
  return regionName(direct);
}

function status(value: unknown): string {
  const raw = text(value).toLowerCase();
  if (!raw) return "Not checked";
  if (raw.includes("unresolved") || raw.includes("pending")) return "Still unresolved";
  if (raw.includes("historical") || raw.includes("working") || raw.includes("inferred")) return "Working region map";
  if (raw.includes("official")) return "Jagex checked";
  if (raw.includes("wiki") || raw.includes("confirmed")) return "Wiki checked";
  if (raw.includes("pvme")) return "PvME method";
  return "Needs review";
}

function sourceName(url: string): string {
  if (url.includes("runescape.wiki")) return "Wiki";
  if (url.includes("runescape.com")) return "Jagex";
  if (url.includes("pvme.io")) return "PvME";
  if (url.includes("rs-analysis")) return "RS Analysis";
  return "Source";
}

function links(row: ResearchRow): string[] {
  const values = [
    row.source_url,
    row.primary_source_url,
    row.secondary_source_url,
    ...(Array.isArray(row.source_urls) ? row.source_urls : []),
    ...(Array.isArray(row.source_refs) ? row.source_refs : []),
    ...(Array.isArray(row.secondary_source_urls) ? row.secondary_source_urls : []),
  ];
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.startsWith("https://")))];
}

function details(row: ResearchRow): string[] {
  return Object.entries(row)
    .filter(([key]) => !STRUCTURAL_KEYS.has(key))
    .map(([key, value]) => {
      const rendered = text(value);
      return rendered ? `${fieldLabel(key)}: ${rendered}` : "";
    })
    .filter(Boolean);
}

export function ResearchSection({
  title: heading,
  intro,
  tabs,
  searchPlaceholder,
  searchLabel,
}: {
  title: string;
  intro: string;
  tabs: ResearchTab[];
  searchPlaceholder: string;
  searchLabel: string;
}) {
  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const selected = tabs.find((tab) => tab.key === tabKey) ?? tabs[0];

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return selected.rows;
    return selected.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [query, selected]);

  return (
    <section className="border-t border-stone-750 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-parch-50">{heading}</h2>
          <p className="mt-1 max-w-3xl text-[15px] leading-6 text-parch-100">{intro}</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="w-full border border-stone-750 bg-transparent px-3 py-2 text-[15px] text-parch-50 placeholder:text-parch-100/70 focus:border-gem-400 sm:w-64"
        />
      </div>

      <div role="tablist" aria-label={`${heading} sections`} className="mt-5 flex gap-1 overflow-x-auto border-b border-stone-750 pb-px">
        {tabs.map((tab) => {
          const active = tabKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabKey(tab.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-[12px] transition-colors duration-150 ${
                active
                  ? "border-gem-400 text-gem-300"
                  : "border-transparent text-parch-100 hover:text-parch-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[15px] leading-6 text-parch-100">{selected.description}</p>
          <span className="text-[12px] text-parch-100">{rows.length} shown</span>
        </div>

        <div className="mt-3 border-t border-stone-750">
          {rows.length ? rows.map((row, index) => {
            const sourceLinks = links(row);
            const rowDetails = details(row);
            return (
              <article
                key={String(row.id || `${title(row)}-${index}`)}
                className={`grid gap-2 border-b border-stone-750/70 py-2.5 lg:grid-cols-[minmax(190px,0.3fr)_minmax(0,1fr)_160px] lg:gap-6 ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
              >
                <div>
                  <h3 className="text-[15px] font-medium text-parch-50">{title(row)}</h3>
                  {subtitle(row) ? <p className="mt-1 text-[12px] leading-5 text-parch-100">{subtitle(row)}</p> : null}
                  <p className="mt-1 text-[12px] text-parch-100">{region(row)}</p>
                </div>
                <div className="space-y-1 text-[15px] leading-6 text-parch-50">
                  {rowDetails.length ? rowDetails.map((item, itemIndex) => <p key={itemIndex}>{item}</p>) : <p className="text-parch-100">No extra detail listed.</p>}
                </div>
                <div className="text-[12px] lg:text-right">
                  <div className="text-parch-100">{status(row.confidence)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 lg:justify-end">
                    {sourceLinks.map((url, linkIndex) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-100">
                        {linkIndex === 0 ? sourceName(url) : `Source ${linkIndex + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            );
          }) : <p className="py-5 text-[15px] text-parch-100">Nothing matches that search.</p>}
        </div>
      </div>
    </section>
  );
}
