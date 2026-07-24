"use client";

import { useState } from "react";
import type { RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { Hex, HexRow, hexClass } from "@/components/Hex";

export type PlannerRegion = {
  id: string;
  name: string;
  availability: string;
  skills: string[];
  trainingCount: number;
  upgradeCount: number;
  hardRules: string[];
  primaryQuests: number;
  touchedQuests: number;
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

const PATH_INK: Record<string, string> = {
  Chaos: "text-chaos-300",
  Balance: "text-balance-400",
  Order: "text-order-400",
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
  // Region picks live in the shared unlock store — same state the map edits.
  const { build, toggleRegion } = useBuild();
  const picks = build.elective;
  const [focusId, setFocusId] = useState<string>(regions[0]?.id ?? "");
  const [selectedRelic, setSelectedRelic] = useState<string>("");

  const picked = (id: string) => (picks as string[]).includes(id);
  const isOpen = (r: PlannerRegion) => r.availability !== "elective" || picked(r.id);
  const focus = regions.find((r) => r.id === focusId) ?? regions[0];
  const openCount = regions.filter(isOpen).length;
  const paths = blessingTiers[0]?.paths ?? ["Order", "Balance", "Chaos"];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-display text-sm uppercase tracking-[0.18em] text-brass-300">
              Regions
            </h2>
            <span className="num text-xs text-parch-400">
              {openCount} of {regions.length} open · {picks.length}/3 picks
            </span>
            <span className="h-px flex-1 bg-stone-750" />
            <button
              type="button"
              onClick={() => picks.forEach((id) => toggleRegion(id as RegionId))}
              className="rounded-sm border border-stone-750 px-2.5 py-1 text-xs text-parch-100 hover:border-stone-carve hover:text-parch-50"
            >
              Clear picks
            </button>
          </div>

          <div className="flex flex-col">
            {[regions.slice(0, 6), regions.slice(6)].map((row, rowIndex) => (
              <HexRow key={rowIndex} offset={rowIndex === 1} className={rowIndex ? "-mt-[42px]" : ""}>
                {row.map((region) => {
                  const open = isOpen(region);
                  const elective = region.availability === "elective";
                  const barred = !open && picks.length >= 3;
                  const selected = focusId === region.id;
                  return (
                    <button
                      key={region.id}
                      type="button"
                      disabled={barred}
                      aria-pressed={picked(region.id)}
                      onClick={() => {
                        if (elective) toggleRegion(region.id as RegionId);
                        setFocusId(region.id);
                      }}
                      // Content sits above the bottom slope, which the next row overlaps.
                      className={hexClass(
                        "lg",
                        barred ? "locked" : selected ? "selected" : "open",
                        "gap-1 pb-2.5",
                      )}
                    >
                      {barred ? (
                        <span className="h-[17px] w-[15px] bg-gem-600 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />
                      ) : (
                        <img
                          src={`/game/regions/${region.id}.png`}
                          alt=""
                          width={42}
                          height={48}
                          className="h-12 w-auto object-contain"
                        />
                      )}
                      <span className="flex min-h-[31px] items-end px-2 text-[12.5px] leading-tight text-parch-100">
                        {region.name}
                      </span>
                      <span
                        className={`num text-[19px] ${barred ? "text-parch-500" : "text-gem-400"}`}
                      >
                        {region.primaryQuests}
                      </span>
                    </button>
                  );
                })}
              </HexRow>
            ))}
          </div>
        </section>

        <section className="border-t border-stone-750 pt-4">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-display text-sm uppercase tracking-[0.18em] text-brass-300">
              Relics
            </h2>
            <span className="num text-xs text-parch-400">1 of 7 tiers revealed</span>
            <span className="h-px flex-1 bg-stone-750" />
            <span className="text-xs text-parch-400">{selectedRelic || "none picked"}</span>
          </div>

          <div className="flex items-start gap-1 overflow-x-auto pb-1 pt-5">
            <div className="relative mr-3.5 flex gap-1 border-r border-stone-750 pr-5">
              <span className="absolute -top-5 left-0 whitespace-nowrap text-[11px] uppercase tracking-[0.09em] text-gem-400">
                Tier 1 · pick one
              </span>
              {tierOneRelics.map((relic) => (
                <button
                  key={relic.name}
                  type="button"
                  title={relic.effects[0]}
                  onClick={() =>
                    setSelectedRelic((cur) => (cur === relic.name ? "" : relic.name))
                  }
                  className={hexClass("md", selectedRelic === relic.name ? "selected" : "open")}
                >
                  <span className="px-2 text-[12px] leading-tight text-parch-100">
                    {relic.name}
                  </span>
                </button>
              ))}
            </div>
            {[2, 3, 4, 5, 6, 7].map((tier) => (
              <Hex key={tier} size="md" state="unrevealed">
                <span className="num text-[11px] text-parch-500">T{tier}</span>
              </Hex>
            ))}
          </div>
        </section>

        <section className="border-t border-stone-750 pt-4">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-display text-sm uppercase tracking-[0.18em] text-brass-300">
              Blessings
            </h2>
            <span className="text-xs text-parch-400">
              god tier at 4 and 8 · {resetCount} resets
            </span>
            <span className="h-px flex-1 bg-stone-750" />
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex gap-1 pl-[62px]">
              {blessingTiers.map((tier) => (
                <span
                  key={tier.tier}
                  className="num w-[52px] text-center text-[10.5px] text-parch-500"
                >
                  {tier.tier}
                </span>
              ))}
            </div>
            <div className="flex flex-col">
              {paths.map((path, pathIndex) => (
                <div
                  key={path}
                  className={`flex items-center gap-1 ${pathIndex ? "-mt-[13px]" : ""}`}
                >
                  <span
                    className={`w-[58px] shrink-0 text-[11px] uppercase tracking-[0.1em] ${
                      PATH_INK[path] ?? "text-parch-300"
                    }`}
                  >
                    {path}
                  </span>
                  {blessingTiers.map((tier) => (
                    <Hex key={tier.tier} size="sm" state="unrevealed">
                      {tier.godTier ? (
                        <span className="absolute left-1/2 top-1.5 h-[9px] w-[8px] -translate-x-1/2 bg-brass-400 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />
                      ) : null}
                    </Hex>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-parch-400">
              No blessing is revealed yet. The lattice is the shape of the choice, not a guess at its
              contents.
            </p>
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-4 border-t border-stone-750 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        {focus ? (
          <>
            <img
              src={`/game/regions/${focus.id}.png`}
              alt=""
              width={52}
              height={60}
              className="h-[60px] w-auto object-contain"
            />
            <h3 className="font-display text-xl uppercase tracking-[0.1em] text-parch-50">
              {focus.name}
            </h3>
            <div>
              <div className="text-[11px] uppercase tracking-[0.13em] text-parch-500">
                Quests starting here
              </div>
              <div className="stat-key mt-1">{focus.primaryQuests}</div>
            </div>
            <dl className="flex flex-col border-t border-stone-750">
              <div className="flex items-baseline justify-between gap-3 border-b border-stone-800 py-1.5">
                <dt className="text-[12.5px] text-parch-300">Quests touching</dt>
                <dd className="num text-[15px] text-parch-50">{focus.touchedQuests}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-stone-800 py-1.5">
                <dt className="text-[12.5px] text-parch-300">Training methods</dt>
                <dd className="num text-[15px] text-parch-50">{focus.trainingCount}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-stone-800 py-1.5">
                <dt className="text-[12.5px] text-parch-300">Upgrades</dt>
                <dd className="num text-[15px] text-parch-50">{focus.upgradeCount}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-stone-800 py-1.5">
                <dt className="text-[12.5px] text-parch-300">Access</dt>
                <dd className="text-[12.5px] text-parch-50">
                  {availabilityLabel(focus.availability)}
                </dd>
              </div>
            </dl>
            {focus.skills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {focus.skills.slice(0, 8).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-sm border border-stone-750 bg-stone-850 px-1.5 py-0.5 text-[11.5px] text-parch-100"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
            {focus.hardRules.map((rule) => (
              <p key={rule} className="text-[13px] leading-relaxed text-parch-100">
                {rule}
              </p>
            ))}
          </>
        ) : null}
      </aside>
    </div>
  );
}
