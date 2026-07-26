"use client";

import { useMemo, useState } from "react";
import type {
  ResearchCatalog,
  ResearchRegion,
  ResearchSkill,
  ResearchTrainingMethod,
  ResearchUpgrade,
  SourceReference,
} from "@/research/catalog";

type Mode = "region" | "skill";

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
  const required = upgrade.requiredRegions ?? [];
  if (required.length > 1) return `Requires regions: ${required.map(regionName).join(" + ")}`;

  const hints = upgrade.regionHints ?? [];
  if (hints.length > 1) {
    const label = upgrade.regionRequirementType === "all_required" ? "Requires regions" : "Region chain";
    return `${label}: ${hints.map(regionName).join(upgrade.regionRequirementType === "all_required" ? " + " : " / ")}`;
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
  if (!source?.url) return <span className="text-parch-300">-</span>;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={source.title}
      className="whitespace-nowrap text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
    >
      {sourceKindLabel(source.source)}
    </a>
  );
}

function MethodTable({ methods }: { methods: ResearchTrainingMethod[] }) {
  if (!methods.length) {
    return <p className="px-3.5 py-2.5 text-sm text-parch-300">No method listed yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
        <thead className="text-xs text-parch-300">
          <tr className="border-b border-stone-750">
            <th className="px-3.5 py-2 pr-4 font-medium">Method</th>
            <th className="py-2 pr-4 font-medium">Level</th>
            <th className="py-2 pr-4 font-medium">Base rate / throughput</th>
            <th className="py-2 pr-4 font-medium">Where</th>
            <th className="py-2 pr-4 font-medium">Needs</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-3.5 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method.id} className="border-b border-stone-750/70 align-top last:border-b-0">
              <td className="px-3.5 py-2.5 pr-4">
                <div className="font-medium text-parch-50">{cleanText(method.method)}</div>
                <div className="mt-0.5 text-xs text-parch-300">
                  {method.skill}{method.intensity ? ` · ${method.intensity}` : ""}
                </div>
                {method.note ? <div className="mt-1 max-w-xl text-xs leading-5 text-parch-300">{cleanText(method.note)}</div> : null}
                {method.warning ? <div className="mt-1 max-w-xl text-xs leading-5 text-parch-300/80">{cleanText(method.warning)}</div> : null}
              </td>
              <td className="py-2.5 pr-4 text-parch-300">{method.levelRange || "-"}</td>
              <td className="max-w-[250px] py-2.5 pr-4 font-mono text-xs leading-5 text-parch-50">{method.xpRate || "not listed"}</td>
              <td className="max-w-[230px] py-2.5 pr-4 text-xs leading-5 text-parch-300">
                {method.location ? <div className="text-parch-50">{cleanText(method.location)}</div> : null}
                <div className={method.location ? "mt-1" : ""}>{methodAccess(method)}</div>
                {method.hardRegionRequirement ? <div className="mt-1 text-parch-50">region required</div> : null}
              </td>
              <td className="max-w-[240px] py-2.5 pr-4 text-xs leading-5 text-parch-300">
                {method.requiredUnlock ? <div>{cleanText(method.requiredUnlock)}</div> : null}
                {method.requirements.length ? <div className="mt-1">{method.requirements.join(" · ")}</div> : null}
                {method.resourceSource ? <div className="mt-1">Supply: {cleanText(method.resourceSource)}</div> : null}
                {!method.requiredUnlock && !method.requirements.length && !method.resourceSource ? "-" : null}
              </td>
              <td className="py-2.5 pr-4 text-xs leading-5 text-parch-300">
                <div>{freshnessLabel(method.freshness)}</div>
                <div className="mt-0.5 text-[11px] text-parch-300/70">{confidenceLabel(method.confidence)}</div>
              </td>
              <td className="py-2.5 pr-3.5 text-xs"><SourceLink source={method.source} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegionDetail({ region }: { region: ResearchRegion }) {
  return (
    <article className="space-y-4">
      <header className="pb-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-parch-50">{cleanText(region.name)}</h2>
            <div className="mt-1 text-xs text-parch-300">
              {availabilityLabel(region.availability)} · {region.content.length} entries · {region.training.length} training methods · {region.upgrades.length} upgrades
            </div>
          </div>
          <div className="text-xs text-parch-300"><SourceLink source={region.source} /></div>
        </div>
      </header>

      {region.hardRules.length ? (
        <section className="panel">
          <div className="panel-head">Requirements</div>
          <div className="panel-body space-y-1">
            {region.hardRules.map((rule) => <p key={rule} className="text-sm leading-6 text-parch-300">{cleanText(rule)}</p>)}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-head">Areas</div>
          <div className="px-3.5">
            {region.areas.length ? region.areas.map((area) => <div key={area} className="border-b border-stone-750/70 py-2 text-sm text-parch-50 last:border-b-0">{cleanText(area)}</div>) : <div className="py-2.5 text-sm text-parch-300">No area list yet.</div>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">Skills here</div>
          <div className="px-3.5">
            {region.skills.length ? region.skills.map((skill) => <div key={skill} className="border-b border-stone-750/70 py-2 text-sm text-parch-50 last:border-b-0">{skill}</div>) : <div className="py-2.5 text-sm text-parch-300">No skills listed yet.</div>}
          </div>
        </div>
      </section>

      {region.warnings.length ? (
        <section className="panel">
          <div className="panel-head">Notes</div>
          <div className="px-3.5">
            {region.warnings.map((warning) => <p key={warning} className="border-b border-stone-750/70 py-2 text-xs leading-5 text-parch-300 last:border-b-0">{cleanText(warning)}</p>)}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Content</span>
          <span className="font-normal text-parch-300">{region.content.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="text-xs text-parch-300">
              <tr className="border-b border-stone-750">
                <th className="px-3.5 py-2 pr-4 font-medium">Content</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Details</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-3.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {region.content.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-b border-stone-750/70 align-top last:border-b-0">
                  <td className="px-3.5 py-2.5 pr-4 text-parch-50">{cleanText(row.name)}</td>
                  <td className="py-2.5 pr-4 text-xs text-parch-300">{row.kind}</td>
                  <td className="max-w-xl py-2.5 pr-4 text-xs leading-5 text-parch-300">{row.detail ? cleanText(row.detail) : "-"}</td>
                  <td className="py-2.5 pr-4 text-[11px] text-parch-300">{confidenceLabel(row.confidence)}</td>
                  <td className="py-2.5 pr-3.5 text-xs"><SourceLink source={row.source} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Major upgrades</span>
          <span className="font-normal text-parch-300">{region.upgrades.length}</span>
        </div>
        <div>
          {region.upgrades.length ? region.upgrades.map((upgrade) => {
            const regionAccess = upgradeRegionAccess(upgrade);
            return (
              <div key={upgrade.name} className="grid gap-1 border-b border-stone-750/70 px-3.5 py-2.5 last:border-b-0 md:grid-cols-[minmax(180px,0.3fr)_minmax(0,1fr)_120px_100px] md:gap-5">
                <div>
                  <div className="text-sm font-medium text-parch-50">{cleanText(upgrade.name)}</div>
                  <div className="mt-0.5 text-xs text-parch-300">{upgrade.category}</div>
                  {regionAccess ? <div className="mt-1 text-[11px] font-medium text-parch-50">{regionAccess}</div> : null}
                </div>
                <div className="text-xs leading-5 text-parch-300">
                  {upgrade.detail ? cleanText(upgrade.detail) : "No details yet."}
                  {upgrade.requirements.length ? <div className="mt-1 text-parch-50">Requires: {upgrade.requirements.join(" · ")}</div> : null}
                </div>
                <div className="text-[11px] text-parch-300">{confidenceLabel(upgrade.confidence)}</div>
                <div className="text-xs md:text-right"><SourceLink source={upgrade.source} /></div>
              </div>
            );
          }) : <p className="px-3.5 py-2.5 text-sm text-parch-300">No major upgrades listed yet.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Training</span>
          <span className="font-normal text-parch-300">{region.training.length}</span>
        </div>
        <MethodTable methods={region.training} />
      </section>
    </article>
  );
}

function SkillDetail({ skill }: { skill: ResearchSkill }) {
  return (
    <article className="space-y-4">
      <header className="pb-1">
        <h2 className="text-2xl font-semibold tracking-tight text-parch-50">{skill.name}</h2>
        <div className="mt-1 text-xs text-parch-300">{skill.methods.length} methods · {skill.regions.length} regions</div>
        <p className="mt-3 text-sm leading-6 text-parch-300">
          {skill.regions.length ? `Relevant regions: ${cleanText(skill.regions.join(", "))}.` : "No single region requirement listed yet."} Rates are before Equilibrium XP multipliers.
        </p>
      </header>
      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-4">
          <span>Training</span>
          <span className="font-normal text-parch-300">{skill.methods.length}</span>
        </div>
        <MethodTable methods={skill.methods} />
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

export function ResearchBrowser({ catalog }: { catalog: ResearchCatalog }) {
  const [mode, setMode] = useState<Mode>("region");
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState(catalog.regions[0]?.id ?? "");
  const [skillId, setSkillId] = useState(catalog.skills[0]?.id ?? "");
  const normalizedQuery = query.trim().toLowerCase();

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
    if (!normalizedQuery) return catalog.regions;
    return catalog.regions.filter((region) => regionSearchText.get(region.id)?.includes(normalizedQuery));
  }, [catalog.regions, regionSearchText, normalizedQuery]);

  const filteredSkills = useMemo(() => {
    if (!normalizedQuery) return catalog.skills;
    return catalog.skills.filter((skill) => skillSearchText.get(skill.id)?.includes(normalizedQuery));
  }, [catalog.skills, skillSearchText, normalizedQuery]);

  const selectedRegion = catalog.regions.find((region) => region.id === regionId) ?? filteredRegions[0] ?? catalog.regions[0];
  const selectedSkill = catalog.skills.find((skill) => skill.id === skillId) ?? filteredSkills[0] ?? catalog.skills[0];

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-750 pb-3">
        <h2 className="text-sm font-medium text-parch-50">Browse</h2>
        <div className="text-xs text-parch-300">{catalog.datasets.regions} regions · {catalog.datasets.skills} skills · {catalog.datasets.trainingMethods} methods</div>
      </div>

      <div className="panel mt-3 grid text-xs text-parch-300 sm:grid-cols-3 lg:grid-cols-6">
        <div className="border-b border-stone-750 px-3.5 py-2 sm:border-r lg:border-b-0"><span className="text-parch-50">{catalog.datasets.regions}</span> regions</div>
        <div className="border-b border-stone-750 px-3.5 py-2 sm:border-r lg:border-b-0"><span className="text-parch-50">{catalog.datasets.relicTiers}</span> relic tiers</div>
        <div className="border-b border-stone-750 px-3.5 py-2 lg:border-b-0 lg:border-r"><span className="text-parch-50">{catalog.datasets.blessingTiers}</span> blessing tiers</div>
        <div className="border-b border-stone-750 px-3.5 py-2 sm:border-b-0 sm:border-r lg:border-b-0"><span className="text-parch-50">{catalog.datasets.skills}</span> skills</div>
        <div className="border-b border-stone-750 px-3.5 py-2 sm:border-b-0 sm:border-r lg:border-b-0"><span className="text-parch-50">{catalog.datasets.trainingMethods}</span> methods</div>
        <div className="px-3.5 py-2">{catalog.datasets.publishedTasks ? <><span className="text-parch-50">{catalog.datasets.publishedTasks}</span> tasks</> : <span>task list pending</span>}</div>
      </div>

      {catalog.hardRules.length ? (
        <div className="panel mt-3 px-3.5 py-2 text-xs leading-5 text-parch-300">
          {cleanText(catalog.hardRules.join(" · "))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 py-2">
        <div className="flex gap-1" role="group" aria-label="Browse data by">
          <button
            type="button"
            onClick={() => setMode("region")}
            aria-pressed={mode === "region"}
            className={`rounded-sm border px-3 py-1.5 text-xs transition-colors duration-150 ${
              mode === "region"
                ? "border-gem-400 bg-stone-800 text-gem-300"
                : "border-stone-750 text-parch-300 hover:text-parch-50"
            }`}
          >
            Regions
          </button>
          <button
            type="button"
            onClick={() => setMode("skill")}
            aria-pressed={mode === "skill"}
            className={`rounded-sm border px-3 py-1.5 text-xs transition-colors duration-150 ${
              mode === "skill"
                ? "border-gem-400 bg-stone-800 text-gem-300"
                : "border-stone-750 text-parch-300 hover:text-parch-50"
            }`}
          >
            Skills
          </button>
        </div>
        <label className="ml-auto flex min-w-[240px] flex-1 items-center gap-2 border border-stone-750 px-2 py-1 md:max-w-sm">
          <span className="text-xs text-parch-300">Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "region" ? "region, boss, item, skill" : "skill, method, location"} className="min-w-0 flex-1 bg-transparent text-sm text-parch-50 outline-none placeholder:text-parch-300/55 focus:border-gem-400" />
        </label>
      </div>

      <div className="mt-2 grid min-h-[620px] border border-stone-750 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className="border-b border-stone-750 bg-stone-850 lg:border-b-0 lg:border-r">
          <div role="listbox" aria-label={mode === "region" ? "Regions" : "Skills"} className="max-h-[270px] overflow-y-auto lg:sticky lg:top-0 lg:max-h-[calc(100vh-3rem)]">
            {mode === "region" ? filteredRegions.map((region) => {
              const active = selectedRegion?.id === region.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setRegionId(region.id)}
                  className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-stone-750/70 px-3 py-2.5 text-left transition-colors duration-150 ${
                    active ? "bg-stone-800" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <span>
                    <span className={`block text-sm ${active ? "text-gem-300" : "text-parch-50"}`}>{cleanText(region.name)}</span>
                    <span className="mt-0.5 block text-[11px] text-parch-300">{availabilityLabel(region.availability)}</span>
                  </span>
                  <span className="font-mono text-[10px] text-parch-300">{region.training.length}</span>
                </button>
              );
            }) : filteredSkills.map((skill) => {
              const active = selectedSkill?.id === skill.id;
              return (
                <button
                  key={skill.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setSkillId(skill.id)}
                  className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-stone-750/70 px-3 py-2.5 text-left transition-colors duration-150 ${
                    active ? "bg-stone-800" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <span>
                    <span className={`block text-sm ${active ? "text-gem-300" : "text-parch-50"}`}>{skill.name}</span>
                    <span className="mt-0.5 block text-[11px] text-parch-300">{skill.regions.length} regions</span>
                  </span>
                  <span className="font-mono text-[10px] text-parch-300">{skill.methods.length}</span>
                </button>
              );
            })}
            {(mode === "region" ? filteredRegions.length : filteredSkills.length) === 0 ? <p className="px-3 py-3 text-sm text-parch-300">No matches.</p> : null}
          </div>
        </aside>
        <div className="min-w-0 px-3.5 py-4 lg:px-5">
          {mode === "region" && selectedRegion ? <RegionDetail region={selectedRegion} /> : null}
          {mode === "skill" && selectedSkill ? <SkillDetail skill={selectedSkill} /> : null}
        </div>
      </div>
    </section>
  );
}
