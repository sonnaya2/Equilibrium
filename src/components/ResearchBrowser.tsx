"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ResearchRegion,
  ResearchRegionSummary,
  ResearchSkill,
  ResearchSkillSummary,
  ResearchTrainingMethod,
  SourceReference,
} from "@/research/catalog";
import { isRegionId, isRegionUnlocked, type RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { GameIcon } from "@/components/GameIcon";

import {
  dataEntityIconPath,
  regionCrestPath,
  skillIconPath,
  upgradeIconPath,
} from "@/lib/gameArt";
import {
  contentRewardTokens,
  contentTypeLabel,
  presentContentRewards,
  presentInterestMeta,
  presentInterestName,
  resolveContentLocation,
  resolveTrainingLocation,
} from "@/lib/dataContentPresentation";
import { contentRewardsFull, majorContentRows } from "@/lib/researchRewards";
import { safeExternalHref } from "@/lib/safeHref";
import { safeWikiPage } from "@/lib/wikiArticle";
import { WikiArticleDialog, type WikiArticleTarget } from "@/components/WikiArticleDialog";
import { compareLocale, type SortDir } from "./DataTableOrganize";
import { clipProse } from "./ResearchSection";
import { useDataRegion } from "./DataBrowser";

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

function methodAccess(method: ResearchTrainingMethod): string {
  const hints = method.regionHints.filter(Boolean);
  if (!hints.length) return "—";

  return cleanText(hints.join(" · "))
    .replaceAll("_plus_", " + ")
    .replaceAll("multi_region_dependency", "multi-region")
    .replaceAll("multi_region", "multi-region")
    .replaceAll("global_if_materials_available", "any region if mats available")
    .replaceAll("global_once_supplied", "any region once supplied")
    .replaceAll("player_owned_house_global_with_resource_dependency", "PoH · mats by region")
    .replaceAll("materials_and_altar_dependent", "mats + altar")
    .replaceAll("arc_unresolved", "The Arc")
    .replaceAll("_inferred", "")
    .replaceAll("_likely_", " ")
    .replaceAll("_", " ")
    .replace(/ +/g, " ")
    .trim();
}

function contentName(value: string): string {
  return cleanText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\/\s*early Archaeology$/i, "")
    .replace(/\s+construction and Slayer hub$/i, "")
    .replace(/\s*\/\s*Underworld$/i, "")
    .replace(/\s+(?:Feldip Hills|Armadylean|Zamorakian|Dragonkin)\s+Archaeology$/i, "")
    .replace(/\s+Dig Site\s+(?:full mastery|mini-site)$/i, " Dig Site")
    .replace(/\s+/g, " ")
    .trim();
}

function interestName(value: string): string {
  return presentInterestName(value);
}

function interestMeta(value: string): string {
  return presentInterestMeta(value, 48);
}

function methodRate(rate: string): string {
  const value = cleanText(rate);
  return !value ||
    /^(?:not (?:normalized|optimizer-grade)|no[_ ]official|not[_ ]an?[_ ])/i.test(value)
    ? "—"
    : value.replace(/\b\d{5,}\b/g, (digits) => Number(digits).toLocaleString("en-US"));
}

function sourceKindLabel(kind: string | undefined): string {
  if (!kind) return "Source";
  return SOURCE_LABEL[kind as SourceReference["source"]] ?? kind;
}

function SourceLink({ source }: { source: SourceReference | null | undefined }) {
  const href = safeExternalHref(source?.url);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={source?.title || href}
      className="whitespace-nowrap text-gem-300 underline-offset-2 hover:underline"
    >
      {sourceKindLabel(source?.source)}
    </a>
  );
}

/** `Name · Wiki` — omits the dot entirely when SourceLink would be null. */
function InlineSource({ source }: { source: SourceReference | null | undefined }) {
  if (!safeExternalHref(source?.url)) return null;
  return (
    <span className="ml-1.5 font-normal">
      · <SourceLink source={source} />
    </span>
  );
}

function wikiUrlFromSource(source: SourceReference | null | undefined): string | null {
  const href = safeExternalHref(source?.url);
  if (!href) return null;
  return safeWikiPage(href)?.pageUrl ?? null;
}

function MethodTable({
  methods,
  label,
  regionId,
}: {
  methods: ResearchTrainingMethod[];
  label?: string;
  regionId?: string;
}) {
  if (!methods.length) {
    return <p className="px-3 py-2 text-[13px] text-parch-100">No training methods.</p>;
  }

  const region = regionId && isRegionId(regionId) ? regionId : null;

  return (
    <div className="overflow-x-auto">
      <table className="data-table data-training-table w-full">
        {label ? <caption className="sr-only">{label}</caption> : null}
        <thead>
          <tr>
            <th>Method</th>
            <th>Level</th>
            <th>Rate</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => {
            const skillSrc = skillIconPath(method.skill);
            const rate = methodRate(method.xpRate);
            const fallback = cleanText(method.location) || methodAccess(method);
            const resolved = region
              ? resolveTrainingLocation(region, method.location || fallback, method.regionHints)
              : null;
            const locationLabel = resolved?.label || fallback;
            return (
              <tr key={method.id} className="align-top">
                <td>
                  <div className="truncate font-medium" title={cleanText(method.method)}>
                    {clipProse(cleanText(method.method), 90)}
                    <InlineSource source={method.source} />
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-parch-100">
                    {skillSrc ? (
                      <span className="data-icon-well shrink-0" aria-hidden>
                        <GameIcon src={skillSrc} size={16} />
                      </span>
                    ) : null}
                    <span className="truncate">
                      {method.skill}
                      {method.intensity ? ` · ${method.intensity}` : ""}
                    </span>
                  </div>
                </td>
                <td>{method.levelRange || "-"}</td>
                <td className="data-training-table__rate font-mono" title={rate}>
                  {rate}
                </td>
                <td className="data-training-table__location secondary" title={locationLabel}>
                  {resolved?.href ? (
                    <a
                      href={resolved.href}
                      className="data-location-link"
                      aria-label={`Open ${locationLabel} on map`}
                    >
                      {locationLabel}
                    </a>
                  ) : (
                    locationLabel
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RegionDetail({ region }: { region: ResearchRegion }) {
  const { build, loaded } = useBuild();
  const [preview, setPreview] = useState<WikiArticleTarget | null>(null);
  const relicPicks = loaded
    ? Object.entries(build.relics).sort(([a], [b]) => Number(a) - Number(b))
    : [];

  return (
    <article className="data-region-detail">
      <header className="data-region-detail__header">
        <button
          type="button"
          className="data-region-detail__crest-button"
          aria-label={`View ${cleanText(region.name)} crest`}
          onClick={() =>
            setPreview({
              localArtSrc: regionCrestPath(region.id),
              name: `${cleanText(region.name)} crest`,
              wikiUrl: wikiUrlFromSource(region.source),
            })
          }
        >
          <GameIcon
            src={regionCrestPath(region.id)}
            size={46}
            className="data-region-detail__crest"
          />
        </button>
        <div>
          <h2>{cleanText(region.name)}</h2>
        </div>
        {relicPicks.length ? (
          <div className="data-region-detail__relics" aria-label="Current relic picks">
            <span className="data-region-detail__relic-label">Relics</span>
            {relicPicks.map(([tier, name]) => (
              <span key={tier} className="data-region-detail__relic">
                <span>T{tier}</span> {name}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="data-region-detail__grid">
        <div className="data-region-detail__primary">
          <section className="panel data-region-panel data-region-panel--content">
            <div className="panel-head flex items-baseline justify-between gap-3">
              <span>Major unlocks</span>
              <span className="font-normal text-parch-100">{region.content.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table data-region-content-table w-full min-w-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Rewards / access</th>
                    <th>Type</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {region.content.map((row, index) => {
                    const displayName = contentName(row.name);
                    const iconSrc = dataEntityIconPath({ name: row.name, kind: row.kind });
                    // Icons from full Unlocks/Effects; +N only for capped resolved overflow.
                    const presented = presentContentRewards(
                      contentRewardsFull(row, region.upgrades),
                    );
                    const rewardIcons = presented.icons;
                    const overflowResolved = presented.overflowResolved;
                    const typeLabel = contentTypeLabel(row.kind, row.name);
                    const location = isRegionId(region.id)
                      ? resolveContentLocation(region.id, row.name, row.kind)
                      : { label: null, place: null, href: null };
                    const locationLabel = location.label ?? "—";
                    return (
                      <tr key={`${row.name}-${index}`} className="align-top">
                        <td>
                          <div className="data-content-name">
                            {iconSrc ? (
                              <button
                                type="button"
                                className="data-icon-well data-image-button"
                                aria-label={
                                  wikiUrlFromSource(row.source)
                                    ? `Open ${displayName} wiki article`
                                    : `View ${displayName} image`
                                }
                                onClick={() =>
                                  setPreview({
                                    localArtSrc: iconSrc,
                                    name: displayName,
                                    wikiUrl: wikiUrlFromSource(row.source),
                                    relatedLabels: rewardIcons.map((item) => item.label),
                                    relatedIcons: rewardIcons.map((item) => ({
                                      label: item.label,
                                      src: item.src,
                                    })),
                                  })
                                }
                              >
                                <GameIcon src={iconSrc} size={34} />
                              </button>
                            ) : (
                              <span className="data-icon-well data-icon-well--empty" aria-hidden />
                            )}
                            <span className="data-content-name__text">
                              {displayName}
                              <InlineSource source={row.source} />
                            </span>
                          </div>
                        </td>
                        <td className="data-content-rewards" title={presented.sourceText}>
                          <div className="data-content-rewards__inner">
                            {rewardIcons.length ? (
                              <span className="data-reward-icons" aria-hidden="true">
                                {rewardIcons.map((item) => (
                                  <span
                                    key={`${item.src}-${item.label}`}
                                    className="data-icon-well data-reward-icons__well"
                                    title={item.label}
                                  >
                                    <GameIcon src={item.src} size={22} />
                                  </span>
                                ))}
                                {overflowResolved > 0 ? (
                                  <span className="data-reward-icons__more">
                                    +{overflowResolved}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                            <span className="data-content-rewards__text">
                              {presented.displayText}
                            </span>
                          </div>
                        </td>
                        <td className="data-content-type secondary">{typeLabel}</td>
                        <td className="data-content-location">
                          {location.href ? (
                            <a
                              href={location.href}
                              className="data-location-link"
                              aria-label={`Open ${locationLabel} on map`}
                            >
                              {locationLabel}
                            </a>
                          ) : (
                            <span className="secondary">{locationLabel}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="panel data-region-panel data-region-panel--upgrades">
          <div className="panel-head flex items-baseline justify-between gap-3">
            <span>Points of interest</span>
            <span className="font-normal text-parch-100">{region.upgrades.length}</span>
          </div>
          <div className="data-upgrades-list">
            {region.upgrades.length ? (
              region.upgrades.map((upgrade, index) => {
                const iconSrc =
                  upgradeIconPath(upgrade.name) ??
                  dataEntityIconPath({ name: upgrade.name, kind: upgrade.category });
                const requiredRegions = [...new Set(upgrade.requiredRegions ?? [])];
                const displayUpgradeName = interestName(upgrade.name);
                // Category + name tokens already in memory for extra local art resolve.
                const upgradeRelatedLabels = (() => {
                  const seen = new Set<string>();
                  const out: string[] = [];
                  for (const part of [
                    ...contentRewardTokens(upgrade.name),
                    ...contentRewardTokens(upgrade.category ?? ""),
                    displayUpgradeName,
                    upgrade.category ? interestMeta(upgrade.category) : "",
                  ]) {
                    const label = part.replace(/\s+/g, " ").trim();
                    if (!label) continue;
                    const key = label.toLowerCase();
                    if (seen.has(key)) continue;
                    seen.add(key);
                    out.push(label);
                  }
                  return out;
                })();
                return (
                  <div
                    key={`upgrade-${index}-${upgrade.name}`}
                    className={`data-upgrade-row ${index % 2 === 1 ? "bg-stone-zebra" : ""}`}
                  >
                    {iconSrc ? (
                      <button
                        type="button"
                        className="data-icon-well data-image-button"
                        aria-label={
                          wikiUrlFromSource(upgrade.source)
                            ? `Open ${displayUpgradeName} wiki article`
                            : `View ${displayUpgradeName} image`
                        }
                        onClick={() =>
                          setPreview({
                            localArtSrc: iconSrc,
                            name: displayUpgradeName,
                            wikiUrl: wikiUrlFromSource(upgrade.source),
                            relatedLabels: upgradeRelatedLabels,
                          })
                        }
                      >
                        <GameIcon src={iconSrc} size={28} />
                      </button>
                    ) : (
                      <span className="data-icon-well data-icon-well--empty" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="data-upgrade-row__name">
                        {interestName(upgrade.name)}
                        <InlineSource source={upgrade.source} />
                        {requiredRegions.length > 0 ? (
                          <span
                            className="data-upgrade-row__regions"
                            aria-label={
                              requiredRegions.length > 1
                                ? `Region combo: ${requiredRegions.join(" + ")}`
                                : `Region: ${requiredRegions[0]}`
                            }
                          >
                            {requiredRegions.map((regionId) => (
                              <GameIcon key={regionId} src={regionCrestPath(regionId)} size={20} />
                            ))}
                          </span>
                        ) : null}
                      </span>
                      {upgrade.category ? (
                        <span className="data-upgrade-row__meta">
                          {interestMeta(upgrade.category)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="px-3 py-2 text-[13px] text-parch-100">None listed.</p>
            )}
          </div>
        </section>
      </div>
      <WikiArticleDialog target={preview} onClose={() => setPreview(null)} />
    </article>
  );
}

function SkillDetail({
  skill,
  regionName,
  regionId,
  extra,
}: {
  skill: ResearchSkill;
  regionName: string;
  regionId?: string;
  extra?: ReactNode;
}) {
  return (
    <article className="data-skill-detail">
      {skill.methods.length ? (
        <section className="panel data-region-panel">
          <MethodTable
            methods={skill.methods}
            regionId={regionId}
            label={`${skill.name} training in ${cleanText(regionName)}`}
          />
        </section>
      ) : null}
      {extra}
      {!skill.methods.length && !extra ? (
        <p className="data-empty">Nothing for {cleanText(regionName)} yet.</p>
      ) : null}
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
  regions,
  regionId,
  onChange,
}: {
  regions: ResearchRegionSummary[];
  regionId: string;
  onChange: (regionId: string) => void;
}) {
  const { build, loaded } = useBuild();
  const [mineOnly, setMineOnly] = useState(false);

  const unlockedIds = useMemo(() => {
    if (!loaded || !mineOnly) return null;
    return new Set(
      regions.map((r) => r.id as RegionId).filter((id) => isRegionUnlocked(build, id)),
    );
  }, [build, loaded, mineOnly, regions]);

  const filteredRegions = useMemo(() => {
    if (!unlockedIds) return regions;
    return regions.filter((region) => unlockedIds.has(region.id as RegionId));
  }, [regions, unlockedIds]);

  const toggleMineOnly = () => {
    const next = !mineOnly;
    setMineOnly(next);
    if (next && loaded && !isRegionUnlocked(build, regionId as RegionId)) {
      const first = regions.find((region) => isRegionUnlocked(build, region.id as RegionId));
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
              aria-label={`${cleanText(region.name)}, ${region.training} training methods`}
              onClick={() => onChange(region.id)}
              className={`data-region-tile${active ? " is-on" : ""}`}
            >
              <GameIcon src={regionCrestPath(region.id)} size={26} />
              <span className="data-region-tile__name">{cleanText(region.name)}</span>
              <span className="data-region-tile__count">{region.training}</span>
            </button>
          );
        })}
        {filteredRegions.length === 0 ? (
          <p className="data-selector-empty">No regions match.</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={toggleMineOnly}
        aria-pressed={mineOnly}
        disabled={!loaded}
        title={loaded ? "Only regions you've unlocked" : "Loading your picks…"}
        className={`chip data-selector-frame__mine disabled:cursor-not-allowed disabled:opacity-40${mineOnly ? " is-on" : ""}`}
      >
        My regions
      </button>
    </div>
  );
}

export function ResearchBrowser({
  skills,
  skillDetails,
}: {
  skills: ResearchSkillSummary[];
  skillDetails: Partial<Record<string, ReactNode>>;
}) {
  const selectedRegion = useDataRegion();
  const [query, setQuery] = useState("");
  const [skillId, setSkillId] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortMode, setSortMode] = useState<"name" | "catalog">("name");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => setSkillId(""), [selectedRegion?.id]);

  const regionSkills = useMemo(() => {
    if (!selectedRegion) return [];
    // Membership only from training methods + region.skills + intentional embeds.
    // Free-text content.includes(skill) invents false chips (e.g. "Fish farming" → Farming).
    const names = new Set(selectedRegion.skills.map((name) => name.toLowerCase()));
    for (const method of selectedRegion.training) {
      if (method.skill) names.add(method.skill.toLowerCase());
    }
    return skills.filter(
      (skill) =>
        names.has(skill.name.toLowerCase()) ||
        names.has(skill.id.toLowerCase()) ||
        skill.id in skillDetails,
    );
  }, [selectedRegion, skillDetails, skills]);

  const selectedSkill = regionSkills.find((skill) => skill.id === skillId) ?? null;

  const filteredRegion = useMemo(() => {
    if (!selectedRegion) return selectedRegion;
    const matches = (values: unknown[]) =>
      values.filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
    // Collapse multi-boss package children (Sanctum) — not place hubs (Lost Grove ≠ Solak).
    const majorContent = majorContentRows(selectedRegion.content, selectedRegion.upgrades);
    const content = normalizedQuery
      ? majorContent.filter((row) =>
          matches([
            row.name,
            row.kind,
            row.detail,
            // Empty catalog detail is common on majors — still match reward chips.
            contentRewardsFull(row, selectedRegion.upgrades),
            row.source?.title,
          ]),
        )
      : majorContent;
    const upgrades = normalizedQuery
      ? selectedRegion.upgrades.filter((row) =>
          matches([row.name, row.category, row.detail, ...row.requirements]),
        )
      : selectedRegion.upgrades;
    const training = normalizedQuery
      ? selectedRegion.training.filter((method) =>
          methodSearchText(method).toLowerCase().includes(normalizedQuery),
        )
      : selectedRegion.training;

    const byName = (a: string, b: string) => compareLocale(a, b, sortDir);
    return {
      ...selectedRegion,
      content: sortMode === "name" ? [...content].sort((a, b) => byName(a.name, b.name)) : content,
      upgrades:
        sortMode === "name" ? [...upgrades].sort((a, b) => byName(a.name, b.name)) : upgrades,
      training:
        sortMode === "name" ? [...training].sort((a, b) => byName(a.method, b.method)) : training,
    };
  }, [normalizedQuery, selectedRegion, sortDir, sortMode]);

  const selectedSkillInRegion = useMemo(() => {
    if (!selectedRegion || !selectedSkill || !filteredRegion) return null;
    return {
      ...selectedSkill,
      regions: [selectedRegion.id],
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
            className={`data-skill-filter data-skill-filter--all${!selectedSkill ? " is-on" : ""}`}
            onClick={() => setSkillId("")}
          >
            All skills
          </button>
          {regionSkills.map((skill) => {
            const active = selectedSkill?.id === skill.id;
            const iconSrc = skillIconPath(skill.id || skill.name);
            const methodCount =
              selectedRegion?.training.filter(
                (method) => method.skill.toLowerCase() === skill.name.toLowerCase(),
              ).length ?? 0;
            return (
              <button
                key={skill.id}
                type="button"
                role="option"
                aria-selected={active}
                aria-label={`${skill.name}, ${methodCount} training methods`}
                title={`${skill.name} · ${methodCount} methods`}
                className={`data-skill-filter data-skill-filter--icon${active ? " is-on" : ""}`}
                onClick={() => setSkillId(skill.id)}
              >
                {iconSrc ? (
                  <GameIcon src={iconSrc} size={28} />
                ) : (
                  <span className="data-skill-filter__fallback">{skill.name}</span>
                )}
                {methodCount ? (
                  <span className="data-skill-filter__count">{methodCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="data-browser__tools">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${selectedRegion?.name ?? "region"}`}
            aria-label="Search this region"
            className="ui-field data-browser__search"
          />
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as "name" | "catalog")}
            aria-label="Sort mode"
            className="ui-field data-browser__sort"
          >
            <option value="name">Name</option>
            <option value="catalog">As listed</option>
          </select>
          <button
            type="button"
            className="data-organize__sort"
            disabled={sortMode !== "name"}
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={
              sortDir === "asc"
                ? "Sort A to Z. Activate for Z to A."
                : "Sort Z to A. Activate for A to Z."
            }
            title={sortDir === "asc" ? "A–Z · click for Z–A" : "Z–A · click for A–Z"}
          >
            <span className="data-organize__sort-label">{sortDir === "asc" ? "A–Z" : "Z–A"}</span>
            <span className="data-organize__arrow" aria-hidden>
              {sortDir === "asc" ? "↓" : "↑"}
            </span>
          </button>
        </div>
      </div>

      <div className="data-browser__stage">
        {selectedSkillInRegion && selectedRegion ? (
          <SkillDetail
            skill={selectedSkillInRegion}
            regionName={selectedRegion.name}
            regionId={selectedRegion.id}
            extra={skillDetails[selectedSkillInRegion.id]}
          />
        ) : filteredRegion ? (
          <RegionDetail region={filteredRegion} />
        ) : (
          <p className="py-6 text-[13px] text-parch-100">Pick a region.</p>
        )}
      </div>
    </section>
  );
}
