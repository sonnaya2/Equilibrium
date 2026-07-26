"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ResearchCatalog,
  ResearchRegion,
  ResearchSkill,
  ResearchTrainingMethod,
  SourceReference,
} from "@/research/catalog";
import { isRegionUnlocked } from "@/league";
import { useBuild } from "@/league/useBuild";
import type { RegionId } from "@/league";
import { GameIcon } from "@/components/GameIcon";

import { regionCrestPath } from "@/lib/gameArt";
import { clipProse } from "./ResearchSection";
import { useDataRegion } from "./DataWorkbench";

const SOURCE_LABEL: Record<SourceReference["source"], string> = {
  "runescape-wiki": "Wiki",
  jagex: "Jagex",
  "rs-analysis": "RS Analysis",
  pvme: "PvME",
  derived: "Other",
};

/** Light wiki/display cleanup — not a full sanitizer. */
function cleanText(value: string): string {
  if (!value) return "";
  return value
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\[(?:edit|citation needed|source|note\s*\d*)\]/gi, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .trim();
}

function availabilityLabel(value: string): string {
  if (value === "automatic_early") return "early unlock";
  return value.replaceAll("_", " ");
}

function methodAccess(method: ResearchTrainingMethod): string {
  const hints = method.regionHints.filter(Boolean);
  if (!hints.length) return "—";

  return cleanText(hints.join(" · "))
    .replaceAll("_plus_", " + ")
    .replaceAll("multi_region_dependency", "multi-region")
    .replaceAll("multi_region", "multi-region")
    .replaceAll("global_if_materials_available", "global if mats available")
    .replaceAll("global_once_supplied", "global once supplied")
    .replaceAll("player_owned_house_global_with_resource_dependency", "PoH · mats by region")
    .replaceAll("materials_and_altar_dependent", "mats + altar")
    .replaceAll("arc_unresolved", "The Arc")
    .replaceAll("_inferred", "")
    .replaceAll("_likely_", " ")
    .replaceAll("_", " ")
    .replace(/ +/g, " ")
    .trim();
}

function sourceKindLabel(kind: string | undefined): string {
  if (!kind) return "Source";
  return SOURCE_LABEL[kind as SourceReference["source"]] ?? kind;
}

function SourceLink({ source }: { source: SourceReference | null | undefined }) {
  if (!source?.url) return null;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={source.title || source.url}
      className="whitespace-nowrap text-gem-300 underline-offset-2 hover:underline"
    >
      {sourceKindLabel(source.source)}
    </a>
  );
}

/** `Name · Wiki` — omits the dot entirely when SourceLink would be null. */
function InlineSource({ source }: { source: SourceReference | null | undefined }) {
  if (!source?.url) return null;
  return (
    <span className="ml-1.5 font-normal">
      · <SourceLink source={source} />
    </span>
  );
}

function MethodTable({ methods }: { methods: ResearchTrainingMethod[] }) {
  if (!methods.length) {
    return <p className="px-3 py-2 text-[13px] text-parch-100">No methods.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full min-w-0">
        <thead>
          <tr>
            <th>Method</th>
            <th>Level</th>
            <th>Rate</th>
            <th>Where</th>
            <th>Req</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method.id} className="align-top">
              <td>
                <div className="font-medium">
                  {clipProse(cleanText(method.method), 90)}
                  <InlineSource source={method.source} />
                </div>
                <div className="mt-0.5 text-[12px] text-parch-100">
                  {method.skill}
                  {method.intensity ? ` · ${method.intensity}` : ""}
                </div>
              </td>
              <td>{method.levelRange || "-"}</td>
              <td className="max-w-[200px] font-mono text-[12px] leading-5">
                {clipProse(method.xpRate || "—", 72)}
              </td>
              <td className="max-w-[200px] secondary leading-5">
                {method.location ? (
                  <div className="text-parch-50">{clipProse(cleanText(method.location), 80)}</div>
                ) : null}
                <div className={method.location ? "mt-0.5" : ""}>
                  {clipProse(methodAccess(method), 90)}
                </div>
                {method.hardRegionRequirement ? (
                  <div className="mt-0.5 text-parch-50">region lock</div>
                ) : null}
              </td>
              <td className="max-w-[200px] secondary leading-5">
                {method.requiredUnlock ? (
                  <div>{clipProse(cleanText(method.requiredUnlock), 80)}</div>
                ) : null}
                {method.requirements.length ? (
                  <div className="mt-0.5">{clipProse(method.requirements.join(" · "), 100)}</div>
                ) : null}
                {method.resourceSource ? (
                  <div className="mt-0.5">
                    Mats: {clipProse(cleanText(method.resourceSource), 72)}
                  </div>
                ) : null}
                {!method.requiredUnlock && !method.requirements.length && !method.resourceSource
                  ? "-"
                  : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegionDetail({ region }: { region: ResearchRegion }) {
  return (
    <article className="data-region-detail">
      <header className="data-region-detail__header">
        <GameIcon
          src={regionCrestPath(region.id)}
          size={58}
          className="data-region-detail__crest"
        />
        <div>
          <h2>
            {cleanText(region.name)}
            <InlineSource source={region.source} />
          </h2>
          <p>
            {availabilityLabel(region.availability)} · {region.content.length} content ·{" "}
            {region.training.length} train · {region.upgrades.length} upgrades
          </p>
        </div>
      </header>

      <div className="data-region-detail__grid">
      <div className="data-region-detail__primary">
      <section className="panel data-region-panel data-region-panel--content">
        <div className="panel-head flex items-baseline justify-between gap-3">
          <span>Content</span>
          <span className="font-normal text-parch-100">{region.content.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table data-region-content-table w-full min-w-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
              </tr>
            </thead>
            <tbody>
              {region.content.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="align-top">
                  <td>
                    {cleanText(row.name)}
                    <InlineSource source={row.source} />
                  </td>
                  <td className="secondary">{row.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel data-region-panel data-region-panel--training">
        <div className="panel-head flex items-baseline justify-between gap-3">
          <span>Training</span>
          <span className="font-normal text-parch-100">{region.training.length}</span>
        </div>
        <MethodTable methods={region.training} />
      </section>
      </div>

      <section className="panel data-region-panel data-region-panel--upgrades">
        <div className="panel-head flex items-baseline justify-between gap-3">
          <span>Upgrades</span>
          <span className="font-normal text-parch-100">{region.upgrades.length} entries</span>
        </div>
        <div className="data-upgrades-list">
          {region.upgrades.length ? (
            region.upgrades.map((upgrade, index) => (
              <div
                key={`upgrade-${index}-${upgrade.name}`}
                className={`data-upgrade-row ${
                  index % 2 === 1 ? "bg-stone-zebra" : ""
                }`}
              >
                <span className="data-upgrade-row__mark" aria-hidden />
                <span className="min-w-0">
                  <span className="data-upgrade-row__name">
                    {cleanText(upgrade.name)}
                    <InlineSource source={upgrade.source} />
                  </span>
                  {upgrade.category ? (
                    <span className="data-upgrade-row__meta">{upgrade.category}</span>
                  ) : null}
                </span>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-[13px] text-parch-100">No upgrades.</p>
          )}
        </div>
      </section>
      </div>
    </article>
  );
}

function SkillDetail({ skill, regionName }: { skill: ResearchSkill; regionName: string }) {
  return (
    <article className="data-region-detail">
      <header className="data-region-detail__header data-region-detail__header--skill">
        <div>
        <h2>{skill.name}</h2>
        <p>
          {skill.methods.length} methods in {cleanText(regionName)} · base game rates
        </p>
        </div>
      </header>
      <section className="panel data-region-panel">
        <div className="panel-head flex items-baseline justify-between gap-3">
          <span>Training</span>
          <span className="font-normal text-parch-100">{skill.methods.length}</span>
        </div>
        <MethodTable methods={skill.methods} />
      </section>
    </article>
  );
}

/** Search haystack only — no audit essays (note/warning/detail). */
function methodSearchText(method: ResearchTrainingMethod): string {
  return [
    method.method,
    method.skill,
    method.location,
    method.requiredUnlock,
    method.resourceSource,
    ...method.requirements,
    ...method.regionHints,
  ].join(" ");
}

export function DataRegionRail({
  catalog,
  regionId,
  onChange,
}: {
  catalog: ResearchCatalog;
  regionId: string;
  onChange: (regionId: string) => void;
}) {
  const { build, loaded } = useBuild();
  const [mineOnly, setMineOnly] = useState(false);

  const unlockedIds = useMemo(() => {
    if (!loaded || !mineOnly) return null;
    return new Set(
      catalog.regions
        .map((r) => r.id as RegionId)
        .filter((id) => isRegionUnlocked(build, id)),
    );
  }, [build, catalog.regions, loaded, mineOnly]);

  const filteredRegions = useMemo(() => {
    if (!unlockedIds) return catalog.regions;
    return catalog.regions.filter((region) => unlockedIds.has(region.id as RegionId));
  }, [catalog.regions, unlockedIds]);

  const toggleMineOnly = () => {
    const next = !mineOnly;
    setMineOnly(next);
    if (next && loaded && !isRegionUnlocked(build, regionId as RegionId)) {
      const first = catalog.regions.find((region) =>
        isRegionUnlocked(build, region.id as RegionId),
      );
      if (first) onChange(first.id);
    }
  };

  return (
    <div className="data-selector-frame">
      <div role="listbox" aria-label="Regions" className="data-selector-rail">
        {filteredRegions.map((region) => {
          const active = regionId === region.id;
          return (
            <button
              key={region.id}
              type="button"
              role="option"
              aria-selected={active}
              aria-label={`${cleanText(region.name)}, ${region.training.length} training methods`}
              onClick={() => onChange(region.id)}
              className={`data-region-tile${active ? " is-on" : ""}`}
            >
              <GameIcon src={regionCrestPath(region.id)} size={34} />
              <span className="data-region-tile__name">{cleanText(region.name)}</span>
              <span className="data-region-tile__count">{region.training.length}</span>
            </button>
          );
        })}
        {filteredRegions.length === 0 ? <p className="data-selector-empty">Nothing matches.</p> : null}
      </div>
      <button
        type="button"
        onClick={toggleMineOnly}
        aria-pressed={mineOnly}
        disabled={!loaded}
        title={loaded ? "Filter to your Map/Build unlocks" : "Loading picks…"}
        className={`comp-facet data-selector-frame__mine disabled:cursor-not-allowed disabled:opacity-40${mineOnly ? " is-on" : ""}`}
      >
        My regions
      </button>
    </div>
  );
}

export function ResearchBrowser({ catalog }: { catalog: ResearchCatalog }) {
  const selectedRegion = useDataRegion() ?? catalog.regions[0];
  const [query, setQuery] = useState("");
  const [skillId, setSkillId] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => setSkillId(""), [selectedRegion?.id]);

  const regionSkills = useMemo(() => {
    if (!selectedRegion) return [];
    const names = new Set(selectedRegion.skills.map((name) => name.toLowerCase()));
    return catalog.skills.filter(
      (skill) => names.has(skill.name.toLowerCase()) || names.has(skill.id.toLowerCase()),
    );
  }, [catalog.skills, selectedRegion]);

  const selectedSkill = regionSkills.find((skill) => skill.id === skillId) ?? null;

  const filteredRegion = useMemo(() => {
    if (!selectedRegion || !normalizedQuery) return selectedRegion;
    const matches = (values: unknown[]) =>
      values.filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
    return {
      ...selectedRegion,
      content: selectedRegion.content.filter((row) =>
        matches([row.name, row.kind, row.detail, row.source?.title]),
      ),
      upgrades: selectedRegion.upgrades.filter((row) =>
        matches([row.name, row.category, row.detail, ...row.requirements]),
      ),
      training: selectedRegion.training.filter((method) =>
        methodSearchText(method).toLowerCase().includes(normalizedQuery),
      ),
    };
  }, [normalizedQuery, selectedRegion]);

  const selectedSkillInRegion = useMemo(() => {
    if (!selectedRegion || !selectedSkill || !filteredRegion) return null;
    return {
      ...selectedSkill,
      methods: filteredRegion.training.filter(
        (method) => method.skill.toLowerCase() === selectedSkill.name.toLowerCase(),
      ),
    };
  }, [filteredRegion, selectedRegion, selectedSkill]);

  return (
    /* Nested .data-screen under the workbench shell breaks the flex height chain and freezes nav. */
    <section className="data-browser flex min-h-0 flex-1 flex-col">
      <div className="data-browser__toolbar">
        <div
          className="data-skill-filters"
          role="listbox"
          aria-label={`Skills in ${selectedRegion?.name ?? "selected region"}`}
        >
          <button
            type="button"
            role="option"
            aria-selected={!selectedSkill}
            className={`data-skill-filter${!selectedSkill ? " is-on" : ""}`}
            onClick={() => setSkillId("")}
          >
            All skills
          </button>
          {regionSkills.map((skill) => {
            const active = selectedSkill?.id === skill.id;
            const methodCount = selectedRegion?.training.filter(
              (method) => method.skill.toLowerCase() === skill.name.toLowerCase(),
            ).length ?? 0;
            return (
              <button
                key={skill.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`data-skill-filter${active ? " is-on" : ""}`}
                onClick={() => setSkillId(skill.id)}
              >
                {skill.name} <span>{methodCount}</span>
              </button>
            );
          })}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search within ${selectedRegion?.name ?? "region"}`}
          aria-label="Search selected region"
          className="field-inset data-browser__search"
        />
      </div>

      <div className="data-browser__stage">
          {selectedSkillInRegion && selectedRegion ? (
            <SkillDetail skill={selectedSkillInRegion} regionName={selectedRegion.name} />
          ) : filteredRegion ? (
            <RegionDetail region={filteredRegion} />
          ) : (
            <p className="py-6 text-[13px] text-parch-100">Select a record.</p>
          )}
      </div>
    </section>
  );
}
