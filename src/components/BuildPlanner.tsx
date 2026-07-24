"use client";

import { useMemo, useState } from "react";
import type { RegionId } from "@/league";
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
  verified: boolean;
  sourceUrl?: string;
  choices: RelicChoice[];
};

export type BlessingTier = {
  tier: number;
  revealed: boolean;
  paths: string[];
  godTier: boolean;
  verified: boolean;
  sourceUrl?: string;
  choices: unknown[];
};

function availabilityLabel(value: string): string {
  if (value === "automatic_early") return "early unlock";
  return value.replaceAll("_", " ");
}

export function BuildPlanner({
  regions,
  relicTiers,
  tierOneRelics,
  blessingTiers,
  resetCount,
}: {
  regions: PlannerRegion[];
  relicTiers?: RelicTier[];
  /** Temporary compatibility for callers that still provide only Tier 1. */
  tierOneRelics?: RelicChoice[];
  blessingTiers: BlessingTier[];
  resetCount: number;
}) {
  const electiveRegions = regions.filter((region) => region.availability === "elective");
  const fixedRegions = regions.filter((region) => region.availability !== "elective");
  // Region picks live in the shared unlock store — same state the map edits.
  const { build, toggleRegion } = useBuild();
  const selectedRegions: string[] = build.elective;
  const [selectedRelic, setSelectedRelic] = useState<string>("");

  const effectiveRelicTiers = useMemo<RelicTier[]>(() => {
    if (relicTiers?.length) return relicTiers;
    return [
      {
        tier: 1,
        revealed: Boolean(tierOneRelics?.length),
        verified: false,
        choices: tierOneRelics ?? [],
      },
    ];
  }, [relicTiers, tierOneRelics]);

  const selectedRegionRows = useMemo(
    () => electiveRegions.filter((region) => selectedRegions.includes(region.id)),
    [electiveRegions, selectedRegions],
  );

  return (
    <div>
      <section className="border-b border-stone-750 py-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Regions</h2>
            <p className="mt-1 text-xs text-parch-300">Misthalin and Havenhythe start open. Karamja follows early. Pick up to three elective regions.</p>
          </div>
          <div className="text-xs text-parch-300">{selectedRegions.length}/3 elective picks</div>
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
            <p className="mt-1 text-xs text-parch-300">Revealed tiers come from the League data store. Unrevealed tiers stay unknown.</p>
          </div>
          <div className="text-xs text-parch-300">{selectedRelic || "no relic selected"}</div>
        </div>

        <div className="border-t border-stone-750">
          {effectiveRelicTiers.map((tier) => (
            <div key={tier.tier} className="border-b border-stone-750/70">
              <div className="flex flex-wrap items-baseline justify-between gap-3 px-3 py-2">
                <div className="text-sm font-medium text-parch-50">Tier {tier.tier}</div>
                <div className="flex items-center gap-3 text-[11px] text-parch-300">
                  <span>{tier.revealed ? "revealed" : "not revealed"}</span>
                  {tier.sourceUrl ? (
                    <a href={tier.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300">
                      source
                    </a>
                  ) : null}
                </div>
              </div>

              {tier.revealed && tier.choices.length ? (
                <div className="border-t border-stone-750/70">
                  {tier.choices.map((relic) => {
                    const selectionKey = `${tier.tier}:${relic.name}`;
                    const selected = selectedRelic === selectionKey;
                    return (
                      <button
                        key={selectionKey}
                        type="button"
                        onClick={() => setSelectedRelic((current) => current === selectionKey ? "" : selectionKey)}
                        className={`grid w-full gap-2 border-b border-stone-750/70 px-3 py-3 text-left last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)] ${selected ? "bg-stone-850" : "hover:bg-white/[0.02]"}`}
                      >
                        <span className="text-sm font-medium text-parch-50">{relic.name}</span>
                        <span className="text-xs leading-5 text-parch-300">{relic.effects.join(" ")}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="border-t border-stone-750/70 px-3 py-3 text-xs text-parch-300">No public choices yet.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="py-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Blessings</h2>
            <p className="mt-1 text-xs text-parch-300">Order, Balance and Chaos. Unrevealed node payloads stay unknown.</p>
          </div>
          <div className="text-xs text-parch-300">{resetCount} resets total · god tiers 4 and 8</div>
        </div>
        <div className="overflow-x-auto border-t border-stone-750">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="text-xs text-parch-300">
              <tr className="border-b border-stone-750">
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Paths</th>
                <th className="py-2 pr-4 font-medium">God tier</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {blessingTiers.map((tier) => (
                <tr key={tier.tier} className="border-b border-stone-750/70">
                  <td className="py-2.5 pr-4 text-parch-50">{tier.tier}</td>
                  <td className="py-2.5 pr-4 text-xs text-parch-300">{tier.paths.join(" · ")}</td>
                  <td className="py-2.5 pr-4 text-xs text-parch-300">{tier.godTier ? "yes" : "—"}</td>
                  <td className="py-2.5 pr-4 text-xs text-parch-300">
                    {tier.revealed ? `revealed${tier.choices.length ? ` · ${tier.choices.length} nodes` : ""}` : "not revealed"}
                  </td>
                  <td className="py-2.5 text-xs text-parch-300">
                    {tier.sourceUrl ? (
                      <a href={tier.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300">
                        source
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
