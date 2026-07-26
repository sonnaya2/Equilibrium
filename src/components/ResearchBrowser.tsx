"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ResearchCatalog,
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
import { clipProse } from "./ResearchSection";

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

function regionName(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function upgradeRegionAccess(upgrade: ResearchUpgrade): string {
  if (upgrade.comboLabel) return upgrade.comboLabel;

  const required = upgrade.requiredRegions ?? [];
  if (required.length > 1) {
    return `Combo: ${required.map(regionName).join(" + ")}`;
  }

  const hints = upgrade.regionHints ?? [];
  if (hints.length > 1) {
    if (upgrade.regionRequirementType === "all_required") {
      return `Combo: ${hints.map(regionName).join(" + ")}`;
    }
    return `Chain: ${hints.map(regionName).join(" / ")}`;
  }

  return "";
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
    .replaceAll("arc_unresolved", "The Arc (unconfirmed)")
    .replaceAll("_inferred", " (inferred)")
    .replaceAll("_likely_", " likely ")
    .replaceAll("_", " ");
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
function InlineSource({
  source,
  stopClick,
}: {
  source: SourceReference | null | undefined;
  stopClick?: boolean;
}) {
  if (!source?.url) return null;
  return (
    <span
      className="ml-1.5 font-normal"
      onClick={stopClick ? (e) => e.stopPropagation() : undefined}
    >
      · <SourceLink source={source} />
    </span>
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
    return <p className="px-3 py-2 text-[13px] text-parch-100">No methods.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[900px]">
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
                  <div className="font-medium">
                    {cleanText(method.method)}
                    <InlineSource source={method.source} stopClick />
                  </div>
                  <div className="mt-0.5 text-[12px] text-parch-100">
                    {method.skill}{method.intensity ? ` · ${method.intensity}` : ""}
                  </div>
                  {method.note ? (
                    <div className="mt-0.5 max-w-lg text-[12px] text-parch-300" title={method.note}>
                      {clipProse(method.note, 100)}
                    </div>
                  ) : null}
                </td>
                <td>{method.levelRange || "-"}</td>
                <td className="max-w-[250px] font-mono leading-5">{method.xpRate || "—"}</td>
                <td className="max-w-[230px] secondary leading-5">
                  {method.location ? <div className="text-parch-50">{cleanText(method.location)}</div> : null}
                  <div className={method.location ? "mt-0.5" : ""}>{methodAccess(method)}</div>
                  {method.hardRegionRequirement ? <div className="mt-0.5 text-parch-50">region lock</div> : null}
                </td>
                <td className="max-w-[240px] secondary leading-5">
                  {method.requiredUnlock ? <div>{cleanText(method.requiredUnlock)}</div> : null}
                  {method.requirements.length ? <div className="mt-0.5">{method.requirements.join(" · ")}</div> : null}
                  {method.resourceSource ? <div className="mt-0.5">Mats: {cleanText(method.resourceSource)}</div> : null}
                  {!method.requiredUnlock && !method.requirements.length && !method.resourceSource ? "-" : null}
                </td>
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
    <article className="space-y-3">
      <header>
        <h2 className="text-xl font-semibold text-parch-50">
          {cleanText(region.name)}
          <InlineSource source={region.source} />
        </h2>
        <div className="mt-0.5 text-[11px] text-parch-100">
          {availabilityLabel(region.availability)} · {region.content.length} content · {region.training.length} train · {region.upgrades.length} upgrades
        </div>
      </header>

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-3">
          <span>Content</span>
          <span className="font-normal text-parch-100">{region.content.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[480px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
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
                    <td>
                      {cleanText(row.name)}
                      <InlineSource source={row.source} stopClick />
                    </td>
                    <td className="secondary">{row.kind}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-3">
          <span>Upgrades</span>
          <span className="font-normal text-parch-100">{region.upgrades.length}</span>
        </div>
        <div>
          {region.upgrades.length ? (
            region.upgrades.map((upgrade, index) => {
              const focused = focusedUpgrade === index;
              return (
                <button
                  type="button"
                  key={`upgrade-${index}-${upgrade.name}`}
                  onClick={() => onFocus({ kind: "upgrade", index })}
                  aria-pressed={focused}
                  className={`flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-stone-750/70 px-3 py-1.5 text-left last:border-b-0 ${
                    focused ? "bg-stone-raised" : index % 2 === 1 ? "bg-stone-zebra" : ""
                  }`}
                >
                  <span className="text-[13px] font-medium text-parch-50">
                    {cleanText(upgrade.name)}
                    <InlineSource source={upgrade.source} stopClick />
                  </span>
                  {upgrade.category ? (
                    <span className="text-[11px] text-parch-300">{upgrade.category}</span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-2 text-[13px] text-parch-100">No upgrades.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-3">
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
    <article className="space-y-3">
      <header>
        <h2 className="text-xl font-semibold text-parch-50">{skill.name}</h2>
        <div className="mt-0.5 text-[11px] text-parch-100">
          {skill.methods.length} methods · {skill.regions.length} regions
          {skill.regions.length ? ` · ${cleanText(skill.regions.join(", "))}` : ""}
          {" · base rates (no League mult)"}
        </div>
      </header>
      <section className="panel">
        <div className="panel-head flex items-baseline justify-between gap-3">
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
          title={loaded ? "Filter to your Map/Build unlocks" : "Loading picks…"}
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
          aria-label="Search"
          className="field-inset ml-auto min-w-[12rem] flex-1 px-2 py-1 text-sm text-parch-50 placeholder:text-parch-400 md:max-w-sm"
        />
      </div>

      {/* Prism twin desk: crest rail | stage | full sources */}
      <div className="research-browse-desk">
        <aside className="comp-crest-rail border-0">
          <p className="border-b border-stone-750 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-parch-100">
            {mode === "region" ? "Regions" : "Skills"}
          </p>
          <div
            role="listbox"
            aria-label={mode === "region" ? "Regions" : "Skills"}
            className="min-h-0 flex-1"
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
              <p className="px-2.5 py-2 text-[12px] text-parch-100">Nothing matches.</p>
            ) : null}
          </div>
        </aside>
        <div className="comp-stage-col min-w-0 px-2.5 py-2">
          {mode === "region" && selectedRegion ? (
            <RegionDetail region={selectedRegion} focus={focus} onFocus={setFocus} />
          ) : mode === "skill" && selectedSkill ? (
            <SkillDetail skill={selectedSkill} focus={focus} onFocus={setFocus} />
          ) : (
            <p className="py-6 text-[13px] text-parch-100">Select a record.</p>
          )}
        </div>
      </div>
    </section>
  );
}
