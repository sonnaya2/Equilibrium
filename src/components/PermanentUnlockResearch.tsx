"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { dataEntityIconPath } from "@/lib/gameArt";
import { presentInterestMeta, presentInterestName } from "@/lib/dataContentPresentation";
import { safeExternalHref } from "@/lib/safeHref";
import { DataTableOrganizeBar, useDataTableOrganize } from "./DataTableOrganize";
import { clipProse, researchRowMatchesRegion, researchRows } from "./ResearchSection";
import { DataViewHeader, useDataRegion } from "./DataBrowser";

type Row = Record<string, unknown>;
type SectionKey =
  | "quest_unlocks"
  | "ability_unlocks"
  | "prayer_unlocks"
  | "account_unlocks"
  | "activity_unlocks"
  | "equipment_models"
  | "consumable_unlocks";

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "quest_unlocks", label: "Quests" },
  { key: "ability_unlocks", label: "Abilities" },
  { key: "prayer_unlocks", label: "Prayers" },
  { key: "account_unlocks", label: "Account" },
  { key: "activity_unlocks", label: "Activities" },
  { key: "equipment_models", label: "Gear" },
  { key: "consumable_unlocks", label: "Consumables" },
];

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

function format(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return clipProse(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 4).map(format).filter(Boolean).join(" · ");
  }
  if (typeof value === "object") {
    if (isSourceRef(value)) return "";
    const row = value as Row;
    const primary =
      humanString(row.name) ||
      humanString(row.quest) ||
      humanString(row.item) ||
      humanString(row.route);
    if (primary) return clipProse(primary, 80);
    return "";
  }
  return String(value);
}
function title(row: Row): string {
  const raw =
    humanString(row.name) ||
    humanString(row.quest) ||
    humanString(row.unlock) ||
    humanString(row.method) ||
    "";
  if (!raw) return "Unlock";
  return presentInterestName(raw) || raw;
}

function regionName(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function region(row: Row): string {
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

  if (Array.isArray(row.region_pressure) && row.region_pressure.length) {
    return `Optional ${row.region_pressure.map(format).join(" · ")}`;
  }

  const value = row.region_hint;
  if (!value) return "—";
  return regionName(value);
}

function pullUrl(value: unknown): string | null {
  if (typeof value === "string") return safeExternalHref(value);
  if (value && typeof value === "object" && "url" in value) {
    return safeExternalHref((value as { url?: unknown }).url);
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
  { key: "location_note", label: "Where" },
  { key: "source_shop", label: "Shop" },
  { key: "source", label: "Source" },
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
  { key: "cost", label: "Cost" },
  { key: "currency", label: "Currency" },
  { key: "cost_per_rank", label: "Per rank" },
  { key: "ranks", label: "Ranks" },
  { key: "spellbook", label: "Spellbook" },
  { key: "magic_level", label: "Magic" },
  { key: "duration_minutes", label: "Mins" },
  { key: "milestones", label: "Milestones" },
  { key: "thresholds", label: "Thresholds" },
  { key: "bonuses", label: "Bonuses" },
  { key: "tiers", label: "Tiers" },
  { key: "tool_bonuses", label: "Tools" },
  { key: "familiar_bonuses", label: "Familiars" },
  { key: "migration", label: "If you owned the aura" },
  { key: "rules", label: "Rules" },
  { key: "account_rule", label: "Account" },
  { key: "stand_rule", label: "Stand" },
  { key: "tier_1_rule", label: "Tier 1" },
  { key: "tier_2_rule", label: "Tier 2" },
  { key: "notes", label: "Notes" },
  { key: "prerequisite", label: "Prereq" },
  { key: "historical_requirement", label: "Was" },
  { key: "historical_source", label: "Was from" },
  { key: "removed_auras", label: "Removed auras" },
  { key: "token_cost", label: "Tokens" },
  { key: "league_treatment", label: "League" },
];

function details(row: Row): string[] {
  const lines: string[] = [];
  for (const { key, label } of DETAIL_FIELDS) {
    if (lines.length >= 2) break;
    const rendered = format(row[key]);
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

function mapKey(row: Row, index: number, prefix: string): string {
  if (row.id != null && row.id !== "") return String(row.id);
  if (typeof row.name === "string" && row.name) return `${prefix}:${row.name}`;
  if (typeof row.quest === "string" && row.quest) return `${prefix}:${row.quest}`;
  return `${prefix}:${index}`;
}

export function PermanentUnlockResearch() {
  const selectedRegion = useDataRegion();
  const [section, setSection] = useState<SectionKey>("quest_unlocks");
  const [query, setQuery] = useState("");
  const [sectionRows, setSectionRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const href = selectedRegion?.panelHrefs?.unlocks[section];
    if (!href) {
      setSectionRows([]);
      setLoadError("");
      return;
    }
    let live = true;
    setSectionRows([]);
    setLoadError("");
    fetch(href, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unlock data returned ${response.status}`);
        return response.json() as Promise<{ region: string; section: string; records: Row[] }>;
      })
      .then((data) => {
        if (live && data.region === selectedRegion.id && data.section === section) {
          setSectionRows(researchRows(data.records));
        }
      })
      .catch((reason) => {
        if (live)
          setLoadError(reason instanceof Error ? reason.message : "Unlock data failed to load");
      });
    return () => {
      live = false;
    };
  }, [section, selectedRegion]);

  const filtered = useMemo(() => {
    const source = sectionRows.filter((row) => researchRowMatchesRegion(row, selectedRegion));
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((row) => {
      const hay = [title(row), region(row), ...details(row), ...links(row)].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [query, sectionRows, selectedRegion]);
  const labelOf = useCallback((row: Row) => title(row), []);
  const typeOf = useCallback(
    (row: Row) =>
      humanString(row.category) || humanString(row.kind) || humanString(row.recordType) || "—",
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
  const sectionLabel = SECTIONS.find((item) => item.key === section)?.label ?? "Unlocks";

  return (
    <section className="data-record-view">
      <DataViewHeader title="Unlocks" count={rows.length}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search unlocks"
          className="ui-field data-view-search"
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

      <div role="tablist" aria-label="Unlock sections" className="ui-seg data-record-tabs">
        {SECTIONS.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(item.key)}
              className={`ui-seg__btn${active ? " is-active" : ""}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="data-record-surface">
        <div className="data-ledger-head" aria-hidden="true">
          <span>Name</span>
          <span>Regions</span>
          <span>Notes</span>
        </div>
        <div>
          {rows.length ? (
            rows.map((row, index) => {
              const sourceLinks = links(row);
              const rowDetails = details(row);
              const categoryRaw = humanString(row.category);
              const category = categoryRaw ? presentInterestMeta(categoryRaw, 64) : "";
              const rowTitle = title(row);
              const rawName = humanString(row.name) || (rowTitle !== "Unlock" ? rowTitle : "");
              const iconSrc = dataEntityIconPath({
                name: rawName || null,
                kind: String(row.recordType || row.category || row.kind || ""),
                id: row.id != null ? String(row.id) : null,
              });
              return (
                <article
                  key={mapKey(row, index, "row")}
                  className={`data-record-row${index % 2 === 1 ? " is-zebra" : ""}`}
                >
                  <div className="data-record-row__identity">
                    <span
                      className={
                        iconSrc ? "data-icon-well" : "data-icon-well data-icon-well--empty"
                      }
                    >
                      {iconSrc ? <GameIcon src={iconSrc} size={24} /> : null}
                    </span>
                    <div className="data-record-row__copy min-w-0">
                      <h3 className="m-0 text-[15px] font-medium text-parch-50">
                        {rowTitle}
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
                      {category ? (
                        <p className="m-0 mt-0.5 text-[13px] leading-5 text-parch-300">
                          {category}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="data-record-row__region">{region(row)}</p>
                  <div className="data-record-row__details">
                    {rowDetails.map((item, i) => (
                      <p key={i} className="m-0">
                        {item}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="data-empty">
              {loadError
                ? loadError
                : query
                  ? "Nothing matches."
                  : `No ${sectionLabel.toLowerCase()} in ${selectedRegion?.name ?? "this region"}.`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
