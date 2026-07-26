"use client";

/**
 * War Roster — horizontal sports-card lineup (Lineup Strip).
 * 11 crest slots · captain T1 monogram · path strip · share right.
 * Live useBuild via useShowcaseActions; monograms SV/EH/GT only.
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

export function WarRoster() {
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
  const unlocked = new Set(unlockedRegions(build));

  const t1 = SHOWCASE_RELIC_TIERS.find((t) => t.tier === 1);
  const seatedName = t1 ? build.relics[String(t1.tier)] ?? null : null;
  const mono = seatedName ? relicMono(seatedName) : "·";

  const pathRibbon: (string | null)[] = Array.from(
    { length: PATH_TIERS.length },
    (_, i) => build.blessingPicks[i] ?? null,
  );
  const nextPathIndex = build.blessingPicks.length;
  const nextPathTier =
    nextPathIndex < PATH_TIERS.length ? PATH_TIERS[nextPathIndex] : null;

  return (
    <div className="bs-roster">
      <section className="bs-roster__strip" aria-label="War roster strip">
        <div className="bs-roster__brand">
          <div className="bs-roster__seal">
            <span className="bs-roster__brand-mark">EQUILIBRIUM</span>
            <span className="bs-roster__brand-sub">Leagues II · roster</span>
          </div>
          <div className="bs-roster__pick-bar">
            <span className="bs-roster__count" aria-live="polite">
              {pickCounter}
            </span>
            <button
              type="button"
              onClick={clearElectives}
              disabled={!loaded || picks.length === 0}
              className="bs-roster__clear"
            >
              Clear picks
            </button>
          </div>
        </div>

        <div className="bs-roster__lineup" aria-label="Region roster slots">
          {SHOWCASE_REGIONS.map((region) => {
            const elective = region.availability === "elective";
            const selectable =
              elective && canSelectElective(build, region.id as RegionId);
            const pickBlocked = elective && (!loaded || !selectable);
            const isOn = !elective || picks.includes(region.id as RegionId);
            const isStart =
              region.availability === "starting" ||
              region.availability === "automatic_early";
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
                className={`bs-roster__slot${
                  isOn || unlocked.has(region.id as RegionId) ? " is-on" : ""
                }${isStart ? " is-start" : ""}${pickBlocked ? " is-blocked" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/game/regions/${region.id}.png`}
                  alt=""
                  width={24}
                  height={28}
                />
                <span className="bs-roster__slot-name">{region.name}</span>
                <span className="bs-roster__slot-tag">
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

        <div className="bs-roster__captain" aria-label="Captain relic seat">
          <span className="bs-roster__captain-label">Captain · T1</span>
          <span
            className={`bs-roster__mono${seatedName ? " is-seated" : " is-empty"}`}
            aria-hidden
          >
            {mono}
          </span>
          <p
            className={`bs-roster__captain-name${seatedName ? " is-gold" : ""}`}
          >
            {seatedName ?? "Open seat"}
          </p>
        </div>

        <div className="bs-roster__actions">
          <button
            type="button"
            onClick={copyShareLink}
            disabled={!loaded}
            className="bs-roster__share"
          >
            {copyLabel === "Copy link" ? "Copy share link" : copyLabel}
          </button>
          <p className="bs-roster__action-meta">
            {seatedName ? seatedName : "no relic"}
            {build.blessingPicks.length
              ? ` · ${build.blessingPicks.join("→")}`
              : ""}
          </p>
        </div>

        <div className="bs-roster__path-row">
          <span className="bs-roster__path-label">Path</span>
          <div className="bs-roster__ribbon" aria-label="Blessing path strip">
            {pathRibbon.map((path, i) =>
              path ? (
                <span key={i} className={`bs-roster__path-chip ${pathClass(path)}`}>
                  {path}
                </span>
              ) : (
                <span key={i} className="bs-roster__path-chip is-empty">
                  ·
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="bs-roster__tools" aria-label="Roster planner tools">
        <div className="bs-roster__tools-head">Tools · denser court</div>
        <div
          className={`bs-roster__tools-body${loaded ? "" : " is-loading"}`}
        >
          <div>
            <p className="bs-roster__tool-title">T1 Relic Court</p>
            {t1 && t1.revealed && t1.choices.length > 0 ? (
              <div className="bs-roster__relic-row">
                {t1.choices.map((relic) => {
                  const selected = seatedName === relic.name;
                  return (
                    <button
                      key={relic.name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleRelic(t1.tier, relic.name)}
                      className={`bs-roster__relic${selected ? " is-selected" : ""}`}
                    >
                      <span
                        className={`bs-roster__mono bs-roster__mono--sm${
                          selected ? " is-seated" : ""
                        }`}
                        aria-hidden
                      >
                        {relicMono(relic.name)}
                      </span>
                      <span className="bs-roster__relic-label">{relic.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="bs-roster__note">No revealed T1 yet.</p>
            )}
          </div>

          <div>
            <p className="bs-roster__tool-title">Blessing path</p>
            {nextPathTier != null ? (
              <>
                <p className="bs-roster__note">Next · tier {nextPathTier}</p>
                <div className="bs-roster__path-pick">
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
              <p className="bs-roster__note">
                Path complete · {PATH_TIERS.length} picks seated
              </p>
            )}
            {build.blessingPicks.length > 0 ? (
              <p className="bs-roster__note">
                Seated · {build.blessingPicks.join(" → ")}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
