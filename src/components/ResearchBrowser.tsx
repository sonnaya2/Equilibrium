"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ResearchCatalog,
  ResearchContentRow,
  ResearchRegion,
  ResearchSkill,
  ResearchTrainingMethod,
  ResearchUpgrade,
  SourceReference,
} from "@/research/catalog";
import { isRegionUnlocked } from "@/league";
import { useBuild } from "@/league/useBuild";
import type { RegionId } from "@/league";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";

type Mode = "region" | "skill";

/** Optional row focus inside the selected region/skill record. */
type FocusRef =
  | { kind: "content"; index: number }
  | { kind: "upgrade"; index: number }
  | { kind: "method"; id: string }
  | null;

const SOURCE_LABEL: Record<SourceReference["source"], string> = {
  "runescape-wiki": "Wiki",
  jagex: "Jagex",
  "rs-analysis": "RS Analysis",
  pvme: "PvME",
  derived: "Other",
};

function cleanText(value: string): string {
  return value;
}

function availabilityLabel(value: string): string {
  if (value === "automatic_early") return "early unlock";
  return value.replaceAll("_", " ");
}

function confidenceLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (!normalized || normalized === "unclassified") return "Not checked";
  if (normalized.includes("stale")) return "Needs update";
  if (normalized.includes("unresolved")) return "Unresolved";
  if (normalized.includes("incomplete")) return "Incomplete";
  if (normalized.includes("legacy")) return "Legacy reference";
  if (normalized.includes("historical_league_taxonomy") || normalized.includes("working_league_region_taxonomy")) return "League precedent";
  if (normalized.includes("confirmed_wiki")) return "Wiki checked";
  if (normalized.includes("confirmed_official")) return "Jagex";
  if (normalized.includes("inferred_region") || normalized.includes("region_inferred")) return "Region inferred";
  if (normalized.includes("base_game")) return "Base game";
  if (normalized.includes("current_2026_content")) return "Current";
  return value.replaceAll("_", " ");
}

function freshnessLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (!normalized) return "-";
  if (normalized === "2026_current" || normalized === "current" || normalized === "current_wiki") return "Current";
  if (normalized.includes("2026-07-20")) return "Jul 20, 2026";
  if (normalized.includes("2026_remastered")) return "2026 remaster";
  if (normalized.includes("current_page_stale_xp_tables")) return "Current page; rates stale";
  if (normalized.includes("stale")) return "Needs update";
  if (normalized.includes("current_content_region_confirmed")) return "Current";
  if (normalized.includes("current_wiki_main_game_ceiling")) return "Current main-game ceiling";
  return value.replaceAll("_", " ");
}

function regionName(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function upgradeRegionAccess(upgrade: ResearchUpgrade): string {
  if (upgrade.comboLabel) return upgrade.comboLabel;

  const required = upgrade.requiredRegions ?? [];
  if (required.length > 1) {
    return `Region combo (all required): ${required.map(regionName).join(" + ")}`;
  }

  const hints = upgrade.regionHints ?? [];
  if (hints.length > 1) {
    if (upgrade.regionRequirementType === "all_required") {
      return `Region combo (all required): ${hints.map(regionName).join(" + ")}`;
    }
    return `Region chain (support pressure): ${hints.map(regionName).join(" / ")}`;
  }

  return "";
}

function methodAccess(method: ResearchTrainingMethod): string {
  if (!method.regionHints.length) return "no region set";

  return cleanText(method.regionHints.join(" · "))
    .replaceAll("_plus_", " + ")
    .replaceAll("multi_region_dependency", "multiple regions")
    .replaceAll("multi_region", "multiple regions")
    .replaceAll("global_if_materials_available", "global if materials are available")
    .replaceAll("global_once_supplied", "global once supplied")
    .replaceAll("player_owned_house_global_with_resource_dependency", "player-owned house; materials region-dependent")
    .replaceAll("materials_and_altar_dependent", "materials and altar dependent")
    .replaceAll("arc_unresolved", "The Arc; region not confirmed")
    .replaceAll("_inferred", " (inferred)")
    .replaceAll("_likely_", " likely ")
    .replaceAll("_", " ");
}

function sourceKindLabel(kind: string | undefined): string {
  if (!kind) return "Source";
  return SOURCE_LABEL[kind as SourceReference["source"]] ?? kind;
}

function SourceLink({ source }: { source: SourceReference | null }) {
  if (!source?.url) return <span className="text-parch-100">-</span>;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={source.title}
      className="whitespace-nowrap text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-100"
    >
      {sourceKindLabel(source.source)}
    </a>
  );
}

function Diamond({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rotate-45 border ${
        active
          ? "border-gem-400 bg-gem-500"
          : "border-gem-500/50 bg-stone-800"
      }`}
      aria-hidden
    />
  );
}

function MethodTable({
  methods,
  focusedId,
  onFocus,
}: {
  methods: ResearchTrainingMethod[];
  focusedId?: string | null;
  onFocus?: (id: string) => void;
}) {
  if (!methods.length) {
    return <p className="px-3.5 py-2.5 text-[15px] text-parch-100">No method listed yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[1120px]">
        <thead>
          <tr>
            <th>Method</th>
            <th>Level</th>
            <th>Base rate / throughput</th>
            <th>Where</th>
            <th>Needs</th>
            <th>Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => {
            const focused = focusedId === method.id;
            return (
              <tr
                key={method.id}
                className={`align-top ${onFocus ? "cursor-pointer" : ""} ${focused ? "bg-stone-raised" : ""}`}
                onClick={onFocus ? () => onFocus(method.id) : undefined}
                aria-selected={onFocus ? focused : undefined}
              >
                <td>
                  <div className="font-medium">{cleanText(method.method)}</div>
                  <div className="mt-0.5 text-[12px] text-parch-100">
                    {method.skill}{method.intensity ? ` · ${method.intensity}` : ""}
                  </div>
                  {method.note ? <div className="mt-1 max-w-xl text-[14px] leading-5 text-parch-100">{cleanText(method.note)}</div> : null}
                  {method.warning ? <div className="mt-1 max-w-xl text-[14px] leading-5 text-parch-100">{cleanText(method.warning)}</div> : null}
                </td>
                <td>{method.levelRange || "-"}</td>
                <td className="max-w-[250px] font-mono leading-5">{method.xpRate || "not listed"}</td>
                <td className="max-w-[230px] secondary leading-5">
                  {method.location ? <div className="text-parch-50">{cleanText(method.location)}</div> : null}
                  <div className={method.location ? "mt-1" : ""}>{methodAccess(method)}</div>
                  {method.hardRegionRequirement ? <div className="mt-1 text-parch-50">region required</div> : null}
                </td>
                <td className="max-w-[240px] secondary leading-5">
                  {method.requiredUnlock ? <div>{cleanText(method.requiredUnlock)}</div> : null}
                  {method.requirements.length ? <div className="mt-1">{method.requirements.join(" · ")}</div> : null}
                  {method.resourceSource ? <div className="mt-1">Supply: {cleanText(method.resourceSource)}</div> : null}
                  {!method.requiredUnlock && !method.requirements.length && !method.resourceSource ? "-" : null}
                </td>
                <td className="secondary leading-5">
                  <div className="text-parch-50">{freshnessLabel(method.freshness)}</div>
                  <div className="mt-0.5 text-[12px] text-parch-100">{confidenceLabel(method.confidence)}</div>
                </td>
                <td className="text-[12px]"><SourceLink source={method.source} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RegionDetail({
  region,
  focus,
  onFocus,
}: {
  region: ResearchRegion;
  focus: FocusRef;
  onFocus: (next: FocusRef) => void;
}) {
  const focusedMethodId = focus?.kind === "method" ? focus.id : null;
  const focusedContent = focus?.kind === "content" ? focus.index : null;
  const focusedUpgrade = focus?.kind === "upgrade" ? focus.index : null;

  return (
    <article className="space-y-4">
      <header className="pb-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div>
            <h2 className="text-2xl font-semibold text-parch-50">{cleanText(region.name)}</h2>
            <div className="mt-1 text-[12px] text-parch-100">
              {availabilityLabel(region.availability)} · {region.content.length} entries · {region.training.length} training methods · {region.upgrades.length} upgrades
            </div>
          </div>
          <div className="text-[12px] text-parch-100"><SourceLink source={region.source} /></div>
        </div>
      </header>

      {region.hardRules.length ? (
        <section className="panel">
          <div className="panel-head">Requirements</div>
          <div className="panel-body space-y-1">
            {region.hardRules.map((rule) => <p key={rule} className="text-[15px] leading-6 text-parch-50">{cleanText(rule)}</p>)}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-head">Areas</div>
          <div className="px-3.5">
            {region.areas.length ? region.areas.map((area) => <div key={area} className="border-b border-stone-750/70 py-2 text-[15px] text-parch-50 last:border-b-0">{cleanText(area)}</div>) : <div className="py-2.5 text-[15px] text-parch-100">No area list yet.</div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">Skills here</div>
          <div className="px-3.5">
            {region.skills.length ? region.skills.map((skill) => <div key={skill} className="border-b border-stone-750/70 py-2 text-[15px] text-parch-50 last:border-b-0">{skill}</div>) : <div className="py-2.5 text-[15px] text-parch-100">No skills listed yet.</div>}
          </div>
        </div>
      </section>

      {region.warnings.length ? (
        <section className="panel">
          <div className="panel-head">Notes</div>
          <div className="px-3.5">
            {region.warnings.map((warning) => <p key={warning} className="border-b border-stone-750/70 py-2 text-[15px] leading-6 text-parch-100 last:border-b-0">{cleanText(warning)}</p>)}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Content</span>
          <span className="font-normal text-parch-100">{region.content.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[820px]">
            <thead>
              <tr>
                <th>Content</th>
                <th>Type</th>
                <th>Details</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {region.content.map((row, index) => {
                const focused = focusedContent === index;
                return (
                  <tr
                    key={`${row.name}-${index}`}
                    className={`align-top cursor-pointer ${focused ? "bg-stone-raised" : ""}`}
                    onClick={() => onFocus({ kind: "content", index })}
                    aria-selected={focused}
                  >
                    <td>{cleanText(row.name)}</td>
                    <td className="secondary">{row.kind}</td>
                    <td className="max-w-xl secondary leading-6">{row.detail ? cleanText(row.detail) : "-"}</td>
                    <td className="secondary text-[12px]">{confidenceLabel(row.confidence)}</td>
                    <td className="text-[12px]"><SourceLink source={row.source} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Major upgrades</span>
          <span className="font-normal text-parch-100">{region.upgrades.length}</span>
        </div>
        <div>
          {region.upgrades.length ? region.upgrades.map((upgrade, index) => {
            const regionAccess = upgradeRegionAccess(upgrade);
            const focused = focusedUpgrade === index;
            return (
              <button
                type="button"
                key={`upgrade-${index}-${upgrade.name}`}
                onClick={() => onFocus({ kind: "upgrade", index })}
                aria-pressed={focused}
                className={`grid w-full gap-1 border-b border-stone-750/70 px-3.5 py-2.5 text-left last:border-b-0 md:grid-cols-[minmax(180px,0.3fr)_minmax(0,1fr)_120px_100px] md:gap-5 ${
                  focused ? "bg-stone-raised" : index % 2 === 1 ? "bg-stone-zebra" : ""
                }`}
              >
                <div>
                  <div className="text-[15px] font-medium text-parch-50">{cleanText(upgrade.name)}</div>
                  <div className="mt-0.5 text-[12px] text-parch-100">{upgrade.category}</div>
                  {regionAccess ? <div className="mt-1 text-[12px] font-medium text-parch-50">{regionAccess}</div> : null}
                </div>
                <div className="text-[15px] leading-6 text-parch-100">
                  {upgrade.detail ? cleanText(upgrade.detail) : "No details yet."}
                  {upgrade.requirements.length ? <div className="mt-1 text-parch-50">Requires: {upgrade.requirements.join(" · ")}</div> : null}
                </div>
                <div className="text-[12px] text-parch-100">{confidenceLabel(upgrade.confidence)}</div>
                <div className="text-[12px] md:text-right" onClick={(e) => e.stopPropagation()}>
                  <SourceLink source={upgrade.source} />
                </div>
              </button>
            );
          }) : <p className="px-3.5 py-2.5 text-[15px] text-parch-100">No major upgrades listed yet.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Training</span>
          <span className="font-normal text-parch-100">{region.training.length}</span>
        </div>
        <MethodTable
          methods={region.training}
          focusedId={focusedMethodId}
          onFocus={(id) => onFocus({ kind: "method", id })}
        />
      </section>
    </article>
  );
}

function SkillDetail({
  skill,
  focus,
  onFocus,
}: {
  skill: ResearchSkill;
  focus: FocusRef;
  onFocus: (next: FocusRef) => void;
}) {
  const focusedMethodId = focus?.kind === "method" ? focus.id : null;

  return (
    <article className="space-y-4">
      <header className="pb-1">
        <h2 className="text-2xl font-semibold text-parch-50">{skill.name}</h2>
        <div className="mt-1 text-[12px] text-parch-100">{skill.methods.length} methods · {skill.regions.length} regions</div>
        <p className="mt-3 text-[15px] leading-6 text-parch-100">
          {skill.regions.length ? `Relevant regions: ${cleanText(skill.regions.join(", "))}.` : "No single region requirement listed yet."} Rates are before Equilibrium XP multipliers.
        </p>
      </header>
      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Training</span>
          <span className="font-normal text-parch-100">{skill.methods.length}</span>
        </div>
        <MethodTable
          methods={skill.methods}
          focusedId={focusedMethodId}
          onFocus={(id) => onFocus({ kind: "method", id })}
        />
      </section>
    </article>
  );
}

function methodSearchText(method: ResearchTrainingMethod): string {
  return [
    method.method,
    method.skill,
    method.location,
    method.requiredUnlock,
    method.resourceSource,
    ...method.requirements,
    ...method.regionHints,
    method.note,
    method.warning,
  ].join(" ");
}

function pushSource(out: SourceReference[], seen: Set<string>, s?: SourceReference | null) {
  if (!s?.url) return;
  const key = `${s.source}|${s.url}|${s.verifiedAt ?? ""}|${s.title ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(s);
}

/** Nested content / training / upgrades / methods — aggressive, deduped. */
function collectRegionSources(region: ResearchRegion): SourceReference[] {
  const out: SourceReference[] = [];
  const seen = new Set<string>();
  pushSource(out, seen, region.source);
  for (const row of region.content) pushSource(out, seen, row.source);
  for (const row of region.training) pushSource(out, seen, row.source);
  for (const row of region.upgrades) pushSource(out, seen, row.source);
  return out;
}

function collectSkillSources(skill: ResearchSkill): SourceReference[] {
  const out: SourceReference[] = [];
  const seen = new Set<string>();
  for (const row of skill.methods) pushSource(out, seen, row.source);
  return out;
}

function fact(k: string, v: string | number | boolean | undefined | null): [string, string] | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "boolean") return [k, v ? "yes" : "no"];
  return [k, String(v)];
}

function factsOf(...rows: Array<[string, string] | null>): [string, string][] {
  return rows.filter((row): row is [string, string] => row !== null);
}

function contentFacts(row: ResearchContentRow): [string, string][] {
  return factsOf(
    fact("Name", row.name),
    fact("Type", row.kind),
    fact("Detail", row.detail || null),
    fact("Confidence", confidenceLabel(row.confidence)),
  );
}

function upgradeFacts(row: ResearchUpgrade): [string, string][] {
  const access = upgradeRegionAccess(row);
  return factsOf(
    fact("Name", row.name),
    fact("Category", row.category),
    fact("Detail", row.detail || null),
    fact("Confidence", confidenceLabel(row.confidence)),
    fact("Access", access || null),
    fact("Region id", row.regionId),
    fact("Requirement type", row.regionRequirementType),
    fact("Combo", row.comboLabel),
    fact("Region combo", row.isRegionCombo),
    fact("Required regions", row.requiredRegions?.length ? row.requiredRegions.map(regionName).join(", ") : null),
    fact("Region hints", row.regionHints?.length ? row.regionHints.map(regionName).join(", ") : null),
    fact("Requirements", row.requirements.length ? row.requirements.join(" · ") : null),
  );
}

function methodFacts(row: ResearchTrainingMethod): [string, string][] {
  return factsOf(
    fact("Id", row.id),
    fact("Method", row.method),
    fact("Skill", row.skill),
    fact("Level", row.levelRange || null),
    fact("XP rate", row.xpRate || null),
    fact("Intensity", row.intensity || null),
    fact("Location", row.location || null),
    fact("Access", methodAccess(row)),
    fact("Hard region", row.hardRegionRequirement),
    fact("Unlock", row.requiredUnlock || null),
    fact("Requirements", row.requirements.length ? row.requirements.join(" · ") : null),
    fact("Supply", row.resourceSource || null),
    fact("Freshness", freshnessLabel(row.freshness)),
    fact("Confidence", confidenceLabel(row.confidence)),
    fact("Note", row.note || null),
    fact("Warning", row.warning || null),
  );
}

function regionRecordFacts(region: ResearchRegion): [string, string][] {
  return factsOf(
    fact("Id", region.id),
    fact("Availability", availabilityLabel(region.availability)),
    fact("Verified", region.verified),
    fact("Aliases", region.aliases.length ? region.aliases.join(", ") : null),
    fact("Content", region.content.length),
    fact("Training", region.training.length),
    fact("Upgrades", region.upgrades.length),
    fact("Skills", region.skills.length),
    fact("Areas", region.areas.length),
    fact("Skills list", region.skills.length ? region.skills.join(", ") : null),
    fact("Areas list", region.areas.length ? region.areas.join(", ") : null),
  );
}

function skillRecordFacts(skill: ResearchSkill): [string, string][] {
  return factsOf(
    fact("Id", skill.id),
    fact("Methods", skill.methods.length),
    fact("Regions", skill.regions.length),
    fact("Region list", skill.regions.length ? skill.regions.map(regionName).join(", ") : null),
  );
}

function buildInspectorModel(
  mode: Mode,
  region: ResearchRegion | undefined,
  skill: ResearchSkill | undefined,
  focus: FocusRef,
): {
  title: string;
  subtitle: string;
  crestId: string | null;
  scope: string;
  facts: [string, string][];
  rules: string[];
  notes: string[];
  sources: SourceReference[];
} | null {
  if (mode === "region" && region) {
    if (focus?.kind === "content") {
      const row = region.content[focus.index];
      if (row) {
        return {
          title: row.name,
          subtitle: `Content · ${region.name}`,
          crestId: region.id,
          scope: "content row",
          facts: contentFacts(row),
          rules: [],
          notes: [],
          sources: (() => {
            const out: SourceReference[] = [];
            const seen = new Set<string>();
            pushSource(out, seen, row.source);
            return out;
          })(),
        };
      }
    }
    if (focus?.kind === "upgrade") {
      const row = region.upgrades[focus.index];
      if (row) {
        return {
          title: row.name,
          subtitle: `Upgrade · ${region.name}`,
          crestId: region.id,
          scope: "upgrade row",
          facts: upgradeFacts(row),
          rules: [],
          notes: [],
          sources: (() => {
            const out: SourceReference[] = [];
            const seen = new Set<string>();
            pushSource(out, seen, row.source);
            return out;
          })(),
        };
      }
    }
    if (focus?.kind === "method") {
      const row = region.training.find((m) => m.id === focus.id);
      if (row) {
        return {
          title: row.method,
          subtitle: `Training · ${region.name}`,
          crestId: region.id,
          scope: "method row",
          facts: methodFacts(row),
          rules: [],
          notes: row.warning ? [row.warning] : [],
          sources: (() => {
            const out: SourceReference[] = [];
            const seen = new Set<string>();
            pushSource(out, seen, row.source);
            return out;
          })(),
        };
      }
    }
    return {
      title: region.name,
      subtitle: availabilityLabel(region.availability),
      crestId: region.id,
      scope: "region record",
      facts: regionRecordFacts(region),
      rules: region.hardRules,
      notes: region.warnings,
      sources: collectRegionSources(region),
    };
  }

  if (mode === "skill" && skill) {
    if (focus?.kind === "method") {
      const row = skill.methods.find((m) => m.id === focus.id);
      if (row) {
        return {
          title: row.method,
          subtitle: `Training · ${skill.name}`,
          crestId: null,
          scope: "method row",
          facts: methodFacts(row),
          rules: [],
          notes: row.warning ? [row.warning] : [],
          sources: (() => {
            const out: SourceReference[] = [];
            const seen = new Set<string>();
            pushSource(out, seen, row.source);
            return out;
          })(),
        };
      }
    }
    return {
      title: skill.name,
      subtitle: `${skill.regions.length} regions · ${skill.methods.length} methods`,
      crestId: null,
      scope: "skill record",
      facts: skillRecordFacts(skill),
      rules: [],
      notes: [],
      sources: collectSkillSources(skill),
    };
  }

  return null;
}

export function ResearchBrowser({ catalog }: { catalog: ResearchCatalog }) {
  const { build, loaded } = useBuild();
  const [mode, setMode] = useState<Mode>("region");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [regionId, setRegionId] = useState(catalog.regions[0]?.id ?? "");
  const [skillId, setSkillId] = useState(catalog.skills[0]?.id ?? "");
  const [focus, setFocus] = useState<FocusRef>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const unlockedIds = useMemo(() => {
    if (!loaded || !mineOnly) return null;
    return new Set(
      catalog.regions
        .map((r) => r.id as RegionId)
        .filter((id) => isRegionUnlocked(build, id)),
    );
  }, [build, catalog.regions, loaded, mineOnly]);

  const regionSearchText = useMemo(
    () =>
      new Map(
        catalog.regions.map((region) => [
          region.id,
          [
            region.name,
            region.id,
            ...region.aliases,
            ...region.skills,
            ...region.areas,
            ...region.content.flatMap((row) => [row.name, row.kind, row.detail]),
            ...region.upgrades.flatMap((row) => [
              row.name,
              row.category,
              row.detail,
              row.comboLabel ?? "",
              ...row.requirements,
              ...(row.regionHints ?? []),
              ...(row.requiredRegions ?? []),
            ]),
            ...region.training.map(methodSearchText),
          ]
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [catalog.regions],
  );

  const skillSearchText = useMemo(
    () =>
      new Map(
        catalog.skills.map((skill) => [
          skill.id,
          [skill.name, ...skill.regions, ...skill.methods.map(methodSearchText)]
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [catalog.skills],
  );

  const filteredRegions = useMemo(() => {
    let rows = catalog.regions;
    if (unlockedIds) rows = rows.filter((region) => unlockedIds.has(region.id as RegionId));
    if (!normalizedQuery) return rows;
    return rows.filter((region) => regionSearchText.get(region.id)?.includes(normalizedQuery));
  }, [catalog.regions, regionSearchText, normalizedQuery, unlockedIds]);

  const filteredSkills = useMemo(() => {
    let rows = catalog.skills;
    if (unlockedIds) {
      rows = rows.filter((skill) => skill.regions.some((id) => unlockedIds.has(id as RegionId)));
    }
    if (!normalizedQuery) return rows;
    return rows.filter((skill) => skillSearchText.get(skill.id)?.includes(normalizedQuery));
  }, [catalog.skills, skillSearchText, normalizedQuery, unlockedIds]);

  const selectedRegion = catalog.regions.find((region) => region.id === regionId) ?? filteredRegions[0] ?? catalog.regions[0];
  const selectedSkill = catalog.skills.find((skill) => skill.id === skillId) ?? filteredSkills[0] ?? catalog.skills[0];

  // Clear row focus when the parent record or mode changes.
  useEffect(() => {
    setFocus(null);
  }, [mode, regionId, skillId]);

  const inspector = useMemo(
    () => buildInspectorModel(mode, selectedRegion, selectedSkill, focus),
    [mode, selectedRegion, selectedSkill, focus],
  );

  return (
    <section className="data-screen">
      <div className="flex flex-wrap items-center gap-2 py-1">
        <div className="flex gap-1" role="group" aria-label="Browse data by">
          <button
            type="button"
            onClick={() => setMode("region")}
            aria-pressed={mode === "region"}
            className={`comp-facet${mode === "region" ? " is-on" : ""}`}
          >
            Regions
          </button>
          <button
            type="button"
            onClick={() => setMode("skill")}
            aria-pressed={mode === "skill"}
            className={`comp-facet${mode === "skill" ? " is-on" : ""}`}
          >
            Skills
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMineOnly((on) => !on)}
          aria-pressed={mineOnly}
          disabled={!loaded}
          title={
            loaded
              ? "Show only regions unlocked by your Map/Build picks"
              : "Loading your region picks…"
          }
          className={`comp-facet disabled:cursor-not-allowed disabled:opacity-40${
            mineOnly ? " is-on" : ""
          }`}
        >
          My regions
        </button>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "region" ? "region, boss, item, skill" : "skill, method, location"}
          aria-label="Search catalog"
          className="field-inset ml-auto min-w-[12rem] flex-1 px-2 py-1 text-sm text-parch-50 placeholder:text-parch-400 md:max-w-sm"
        />
      </div>

      {/* Prism twin desk: crest rail | stage | full sources */}
      <div className="research-browse-desk">
        <aside className="comp-crest-rail border-0">
          <p className="border-b border-stone-750 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.08em] text-parch-100">
            {mode === "region" ? "Regions" : "Skills"}
          </p>
          <div
            role="listbox"
            aria-label={mode === "region" ? "Regions" : "Skills"}
            className="max-h-[min(70vh,40rem)] overflow-y-auto"
          >
            {mode === "region"
              ? filteredRegions.map((region) => {
                  const active = selectedRegion?.id === region.id;
                  return (
                    <button
                      key={region.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setRegionId(region.id)}
                      className={`comp-crest-leaf w-full${active ? " is-on" : ""}`}
                    >
                      <Diamond active={active} />
                      <GameIcon src={regionCrestPath(region.id)} size={16} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {cleanText(region.name)}
                      </span>
                      <span className="font-mono text-[11px] text-parch-300">
                        {region.training.length}
                      </span>
                    </button>
                  );
                })
              : filteredSkills.map((skill) => {
                  const active = selectedSkill?.id === skill.id;
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setSkillId(skill.id)}
                      className={`comp-crest-leaf w-full${active ? " is-on" : ""}`}
                    >
                      <Diamond active={active} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{skill.name}</span>
                      <span className="font-mono text-[11px] text-parch-300">
                        {skill.methods.length}
                      </span>
                    </button>
                  );
                })}
            {(mode === "region" ? filteredRegions.length : filteredSkills.length) === 0 ? (
              <p className="px-3 py-3 text-[13px] text-parch-100">No matches.</p>
            ) : null}
          </div>
        </aside>
        <div className="comp-stage-col min-w-0 overflow-auto px-3 py-3">
          {mode === "region" && selectedRegion ? (
            <RegionDetail region={selectedRegion} focus={focus} onFocus={setFocus} />
          ) : null}
          {mode === "skill" && selectedSkill ? (
            <SkillDetail skill={selectedSkill} focus={focus} onFocus={setFocus} />
          ) : null}
        </div>
        <aside className="comp-inspector overflow-y-auto">
          {inspector ? (
            <BrowseSourcesInspector
              title={inspector.title}
              subtitle={inspector.subtitle}
              crestId={inspector.crestId}
              scope={inspector.scope}
              sources={inspector.sources}
              facts={inspector.facts}
              rules={inspector.rules}
              notes={inspector.notes}
              focused={focus !== null}
              onClearFocus={focus !== null ? () => setFocus(null) : undefined}
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function BrowseSourcesInspector({
  title,
  subtitle,
  crestId,
  scope,
  sources,
  facts,
  rules,
  notes,
  focused,
  onClearFocus,
}: {
  title: string;
  subtitle: string;
  crestId: string | null;
  scope: string;
  sources: SourceReference[];
  facts: [string, string][];
  rules: string[];
  notes: string[];
  focused: boolean;
  onClearFocus?: () => void;
}) {
  return (
    <div className="text-[15px]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-xs uppercase tracking-[0.14em] text-gold-400">Sources</p>
        {onClearFocus ? (
          <button
            type="button"
            onClick={onClearFocus}
            className="text-[12px] text-parch-100 underline decoration-stone-750 underline-offset-2 hover:text-parch-50"
          >
            Full record
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-start gap-2">
        {crestId ? <GameIcon src={regionCrestPath(crestId)} size={28} className="shrink-0" /> : null}
        <div className="min-w-0">
          <p className="text-[15px] font-medium leading-5 text-parch-50">{cleanText(title)}</p>
          <p className="mt-0.5 text-[12px] text-parch-100">
            {subtitle}
            {focused ? ` · ${scope}` : ""}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-stone-750 pt-3">
        {facts.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-x-2 gap-y-0.5">
            <dt className="text-[12px] leading-5 text-parch-100">{k}</dt>
            <dd className="break-words text-[15px] leading-5 text-parch-50">{v}</dd>
          </div>
        ))}
      </dl>

      {rules.length ? (
        <div className="mt-4 border-t border-stone-750 pt-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-parch-100">Hard rules</p>
          <ul className="mt-2 space-y-1.5 text-[15px] leading-5 text-parch-50">
            {rules.map((r) => (
              <li key={r}>{cleanText(r)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes.length ? (
        <div className="mt-4 border-t border-stone-750 pt-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-parch-100">Notes</p>
          <ul className="mt-2 space-y-1.5 text-[15px] leading-5 text-parch-100">
            {notes.map((n) => (
              <li key={n}>{cleanText(n)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 border-t border-stone-750 pt-3">
        <p className="text-[11px] uppercase tracking-[0.08em] text-parch-100">
          Source references · {sources.length}
        </p>
        {sources.length === 0 ? (
          <p className="mt-2 text-[15px] text-parch-100">No source links on this record.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {sources.map((s) => (
              <li
                key={`${s.source}-${s.url}-${s.verifiedAt}-${s.title ?? ""}`}
                className="border border-stone-750 bg-stone-850 p-2.5"
              >
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-gem-300">
                  {SOURCE_LABEL[s.source] ?? s.source}
                </p>
                <p className="mt-1 text-[15px] leading-5 text-parch-50">
                  {s.title || SOURCE_LABEL[s.source] || s.source}
                </p>
                <p className="mt-1 text-[12px] leading-4 text-parch-100">
                  verified {s.verifiedAt}
                  {s.publishedAt ? ` · published ${s.publishedAt}` : ""}
                  {s.revision ? ` · rev ${s.revision}` : ""}
                </p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 block break-all text-[13px] leading-4 text-gem-300 underline-offset-2 hover:underline"
                >
                  {s.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
