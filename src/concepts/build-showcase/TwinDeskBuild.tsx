"use client";

/**
 * R3-B Twin Desk Build — rail regions · stage relic court · inspector effects/share.
 * Hybrid Tasks/Data shell applied to Build (not a war-table clone).
 */

import { useState } from "react";
import { canSelectElective, type RegionId } from "@/league";
import type { BlessingPath } from "@/league/blessings";
import {
  availLabel,
  relicIcon,
  relicMono,
  SHOWCASE_REGIONS,
  SHOWCASE_RELIC_TIERS,
} from "./showcaseData";
import {
  BlessingLattice,
  EffectsList,
  Mast,
} from "./R3Shared";
import { useShowcaseActions } from "./useShowcaseActions";
import "./r3-build.css";

export function TwinDeskBuild() {
  const {
    build,
    loaded,
    toggleRegion,
    toggleRelic,
    pickBlessing,
    clearElectives,
    resetBuild,
    copyShareLink,
    copyLabel,
  } = useShowcaseActions();

  const [focusTier, setFocusTier] = useState(1);
  const picks = build.elective;
  const pickCounter = loaded ? `${picks.length}/3` : "…/3";

  const tier =
    SHOWCASE_RELIC_TIERS.find((t) => t.tier === focusTier) ?? SHOWCASE_RELIC_TIERS[0];
  const seatedName = tier ? (build.relics[String(tier.tier)] ?? null) : null;
  const seated = tier?.choices.find((c) => c.name === seatedName) ?? null;
  const pathSummary = build.blessingPicks.length
    ? build.blessingPicks.join(" → ")
    : "path empty";

  return (
    <div className="r3-build">
      <Mast
        title="Twin Desk"
        pickCounter={pickCounter}
        loaded={loaded}
        picksLen={picks.length}
        onClear={clearElectives}
        onCopy={copyShareLink}
        copyLabel={copyLabel}
        onReset={resetBuild}
      />

      <div className="twin-desk r3-twin">
        <div className="twin-desk__grid">
          <aside className="twin-desk__rail" aria-label="Regions">
            <div className="twin-desk__bar">
              <p className="twin-desk__title">Regions</p>
              <span className="twin-desk__count">{pickCounter}</span>
            </div>
            {SHOWCASE_REGIONS.map((region) => {
              const elective = region.availability === "elective";
              const selectable =
                elective && canSelectElective(build, region.id as RegionId);
              const blocked = elective && (!loaded || !selectable);
              const isOn = !elective || picks.includes(region.id as RegionId);
              return (
                <button
                  key={region.id}
                  type="button"
                  className={`r3-twin__region${isOn ? " is-on" : ""}`}
                  aria-pressed={isOn}
                  aria-disabled={blocked || undefined}
                  disabled={blocked && elective}
                  onClick={() => {
                    if (elective && loaded && selectable) {
                      toggleRegion(region.id as RegionId);
                    }
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/game/regions/${region.id}.png`}
                    alt=""
                    width={22}
                    height={26}
                  />
                  <span className="min-w-0 flex-1 truncate">{region.name}</span>
                  <span className="font-mono text-[0.65rem] text-parch-300">
                    {isOn
                      ? elective
                        ? "on"
                        : availLabel(region.availability)
                      : region.primaryQuests}
                  </span>
                </button>
              );
            })}
          </aside>

          <section className="twin-desk__stage" aria-label="Relic court">
            <div className="twin-desk__bar">
              <p className="twin-desk__title">Relic court</p>
              <div className="flex flex-wrap gap-1">
                {SHOWCASE_RELIC_TIERS.map((t) => {
                  const open = t.revealed && t.choices.length > 0;
                  return (
                    <button
                      key={t.tier}
                      type="button"
                      className={`r3-tier${focusTier === t.tier ? " is-on" : ""}${
                        open ? "" : " is-sealed"
                      }`}
                      aria-pressed={focusTier === t.tier}
                      onClick={() => setFocusTier(t.tier)}
                    >
                      T{t.tier}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="r3-twin__hex-row" role="listbox" aria-label="Relic choices">
              {(tier?.revealed ? tier.choices : []).map((relic) => {
                const on = seatedName === relic.name;
                const icon = relicIcon(relic.name);
                const mono = relicMono(relic.name);
                return (
                  <button
                    key={relic.name}
                    type="button"
                    className={`r3-twin__hex${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggleRelic(tier!.tier, relic.name)}
                  >
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={icon} alt="" />
                    ) : (
                      <span className="r3-twin__mono">{mono}</span>
                    )}
                    <span>{relic.name}</span>
                  </button>
                );
              })}
              {!tier?.revealed || tier.choices.length === 0 ? (
                <p className="r3-muted p-2">Sealed until reveal.</p>
              ) : null}
            </div>
            <div className="border-t border-stone-750 px-2 py-2">
              <p className="r3-label">Blessings</p>
              <BlessingLattice
                build={build}
                compact
                onPick={(n, path: BlessingPath) => pickBlessing(n, path)}
              />
            </div>
          </section>

          <aside className="twin-desk__inspector" aria-label="Plan detail">
            <p className="r3-label">Seated</p>
            <EffectsList name={seatedName} effects={seated?.effects ?? []} />
            <p className="r3-label mt-3">Path</p>
            <p className="m-0 font-mono text-sm text-parch-50">{pathSummary}</p>
            <p className="r3-muted mt-3">
              Rail · stage · inspector — same twin-desk bones as Tasks/Data.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
