"use client";

/**
 * Strip Billboard — Social Strip
 * Sticky top billboard: crests · T1 mono · path chips · Copy link · Clear · 0/3
 * Below: compact operable region lattice + relic row. Share bar never scrolls away.
 */

import { canSelectElective, type RegionId, unlockedRegions } from "@/league";
import { BLESSING_PATHS, PATH_TIERS, type BlessingPath } from "@/league/blessings";
import {
  availLabel,
  relicMono,
  SHOWCASE_REGIONS,
  SHOWCASE_RELIC_TIERS,
} from "./showcaseData";
import { useShowcaseActions } from "./useShowcaseActions";

function pathClass(path: string): string {
  return `is-${path.toLowerCase()}`;
}

export function StripBillboard() {
  const {
    build,
    loaded,
    toggleRegion,
    toggleRelic,
    pickBlessing,
    clearElectives,
    copyShareLink,
    copyLabel,
  } = useShowcaseActions();

  const picks = build.elective;
  const pickCounter = loaded ? `${picks.length}/3` : "…/3";
  const unlocked = unlockedRegions(build);

  const t1 = SHOWCASE_RELIC_TIERS.find((t) => t.tier === 1);
  const seatedName = t1 ? build.relics[String(t1.tier)] ?? null : null;
  const mono = seatedName ? relicMono(seatedName) : "—";

  const nextPathIndex = build.blessingPicks.length;
  const nextPathTier =
    nextPathIndex < PATH_TIERS.length ? PATH_TIERS[nextPathIndex] : null;

  return (
    <div className="bs-billboard">
      <div className="bs-billboard__strip" role="region" aria-label="Live plan summary">
        <div className="bs-billboard__crests" aria-label="Unlocked region crests">
          {unlocked.length === 0 ? (
            <span className="bs-billboard__empty">no crests</span>
          ) : (
            unlocked.map((id) => {
              const region = SHOWCASE_REGIONS.find((r) => r.id === id);
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  src={`/game/regions/${id}.png`}
                  alt=""
                  width={22}
                  height={26}
                  title={region?.name ?? id}
                />
              );
            })
          )}
        </div>

        <span className="bs-billboard__sep" aria-hidden>
          ·
        </span>

        <span
          className={`bs-mono${seatedName ? " is-seated" : " is-empty"}`}
          title={seatedName ?? "No T1 relic"}
          aria-label="T1 monogram"
        >
          {mono}
        </span>

        <span className="bs-billboard__sep" aria-hidden>
          ·
        </span>

        <div className="bs-billboard__paths" aria-label="Blessing path chips">
          {build.blessingPicks.length === 0 ? (
            <span className="bs-billboard__empty">no path</span>
          ) : (
            build.blessingPicks.map((p, i) => (
              <span key={`${p}-${i}`} className={`bs-path-chip ${pathClass(p)}`}>
                {p}
              </span>
            ))
          )}
        </div>

        <div className="bs-billboard__actions">
          <button type="button" onClick={copyShareLink} disabled={!loaded} className="bs-share">
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={clearElectives}
            disabled={!loaded || picks.length === 0}
            className="bs-clear"
          >
            Clear picks
          </button>
          <span className="bs-pick-count" aria-live="polite">
            {pickCounter}
          </span>
        </div>
      </div>

      <div className="bs-billboard__body">
        <p className="bs-note">
          Social strip · share bar sticky · dense lattice + relic row (no giant voids)
        </p>

        <section className="bs-tools" aria-label="Region lattice">
          <div className="bs-tools__head">Regions · compact lattice</div>
          <div className={`bs-tools__body${loaded ? "" : " pointer-events-none opacity-60"}`}>
            <div className="bs-region-grid">
              {SHOWCASE_REGIONS.map((region) => {
                const elective = region.availability === "elective";
                const selectable =
                  elective && canSelectElective(build, region.id as RegionId);
                const pickBlocked = elective && (!loaded || !selectable);
                const isOn = !elective || picks.includes(region.id as RegionId);
                return (
                  <button
                    key={region.id}
                    type="button"
                    aria-pressed={isOn}
                    aria-disabled={pickBlocked || undefined}
                    disabled={pickBlocked}
                    onClick={() => {
                      if (elective && loaded && selectable) {
                        toggleRegion(region.id as RegionId);
                      }
                    }}
                    className={`bs-region-tile${isOn ? " is-on" : ""}${
                      pickBlocked ? " is-blocked" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/game/regions/${region.id}.png`}
                      alt=""
                      width={20}
                      height={24}
                    />
                    <span className="bs-region-tile__name">{region.name}</span>
                    <span className="bs-region-tile__meta">
                      {isOn
                        ? elective
                          ? "picked"
                          : availLabel(region.availability)
                        : availLabel(region.availability)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bs-tools" aria-label="Relic row">
          <div className="bs-tools__head">Relics · T1 row</div>
          <div className="bs-tools__body">
            {t1 && t1.revealed && t1.choices.length > 0 ? (
              <div className="bs-relic-row">
                {t1.choices.map((relic) => {
                  const selected = seatedName === relic.name;
                  return (
                    <button
                      key={relic.name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleRelic(t1.tier, relic.name)}
                      className={`bs-relic-btn${selected ? " is-selected" : ""}`}
                    >
                      <span className={`bs-mono${selected ? " is-seated" : ""}`} aria-hidden>
                        {relicMono(relic.name)}
                      </span>
                      <span className="bs-relic-btn__name">{relic.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="bs-note">No revealed T1 yet.</p>
            )}

            {nextPathTier != null ? (
              <>
                <p className="bs-note" style={{ marginTop: "0.55rem" }}>
                  Next path · tier {nextPathTier}
                </p>
                <div className="bs-path-pick">
                  {BLESSING_PATHS.map((path) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => pickBlessing(nextPathTier, path as BlessingPath)}
                      className={pathClass(path)}
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="bs-note" style={{ marginTop: "0.55rem" }}>
                Path complete · {PATH_TIERS.length} picks seated
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
