"use client";

import { useMemo, useState } from "react";
import { confidenceLabel } from "@/components/researchStatus";

export type ResearchRow = Record<string, unknown>;

export interface ResearchTab {
  key: string;
  label: string;
  /** Optional one-liner under the tab; omit or "" when the label is enough. */
  description?: string;
  rows: ResearchRow[];
}

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
      if (type === "support") return `Region chain (support pressure): ${regionList(required, " / ")}`;
      return `Region combo (all required): ${regionList(required, " + ")}`;
    }
    return `Requires region: ${regionName(required[0])}`;
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

  const hints = Array.isArray(row.regionHints)
    ? row.regionHints
    : Array.isArray(row.region_hints)
      ? row.region_hints
      : null;
  if (hints && hints.length > 1) {
    const type = String(row.regionRequirementType || "").toLowerCase();
    if (type === "all_required") return `Region combo (all required): ${regionList(hints, " + ")}`;
    return `Region chain (support pressure): ${regionList(hints, " / ")}`;
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
    (hints && hints.length === 1 ? hints[0] : null) ||
    row.region ||
    row.region_status;
  if (!direct) return "No hard region set";
  return regionName(direct);
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
          <span className="font-mono text-[11px] text-parch-400">{rows.length} shown</span>
        </div>

        <div className="mt-1.5 border-t border-stone-750">
          {rows.length ? (
            rows.map((row, index) => {
              const sourceLinks = links(row);
              const rowDetails = details(row);
              return (
                <article
                  key={String(row.id || `${title(row)}-${index}`)}
                  className={`grid gap-1.5 border-b border-stone-750/70 py-2 lg:grid-cols-[minmax(170px,0.28fr)_minmax(0,1fr)_140px] lg:gap-4 ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
                >
                  <div className="min-w-0">
                    <h3 className="m-0 text-[14px] font-medium text-parch-50">{title(row)}</h3>
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
                  <div className="text-[11px] lg:text-right">
                    <div className="text-parch-300">{confidenceLabel(row.confidence)}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 lg:justify-end">
                      {sourceLinks.map((url, linkIndex) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gem-300 hover:underline"
                        >
                          {linkIndex === 0 ? sourceName(url) : `Source ${linkIndex + 1}`}
                        </a>
                      ))}
                    </div>
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
