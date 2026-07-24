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
};

export type BlessingTier = {
  tier: number;
  revealed: boolean;
  paths: string[];
  godTier: boolean;
};

function availabilityLabel(value: string): string {
  if (value === "automatic_early") return "early unlock";
  return value.replaceAll("_", " ");
}

export function BuildPlanner({
  regions,
  tierOneRelics,
  blessingTiers,
  resetCount,
}: {
  regions: PlannerRegion[];
  tierOneRelics: RelicChoice[];
  blessingTiers: BlessingTier[];
  resetCount: number;
}) {
  const electiveRegions = regions.filter((region) => region.availability === "elective");
  const fixedRegions = regions.filter((region) => region.availability !== "elective");
  // Region picks live in the shared unlock store — same state the map edits.
  const { build, toggleRegion } = useBuild();
  const selectedRegions: string[] = build.elective;
  const [selectedRelic, setSelectedRelic] = useState<string>("");

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
            <h2 className="text-sm font-medium text-parch-50">Relic tier 1</h2>
            <p className="mt-1 text-xs text-parch-300">Only Tier 1 is public in this snapshot. Later tiers stay hidden instead of being guessed.</p>
          </div>
          <div className="text-xs text-parch-300">{selectedRelic || "no relic selected"}</div>
        </div>
        <div className="border-t border-stone-750">
          {tierOneRelics.map((relic) => {
            const selected = selectedRelic === relic.name;
            return (
              <button
                key={relic.name}
                type="button"
                onClick={() => setSelectedRelic((current) => current === relic.name ? "" : relic.name)}
                className={`grid w-full gap-2 border-b border-stone-750/70 px-3 py-3 text-left md:grid-cols-[180px_minmax(0,1fr)] ${selected ? "bg-stone-850" : "hover:bg-white/[0.02]"}`}
              >
                <span className="text-sm font-medium text-parch-50">{relic.name}</span>
                <span className="text-xs leading-5 text-parch-300">{relic.effects.join(" ")}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="py-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Blessings</h2>
            <p className="mt-1 text-xs text-parch-300">Order, Balance and Chaos. Exact nodes are not public yet.</p>
          </div>
          <div className="text-xs text-parch-300">{resetCount} resets total · god tiers 4 and 8</div>
        </div>
        <div className="overflow-x-auto border-t border-stone-750">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="text-xs text-parch-300">
              <tr className="border-b border-stone-750">
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Paths</th>
                <th className="py-2 pr-4 font-medium">God tier</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {blessingTiers.map((tier) => (
                <tr key={tier.tier} className="border-b border-stone-750/70">
                  <td className="py-2.5 pr-4 text-parch-50">{tier.tier}</td>
                  <td className="py-2.5 pr-4 text-xs text-parch-300">{tier.paths.join(" · ")}</td>
                  <td className="py-2.5 pr-4 text-xs text-parch-300">{tier.godTier ? "yes" : "—"}</td>
                  <td className="py-2.5 text-xs text-parch-300">{tier.revealed ? "revealed" : "not revealed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
