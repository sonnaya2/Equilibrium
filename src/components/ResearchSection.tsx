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
  "region_status",
  "region_candidates",
  "region_pressure",
  "collector_region",
  "acquisition_region",
  "working_region",
  "required_region",
  "content",
  "component",
  "step",
  "relic_power",
  "source_url",
  "source_urls",
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
  return text(row.name || row.relic || row.relic_power || row.collection || row.component || row.step || row.content || row.method || row.unlock || row.id || "Entry");
}

function subtitle(row: ResearchRow): string {
  return text(row.category || row.location || row.effect_summary || row.support_item_effect || row.region_reason);
}

function region(row: ResearchRow): string {
  const value = text(
    row.region_hint || row.collector_region || row.acquisition_region || row.working_region || row.required_region || row.region_candidates || row.region || row.region_status,
  );
  if (!value) return "No hard region set";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
          <h2 className="text-lg font-semibold tracking-tight text-parch-50">{heading}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">{intro}</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="w-full border border-stone-750 bg-transparent px-3 py-2 text-sm text-parch-50 outline-none placeholder:text-parch-300/70 focus:border-parch-300 sm:w-64"
        />
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-stone-750 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTabKey(tab.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs ${tabKey === tab.key ? "border-parch-50 text-parch-50" : "border-transparent text-parch-300 hover:text-parch-50"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm leading-6 text-parch-300">{selected.description}</p>
          <span className="text-xs text-parch-300">{rows.length} shown</span>
        </div>

        <div className="mt-3 border-t border-stone-750">
          {rows.length ? rows.map((row, index) => {
            const sourceLinks = links(row);
            const rowDetails = details(row);
            return (
              <article key={String(row.id || `${title(row)}-${index}`)} className="grid gap-2 border-b border-stone-750/70 py-4 lg:grid-cols-[minmax(190px,0.3fr)_minmax(0,1fr)_160px] lg:gap-6">
                <div>
                  <h3 className="text-sm font-medium text-parch-50">{title(row)}</h3>
                  {subtitle(row) ? <p className="mt-1 text-xs leading-5 text-parch-300">{subtitle(row)}</p> : null}
                  <p className="mt-1 text-[11px] text-parch-300/80">{region(row)}</p>
                </div>
                <div className="space-y-1 text-xs leading-5 text-parch-300">
                  {rowDetails.length ? rowDetails.map((item, itemIndex) => <p key={itemIndex}>{item}</p>) : <p>No extra detail listed.</p>}
                </div>
                <div className="text-xs lg:text-right">
                  <div className="text-parch-300">{status(row.confidence)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 lg:justify-end">
                    {sourceLinks.map((url, linkIndex) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300">
                        {linkIndex === 0 ? sourceName(url) : `Source ${linkIndex + 1}`}
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
