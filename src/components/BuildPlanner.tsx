"use client";

import { useMemo, useState } from "react";
import { blessingResetsLeft, type RegionId } from "@/league";
import {
  BLESSING_PATHS,
  godTierAlignments,
  PATH_TIERS,
  type BlessingPath,
} from "@/league/blessings";
import { buildShareUrl } from "@/league/share";
import { useBuild } from "@/league/useBuild";

export type PlannerRegion = {
  id: string;
  name: string;
  availability: string;
  skills: string[];
  trainingCount: number;
  upgradeCount: number;
  hardRules: string[];
};

export type RelicChoice = {
  name: string;
  effects: string[];
  sourceUrl?: string;
  verified?: boolean;
};

export type RelicTier = {
  tier: number;
  revealed: boolean;
  choices: RelicChoice[];
};

export type BlessingTier = {
  tier: number;
  revealed: boolean;
  paths: string[];
  godTier: boolean;
  choices: unknown[];
  sourceUrl?: string;
  verified?: boolean;
};

function availabilityLabel(value: string): string {
  if (value === "automatic_early") return "early unlock";
  return value.replaceAll("_", " ");
}

/** Blessing choice payloads ship empty until the reveals; render them once they exist. */
function asBlessingChoices(value: unknown[]): { name: string; effects: string[] }[] {
  return value.filter(
    (c): c is { name: string; effects: string[] } =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as { name?: unknown }).name === "string" &&
      Array.isArray((c as { effects?: unknown }).effects),
  );
}

export function BuildPlanner({
  regions,
  relicTiers,
  blessingTiers,
  resetCount,
}: {
  regions: PlannerRegion[];
  relicTiers: RelicTier[];
  blessingTiers: BlessingTier[];
  resetCount: number;
}) {
  const electiveRegions = regions.filter((region) => region.availability === "elective");
  const fixedRegions = regions.filter((region) => region.availability !== "elective");
  // All picks live in the shared unlock store — same state the map edits.
  const { build, toggleRegion, toggleRelic, pickBlessing, resetBlessings } = useBuild();
  const selectedRegions: string[] = build.elective;

  const selectedRegionRows = useMemo(
    () => electiveRegions.filter((region) => selectedRegions.includes(region.id)),
    [electiveRegions, selectedRegions],
  );

  const alignments = godTierAlignments(build.blessingPicks);
  const resetsLeft = blessingResetsLeft(build);

  const [copied, setCopied] = useState(false);
  const copyShareLink = () => {
    void navigator.clipboard?.writeText(buildShareUrl(build));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <section className="border-b border-stone-750 py-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Regions</h2>
            <p className="mt-1 text-xs text-parch-300">Misthalin and Havenhythe start open. Karamja follows early. Pick up to three elective regions.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-parch-300">
            <span>{selectedRegions.length}/3 elective picks</span>
            <button
              type="button"
              onClick={copyShareLink}
              className="border border-stone-750 px-3 py-1.5 text-parch-50 hover:bg-white/[0.02]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="grid border-t border-stone-750 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="border-b border-stone-750 lg:border-b-0 lg:border-r">
            <div className="px-3 py-2 text-xs text-parch-300">Always available</div>
            {fixedRegions.map((region) => (
              <div key={region.id} className="border-t border-stone-750/70 px-3 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-parch-50">{region.name}</span>
                  <span className="text-[11px] text-parch-300">{availabilityLabel(region.availability)}</span>
                </div>
                <div className="mt-1 text-xs text-parch-300">{region.trainingCount} methods · {region.upgradeCount} upgrades</div>
              </div>
            ))}
          </div>

          <div>
            <div className="grid text-xs text-parch-300 sm:grid-cols-2 xl:grid-cols-4">
              {electiveRegions.map((region) => {
                const selected = selectedRegions.includes(region.id);
                const disabled = !selected && selectedRegions.length >= 3;
                return (
                  <button
                    key={region.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleRegion(region.id as RegionId)}
                    className={`border-b border-stone-750/70 px-3 py-3 text-left sm:border-r ${
                      selected ? "bg-stone-850 text-parch-50" : "text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
                    } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <span className="block text-sm font-medium text-parch-50">{region.name}</span>
                    <span className="mt-1 block">{region.trainingCount} methods · {region.upgradeCount} upgrades</span>
                    <span className="mt-1 block truncate">{region.skills.slice(0, 5).join(" · ") || "No skill tags yet"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedRegionRows.length ? (
          <div className="border-t border-stone-750 py-3">
            <div className="text-xs font-medium text-parch-50">Selected</div>
            <div className="mt-1 text-sm text-parch-300">{selectedRegionRows.map((region) => region.name).join(" · ")}</div>
            {selectedRegionRows.flatMap((region) => region.hardRules).map((rule) => (
              <p key={rule} className="mt-1 text-xs leading-5 text-parch-300">{rule}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="border-b border-stone-750 py-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Relics</h2>
            <p className="mt-1 text-xs text-parch-300">Tier 1 is public. Later tiers stay hidden until the reveals land — nothing here is guessed.</p>
          </div>
          <div className="text-xs text-parch-300">{Object.keys(build.relics).length}/{relicTiers.length} picked</div>
        </div>
        <div className="border-t border-stone-750">
          {relicTiers.map((tier) => {
            if (!tier.revealed || tier.choices.length === 0) {
              return (
                <div key={tier.tier} className="flex items-baseline justify-between gap-3 border-b border-stone-750/70 px-3 py-2.5">
                  <span className="text-sm text-parch-300">Tier {tier.tier}</span>
                  <span className="text-xs text-parch-300">not revealed yet</span>
                </div>
              );
            }
            return (
              <div key={tier.tier} className="border-b border-stone-750/70">
                <div className="px-3 pt-3 text-xs text-parch-300">Tier {tier.tier}</div>
                {tier.choices.map((relic) => {
                  const selected = build.relics[String(tier.tier)] === relic.name;
                  return (
                    <button
                      key={relic.name}
                      type="button"
                      onClick={() => toggleRelic(tier.tier, relic.name)}
                      className={`grid w-full gap-2 border-b border-stone-750/50 px-3 py-3 text-left last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)] ${selected ? "bg-stone-850" : "hover:bg-white/[0.02]"}`}
                    >
                      <span className="text-sm font-medium text-parch-50">
                        {relic.name}
                        {relic.sourceUrl ? (
                          <a
                            href={relic.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="ml-2 text-[11px] font-normal text-parch-300 underline underline-offset-2"
                          >
                            Source
                          </a>
                        ) : null}
                      </span>
                      <span className="text-xs leading-5 text-parch-300">{relic.effects.join(" ")}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Blessings</h2>
            <p className="mt-1 text-xs text-parch-300">Order, Balance and Chaos across eight tiers. Effects aren&apos;t public — picks plan the path, and the god tiers follow from it.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-parch-300">
            <span>{resetsLeft} of {resetCount} resets left</span>
            <button
              type="button"
              onClick={resetBlessings}
              disabled={resetsLeft === 0 || build.blessingPicks.length === 0}
              className="border border-stone-750 px-3 py-1.5 text-parch-50 hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset blessings
            </button>
          </div>
        </div>
        <div className="border-t border-stone-750">
          {blessingTiers.map((tier) => {
            if (tier.godTier) {
              const god = alignments[tier.tier];
              return (
                <div key={tier.tier} className="flex items-baseline justify-between gap-3 border-b border-stone-750/70 px-3 py-2.5">
                  <span className="text-sm text-parch-50">Tier {tier.tier}</span>
                  <span className={`text-xs ${god ? "text-parch-50" : "text-parch-300"}`}>
                    {god ? `${god} god` : "god undecided"}
                  </span>
                </div>
              );
            }
            const pickIndex = PATH_TIERS.indexOf(tier.tier);
            const locked = pickIndex > build.blessingPicks.length;
            const choices = asBlessingChoices(tier.choices);
            return (
              <div key={tier.tier} className="border-b border-stone-750/70 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-parch-50">Tier {tier.tier}</span>
                  <div className="flex gap-1">
                    {tier.paths.map((path) => {
                      if (!(BLESSING_PATHS as readonly string[]).includes(path)) return null;
                      const selected = build.blessingPicks[pickIndex] === path;
                      return (
                        <button
                          key={path}
                          type="button"
                          disabled={locked}
                          onClick={() => pickBlessing(tier.tier, path as BlessingPath)}
                          className={`border border-stone-750 px-3 py-1.5 text-xs ${
                            selected ? "bg-stone-850 text-parch-50" : "text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
                          } ${locked ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          {path}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {tier.revealed && choices.length > 0 ? (
                  <div className="mt-2 grid gap-2">
                    {choices.map((choice) => (
                      <div key={choice.name} className="text-xs leading-5 text-parch-300">
                        <span className="text-parch-50">{choice.name}</span> — {choice.effects.join(" ")}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
