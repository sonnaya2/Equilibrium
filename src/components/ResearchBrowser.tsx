"use client";

import { useMemo, useState } from "react";
import type {
  ResearchCatalog,
  ResearchRegion,
  ResearchSkill,
  ResearchTrainingMethod,
} from "@/research/catalog";

type Mode = "region" | "skill";

function availabilityLabel(value: string): string {
  switch (value) {
    case "starting":
      return "starting";
    case "automatic_early":
      return "early unlock";
    case "elective":
      return "elective";
    default:
      return value.replaceAll("_", " ");
  }
}

function confidenceLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function methodAccess(method: ResearchTrainingMethod): string {
  if (method.regionHints.length === 0) return "not mapped";
  return method.regionHints.join(" · ").replaceAll("_", " ");
}

function SourceLink({ source }: { source: string }) {
  if (!source) return <span className="text-parch-300">—</span>;
  if (!source.startsWith("http")) return <span className="text-parch-300">{source}</span>;

  return (
    <a
      href={source}
      target="_blank"
      rel="noreferrer"
      className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-brass-400"
    >
      source
    </a>
  );
}

function MethodTable({ methods }: { methods: ResearchTrainingMethod[] }) {
  if (methods.length === 0) {
    return <p className="border-t border-stone-750 py-3 text-sm text-parch-300">No mapped method in the current scrape.</p>;
  }

  return (
    <div className="overflow-x-auto border-t border-stone-750">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead className="text-xs text-parch-300">
          <tr className="border-b border-stone-750">
            <th className="py-2 pr-4 font-medium">Method</th>
            <th className="py-2 pr-4 font-medium">Level</th>
            <th className="py-2 pr-4 font-medium">Base rate / throughput</th>
            <th className="py-2 pr-4 font-medium">Access</th>
            <th className="py-2 pr-4 font-medium">Freshness</th>
            <th className="py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method.id} className="border-b border-stone-750/70 align-top">
              <td className="py-3 pr-4">
                <div className="font-medium text-parch-50">{method.method}</div>
                {method.skill ? <div className="mt-0.5 text-xs text-parch-300">{method.skill}</div> : null}
                {method.note ? <div className="mt-1 max-w-xl text-xs leading-5 text-parch-300">{method.note}</div> : null}
                {method.warning ? (
                  <div className="mt-1 max-w-xl text-xs leading-5 text-amber-200">{method.warning}</div>
                ) : null}
              </td>
              <td className="py-3 pr-4 text-parch-300">{method.levelRange || "—"}</td>
              <td className="py-3 pr-4 font-mono text-xs leading-5 text-parch-50">{method.xpRate || "not normalized"}</td>
              <td className="py-3 pr-4 text-xs leading-5 text-parch-300">{methodAccess(method)}</td>
              <td className="py-3 pr-4 text-xs leading-5 text-parch-300">
                <div>{method.freshness || "unspecified"}</div>
                <div className="mt-0.5 text-[11px] text-parch-300/75">{confidenceLabel(method.confidence)}</div>
              </td>
              <td className="py-3 text-xs"><SourceLink source={method.source} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegionDetail({ region }: { region: ResearchRegion }) {
  return (
    <article>
      <header className="pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-parch-50">{region.name}</h2>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-parch-300">
              {availabilityLabel(region.availability)} · {region.training.length} training methods · {region.upgrades.length} major upgrades
            </div>
          </div>
          {region.skills.length ? (
            <div className="max-w-2xl text-right text-xs leading-5 text-parch-300">{region.skills.join(" · ")}</div>
          ) : null}
        </div>

        {region.aliases.length ? (
          <div className="mt-3 text-xs text-parch-300">Also grouped here: {region.aliases.join(", ")}</div>
        ) : null}
      </header>

      {region.hardRules.length ? (
        <section className="border-y border-brass-400/40 bg-brass-400/[0.04] py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass-400">Planner rules</div>
          {region.hardRules.map((rule) => (
            <p key={rule} className="mt-1 text-sm leading-6 text-parch-50">{rule}</p>
          ))}
        </section>
      ) : null}

      <section className="py-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Areas and access</h3>
            <div className="mt-2 border-t border-stone-750">
              {region.areas.length ? region.areas.map((area) => (
                <div key={area} className="border-b border-stone-750/70 py-2 text-sm text-parch-50">{area}</div>
              )) : <div className="py-2 text-sm text-parch-300">No area list captured yet.</div>}
            </div>
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Audit notes</h3>
            <div className="mt-2 border-t border-stone-750">
              {region.warnings.length ? region.warnings.map((warning) => (
                <p key={warning} className="border-b border-stone-750/70 py-2 text-xs leading-5 text-parch-300">{warning}</p>
              )) : <p className="py-2 text-xs text-parch-300">No region-specific warning in the current snapshot.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="pb-5">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Mapped content</h3>
          <span className="text-xs text-parch-300">{region.content.length} rows</span>
        </div>
        <div className="overflow-x-auto border-t border-stone-750">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="text-xs text-parch-300">
              <tr className="border-b border-stone-750">
                <th className="py-2 pr-4 font-medium">Content</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">What matters</th>
                <th className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {region.content.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-b border-stone-750/70 align-top">
                  <td className="py-2.5 pr-4 text-parch-50">{row.name}</td>
                  <td className="py-2.5 pr-4 text-xs text-parch-300">{row.kind}</td>
                  <td className="py-2.5 pr-4 text-xs leading-5 text-parch-300">{row.detail || "—"}</td>
                  <td className="py-2.5 text-[11px] text-parch-300">{confidenceLabel(row.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pb-5">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Major upgrades</h3>
          <span className="text-xs text-parch-300">{region.upgrades.length} rows</span>
        </div>
        <div className="border-t border-stone-750">
          {region.upgrades.length ? region.upgrades.map((upgrade) => (
            <div key={upgrade.name} className="grid gap-1 border-b border-stone-750/70 py-3 md:grid-cols-[minmax(180px,0.35fr)_minmax(0,1fr)_150px] md:gap-5">
              <div>
                <div className="text-sm font-medium text-parch-50">{upgrade.name}</div>
                <div className="mt-0.5 text-xs text-parch-300">{upgrade.category}</div>
              </div>
              <div className="text-xs leading-5 text-parch-300">
                {upgrade.detail || "No normalized detail yet."}
                {upgrade.requirements.length ? <div className="mt-1">Requires: {upgrade.requirements.join(", ")}</div> : null}
              </div>
              <div className="text-[11px] text-parch-300 md:text-right">{confidenceLabel(upgrade.confidence)}</div>
            </div>
          )) : <p className="py-3 text-sm text-parch-300">No major upgrade rows captured for this region yet.</p>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Training</h3>
          <span className="text-xs text-parch-300">base-game rates unless noted</span>
        </div>
        <MethodTable methods={region.training} />
      </section>
    </article>
  );
}

function SkillDetail({ skill }: { skill: ResearchSkill }) {
  return (
    <article>
      <header className="pb-5">
        <h2 className="text-2xl font-semibold tracking-tight text-parch-50">{skill.name}</h2>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-parch-300">
          {skill.methods.length} mapped methods · {skill.regions.length} region dependencies
        </div>
        <p className="mt-3 text-sm leading-6 text-parch-300">
          {skill.regions.length ? `Relevant region picks: ${skill.regions.join(", ")}.` : "No region dependency has been normalized yet."}
          {" "}Rates below are reference rates before Equilibrium XP multipliers.
        </p>
      </header>
      <MethodTable methods={skill.methods} />
    </article>
  );
}

export function ResearchBrowser({ catalog }: { catalog: ResearchCatalog }) {
  const [mode, setMode] = useState<Mode>("region");
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState(catalog.regions[0]?.id ?? "");
  const [skillId, setSkillId] = useState(catalog.skills[0]?.id ?? "");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRegions = useMemo(() => {
    if (!normalizedQuery) return catalog.regions;
    return catalog.regions.filter((region) =>
      [region.name, region.id, ...region.aliases, ...region.skills, ...region.areas]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [catalog.regions, normalizedQuery]);

  const filteredSkills = useMemo(() => {
    if (!normalizedQuery) return catalog.skills;
    return catalog.skills.filter((skill) =>
      [skill.name, ...skill.regions, ...skill.methods.map((method) => method.method)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [catalog.skills, normalizedQuery]);

  const selectedRegion = catalog.regions.find((region) => region.id === regionId) ?? catalog.regions[0];
  const selectedSkill = catalog.skills.find((skill) => skill.id === skillId) ?? catalog.skills[0];

  return (
    <section>
      <header className="border-b border-stone-750 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-parch-50">Research ledger</h1>
            <p className="mt-1 text-sm text-parch-300">
              Region gates, training methods, upgrade chains and uncertainty from the {catalog.snapshotDate} scrape.
            </p>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-parch-300">
            {catalog.regions.length} regions · {catalog.skills.length} skills
          </div>
        </div>
      </header>

      {catalog.hardRules.length ? (
        <div className="border-b border-stone-750 py-2 text-xs leading-5 text-parch-300">
          {catalog.hardRules.join(" · ")}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 py-3">
        <div className="flex border border-stone-750" role="group" aria-label="Browse data by">
          <button
            type="button"
            onClick={() => setMode("region")}
            className={`px-3 py-1.5 text-xs ${mode === "region" ? "bg-parch-50 text-stone-950" : "text-parch-300 hover:text-parch-50"}`}
          >
            Regions
          </button>
          <button
            type="button"
            onClick={() => setMode("skill")}
            className={`border-l border-stone-750 px-3 py-1.5 text-xs ${mode === "skill" ? "bg-parch-50 text-stone-950" : "text-parch-300 hover:text-parch-50"}`}
          >
            Skills
          </button>
        </div>

        <label className="ml-auto flex min-w-[240px] flex-1 items-center gap-2 border-b border-stone-750 px-1 py-1 md:max-w-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-parch-300">Find</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === "region" ? "region, skill, area" : "skill, method, region"}
            className="min-w-0 flex-1 bg-transparent text-sm text-parch-50 outline-none placeholder:text-parch-300/55"
          />
        </label>
      </div>

      <div className="grid min-h-[620px] lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className="border-b border-stone-750 lg:border-b-0 lg:border-r">
          <div className="max-h-[270px] overflow-y-auto lg:sticky lg:top-0 lg:max-h-[calc(100vh-3rem)]">
            {mode === "region"
              ? filteredRegions.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => setRegionId(region.id)}
                    className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-stone-750/70 px-3 py-2.5 text-left ${selectedRegion?.id === region.id ? "border-l-2 border-l-brass-400 bg-brass-400/[0.035]" : "border-l-2 border-l-transparent hover:bg-white/[0.02]"}`}
                  >
                    <span>
                      <span className="block text-sm text-parch-50">{region.name}</span>
                      <span className="mt-0.5 block text-[11px] text-parch-300">{availabilityLabel(region.availability)}</span>
                    </span>
                    <span className="font-mono text-[10px] text-parch-300">{region.training.length}</span>
                  </button>
                ))
              : filteredSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setSkillId(skill.id)}
                    className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-stone-750/70 px-3 py-2.5 text-left ${selectedSkill?.id === skill.id ? "border-l-2 border-l-brass-400 bg-brass-400/[0.035]" : "border-l-2 border-l-transparent hover:bg-white/[0.02]"}`}
                  >
                    <span>
                      <span className="block text-sm text-parch-50">{skill.name}</span>
                      <span className="mt-0.5 block text-[11px] text-parch-300">{skill.regions.length} regions</span>
                    </span>
                    <span className="font-mono text-[10px] text-parch-300">{skill.methods.length}</span>
                  </button>
                ))}

            {(mode === "region" ? filteredRegions.length : filteredSkills.length) === 0 ? (
              <p className="px-3 py-4 text-sm text-parch-300">No match in this snapshot.</p>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 px-0 py-5 lg:px-6">
          {mode === "region" && selectedRegion ? <RegionDetail region={selectedRegion} /> : null}
          {mode === "skill" && selectedSkill ? <SkillDetail skill={selectedSkill} /> : null}
        </div>
      </div>
    </section>
  );
}
