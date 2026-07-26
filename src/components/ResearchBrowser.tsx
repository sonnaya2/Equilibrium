"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

import {
  dataEntityIconPath,
  regionCrestPath,
  skillIconPath,
  upgradeIconPath,
} from "@/lib/gameArt";
import { safeExternalHref } from "@/lib/safeHref";
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

const CONTENT_ACCESS: Record<string, string> = {
  "Varrock Dig Site / early Archaeology": "Archaeology Guild · monolith · museum",
  "Pale wisps near Draynor": "Pale energy · Divination 1–10",
  "Fort Forinthry construction and Slayer hub": "Fort buildings · chapel · Slayer hub",
  "City of Um / Underworld": "Ritual site · City of Um services",
  "Hermod, the Spirit of War": "Hermodic plates · Necromancy power armour",
};

const CONTENT_REWARD_KEYS: Record<string, string> = {
  "Sanctum of Rebirth": "Sanctum of Rebirth uniques",
  "Rasial, the First Necromancer": "First Necromancer's equipment",
  "The Gate of Elidinis": "Gate of Elidinis uniques",
  "Vermyx, Brood Mother": "Sanctum of Rebirth uniques",
  "Kezalam, the Wanderer": "Sanctum of Rebirth uniques",
  "Nakatra, Devourer Eternal": "Sanctum of Rebirth uniques",
};

function contentRewards(
  row: ResearchRegion["content"][number],
  upgrades: ResearchRegion["upgrades"],
): string {
  const access = CONTENT_ACCESS[row.name];
  if (access) return access;

  const key =
    CONTENT_REWARD_KEYS[row.name] ??
    contentName(row.name).replace(/^The\s+/i, "").replace(/,.*/, "");
  const upgrade = upgrades.find((candidate) =>
    cleanText(candidate.name).toLocaleLowerCase().startsWith(key.toLocaleLowerCase()),
  );
  if (upgrade?.detail) {
    const detail = cleanText(upgrade.detail);
    const rewards = detail.match(/(?:^| · )(?:Unlocks|Effects):\s*([^·]+)/i)?.[1]
      ?? detail.split(" · ")[0];
    return clipProse(rewards, 96);
  }

  const detail = cleanText(row.detail ?? "");
  if (detail && !/(?:working league mapping|catalyst|unannounced|locality boundary)/i.test(detail)) {
    return clipProse(detail, 96);
  }
  return "—";
}

function interestName(value: string): string {
  const name = cleanText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+progression$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // Non-Archaeology keepers (must stay ahead of generic trailing strips)
  if (/^Binding contract\b/i.test(name)) return "Ancient Summoning";
  if (/^Master thief's lockpick \+ stethoscope\b/i.test(name)) return "Master thief's tools";
  if (/^Ava's device chain$/i.test(name)) return "Ava's devices";
  if (/^Research team size ladder\b/i.test(name)) return "Research team upgrades";
  if (/^Underworld Grimoire skilling milestone ladder$/i.test(name)) return "Underworld Grimoire";
  if (/^Prayer training infrastructure stack$/i.test(name)) return "Prayer training";
  if (/^War's Retreat hub amenities$/i.test(name)) return "War's Retreat";

  // Archaeology — exact / prefix renames (player-facing short labels)
  if (/^Chronotes currency economy\b/i.test(name)) return "Chronotes";
  if (/^Archaeology Guild Shop and qualification upgrades$/i.test(name)) {
    return "Archaeology Guild shop";
  }
  if (/^Archaeology Guild qualifications Intern\s*[→-]\s*Professor$/i.test(name)) {
    return "Guild qualifications";
  }
  if (/^Archaeology collectors and collection system$/i.test(name)) return "Collectors";
  if (/^Collectors Assemble\b/i.test(name)) return "Collectors Assemble";
  if (/^Hireable research team recruitment ladder$/i.test(name)) return "Research team";
  if (/^Archaeology research system$/i.test(name)) return "Archaeology research";
  if (/^Archaeology research team permanent\b/i.test(name)) return "Research team";
  if (/^Mysterious monolith\b/i.test(name)) return "Mysterious monolith";
  if (/^Professor additional relic loadout\b/i.test(name)) return "Extra relic loadout";
  if (/^Mattock precision upgrades\b/i.test(name)) return "Mattock precision";
  if (/^Tetracompass pieces\b/i.test(name)) return "Tetracompass";
  if (/^Museum donation bin\b/i.test(name)) return "Museum donation bin";
  if (/^Velucia museum\b/i.test(name)) return "Velucia collections";
  if (/^Archaeology Campus and Varrock Dig Site hub$/i.test(name)) return "Archaeology Campus";
  if (/^Screening station\b/i.test(name)) return "Screening station";
  if (/^Archaeologist's workbench\b/i.test(name)) return "Archaeologist's workbench";
  if (/^Spear of Annihilation\b/i.test(name)) return "Spear of Annihilation";
  if (/^Font of Life relic\b/i.test(name)) return "Font of Life";
  if (/^Guildmaster Tony's mattock$/i.test(name)) return "Guildmaster Tony's mattock";
  if (/^Master archaeologist's outfit\b/i.test(name)) return "Master archaeologist outfit";
  if (/^Archaeologist's outfit$/i.test(name)) return "Archaeologist's outfit";
  if (/^High-value collector first-time permanent rewards$/i.test(name)) {
    return "Collector rewards";
  }
  if (/^Warforge Dig Site\b/i.test(name)) return "Warforge Dig Site";
  if (/^Stormguard Citadel Dig Site\b/i.test(name)) return "Stormguard Dig Site";
  if (/^Infernal Source Dig Site\b/i.test(name)) return "Infernal Source Dig Site";
  if (/^Senntisten Dig Site$/i.test(name)) return "Senntisten Dig Site";
  if (/^Imcando tools family\b/i.test(name)) return "Imcando tools";
  if (/^Dragon mattock\b/i.test(name)) return "Dragon mattock";
  if (/^Mattock of Time and Space$/i.test(name)) return "Mattock of Time and Space";
  if (/^It Belongs in a Museum!/i.test(name)) return "Museum log";
  if (/^Archaeology culture Expert titles$/i.test(name)) return "Expert titles";

  // Generic trailing clutter (safe for non-Archaeology residual titles)
  return name
    .replace(
      /\s+(?:unique-collection ladder|currency economy|follow-on chain|densify|residual|ladder|package|infrastructure|permanent|family)$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function interestMeta(value: string): string {
  return clipProse(
    cleanText(value)
      .replace(/\b(?:permanent|infrastructure|package|densify|residual)\b/gi, "")
      .replace(/\bfollow-on chain\b/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
    48,
  );
}

function methodRate(rate: string): string {
  const value = cleanText(rate);
  return !value || /^(?:not (?:normalized|optimizer-grade)|no[_ ]official|not[_ ]an?[_ ])/i.test(value)
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

type PreviewImage = { src: string; name: string } | null;

function ImageViewer({
  image,
  onClose,
}: {
  image: PreviewImage;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pixelated, setPixelated] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (image && dialog && !dialog.open) dialog.showModal();
    if (!image && dialog?.open) dialog.close();
    setPixelated(false);
  }, [image]);

  return (
    <dialog
      ref={dialogRef}
      className="data-image-viewer"
      aria-label={image ? `${image.name} image` : "Image viewer"}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {image ? (
        <>
          <button
            type="button"
            className="data-image-viewer__close"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.name}
            className={pixelated ? "is-pixel" : undefined}
            onLoad={(event) => {
              const img = event.currentTarget;
              const nw = img.naturalWidth;
              const nh = img.naturalHeight;
              // Inventory glyphs are ~20–64px — never fill the viewport; scale up crisply.
              const maxEdge = Math.max(nw, nh);
              const isGlyph = maxEdge > 0 && maxEdge <= 96;
              setPixelated(isGlyph);
              if (isGlyph) {
                const scale = Math.min(8, Math.max(4, Math.floor(480 / maxEdge)));
                img.style.width = `${nw * scale}px`;
                img.style.height = `${nh * scale}px`;
              } else {
                img.style.width = "";
                img.style.height = "";
              }
            }}
          />
          <p>{image.name}</p>
        </>
      ) : null}
    </dialog>
  );
}

function MethodTable({
  methods,
  label,
}: {
  methods: ResearchTrainingMethod[];
  label?: string;
}) {
  if (!methods.length) {
    return <p className="px-3 py-2 text-[13px] text-parch-100">No methods.</p>;
  }

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
            const location = cleanText(method.location) || methodAccess(method);
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
              <td className="data-training-table__location secondary" title={location}>
                {location}
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
  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);
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
            setPreviewImage({
              src: regionCrestPath(region.id),
              name: `${cleanText(region.name)} crest`,
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
          <span className="font-normal text-parch-100">{region.content.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table data-region-content-table w-full min-w-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rewards / access</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {region.content.map((row, index) => {
                const iconSrc = dataEntityIconPath({ name: row.name, kind: row.kind });
                return (
                  <tr key={`${row.name}-${index}`} className="align-top">
                    <td>
                      <div className="data-content-name">
                        {iconSrc ? (
                          <button
                            type="button"
                            className="data-icon-well data-image-button"
                            aria-label={`View ${contentName(row.name)} image`}
                            onClick={() =>
                              setPreviewImage({ src: iconSrc, name: contentName(row.name) })
                            }
                          >
                            <GameIcon src={iconSrc} size={34} />
                          </button>
                        ) : (
                          <span className="data-icon-well data-icon-well--empty" aria-hidden />
                        )}
                        <span className="data-content-name__text">
                          {contentName(row.name)}
                          <InlineSource source={row.source} />
                        </span>
                      </div>
                    </td>
                    <td
                      className="data-content-rewards"
                      title={contentRewards(row, region.upgrades)}
                    >
                      {contentRewards(row, region.upgrades)}
                    </td>
                    <td className="secondary">{row.kind}</td>
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
          <span className="font-normal text-parch-100">{region.upgrades.length} entries</span>
        </div>
        <div className="data-upgrades-list">
          {region.upgrades.length ? (
            region.upgrades.map((upgrade, index) => {
              const iconSrc =
                upgradeIconPath(upgrade.name) ??
                dataEntityIconPath({ name: upgrade.name, kind: upgrade.category });
              const requiredRegions = [...new Set(upgrade.requiredRegions ?? [])];
              return (
                <div
                  key={`upgrade-${index}-${upgrade.name}`}
                  className={`data-upgrade-row ${
                    index % 2 === 1 ? "bg-stone-zebra" : ""
                  }`}
                >
                  {iconSrc ? (
                    <button
                      type="button"
                      className="data-icon-well data-image-button"
                      aria-label={`View ${interestName(upgrade.name)} image`}
                      onClick={() =>
                        setPreviewImage({ src: iconSrc, name: interestName(upgrade.name) })
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
                      {requiredRegions.length > 1 ? (
                        <span
                          className="data-upgrade-row__regions"
                          aria-label={`Region combo: ${requiredRegions.join(" + ")}`}
                        >
                          {requiredRegions.map((regionId) => (
                            <GameIcon
                              key={regionId}
                              src={regionCrestPath(regionId)}
                              size={20}
                            />
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
            <p className="px-3 py-2 text-[13px] text-parch-100">No upgrades.</p>
          )}
        </div>
      </section>
      </div>
      <ImageViewer image={previewImage} onClose={() => setPreviewImage(null)} />
    </article>
  );
}

function SkillDetail({
  skill,
  regionName,
  extra,
}: {
  skill: ResearchSkill;
  regionName: string;
  extra?: ReactNode;
}) {
  return (
    <article className="data-skill-detail">
      {skill.methods.length ? (
        <section className="panel data-region-panel">
          <MethodTable
            methods={skill.methods}
            label={`${skill.name} training in ${cleanText(regionName)}`}
          />
        </section>
      ) : null}
      {extra}
      {!skill.methods.length && !extra ? (
        <p className="data-empty">No methods are mapped to {cleanText(regionName)}.</p>
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
              <GameIcon src={regionCrestPath(region.id)} size={26} />
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

export function ResearchBrowser({
  catalog,
  skillDetails,
}: {
  catalog: ResearchCatalog;
  skillDetails: Partial<Record<string, ReactNode>>;
}) {
  const selectedRegion = useDataRegion() ?? catalog.regions[0];
  const [query, setQuery] = useState("");
  const [skillId, setSkillId] = useState("");
  const [sort, setSort] = useState<"catalog" | "name">("catalog");
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
    return catalog.skills.filter(
      (skill) =>
        names.has(skill.name.toLowerCase()) ||
        names.has(skill.id.toLowerCase()) ||
        skill.id in skillDetails,
    );
  }, [catalog.skills, selectedRegion, skillDetails]);

  const selectedSkill = regionSkills.find((skill) => skill.id === skillId) ?? null;

  const filteredRegion = useMemo(() => {
    if (!selectedRegion) return selectedRegion;
    const matches = (values: unknown[]) =>
      values.filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
    const majorContent = selectedRegion.content.filter(
      (row) =>
        !selectedRegion.content.some(
          (parent) =>
            parent !== row &&
            cleanText(parent.name).toLowerCase() === cleanText(row.kind).toLowerCase() &&
            contentRewards(parent, selectedRegion.upgrades) ===
              contentRewards(row, selectedRegion.upgrades),
        ),
    );
    const content = normalizedQuery
      ? majorContent.filter((row) =>
          matches([row.name, row.kind, row.detail, row.source?.title]),
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

    const byName = (a: string, b: string) => a.localeCompare(b);
    return {
      ...selectedRegion,
      content: sort === "name" ? [...content].sort((a, b) => byName(a.name, b.name)) : content,
      upgrades: sort === "name" ? [...upgrades].sort((a, b) => byName(a.name, b.name)) : upgrades,
      training: sort === "name" ? [...training].sort((a, b) => byName(a.method, b.method)) : training,
    };
  }, [normalizedQuery, selectedRegion, sort]);

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
            className={`data-skill-filter data-skill-filter--all${!selectedSkill ? " is-on" : ""}`}
            onClick={() => setSkillId("")}
          >
            All skills
          </button>
          {regionSkills.map((skill) => {
            const active = selectedSkill?.id === skill.id;
            const iconSrc = skillIconPath(skill.id || skill.name);
            const methodCount = selectedRegion?.training.filter(
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
            aria-label="Search selected region"
            className="field-inset data-browser__search"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "catalog" | "name")}
            aria-label="Sort browse data"
            className="field-inset data-browser__sort"
          >
            <option value="catalog">Catalog order</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      <div className="data-browser__stage">
          {selectedSkillInRegion && selectedRegion ? (
            <SkillDetail
              skill={selectedSkillInRegion}
              regionName={selectedRegion.name}
              extra={skillDetails[selectedSkillInRegion.id]}
            />
          ) : filteredRegion ? (
            <RegionDetail region={filteredRegion} />
          ) : (
            <p className="py-6 text-[13px] text-parch-100">Select a record.</p>
          )}
      </div>
    </section>
  );
}
