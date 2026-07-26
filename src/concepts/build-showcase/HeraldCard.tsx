"use client";

/**
 * Herald Card — vertical share plaque (Crest Plaque).
 * EQUILIBRIUM seal · unlocked crests · T1 monogram stamp · path ribbon · share.
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

export function HeraldCard() {
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
  const unlockedSet = new Set(unlocked);

  const t1 = SHOWCASE_RELIC_TIERS.find((t) => t.tier === 1);
  const seatedName = t1 ? build.relics[String(t1.tier)] ?? null : null;
  const mono = seatedName ? relicMono(seatedName) : "·";
  const seated = t1?.choices.find((c) => c.name === seatedName) ?? null;

  const pathRibbon: (string | null)[] = Array.from(
    { length: PATH_TIERS.length },
    (_, i) => build.blessingPicks[i] ?? null,
  );
  const nextPathIndex = build.blessingPicks.length;
  const nextPathTier =
    nextPathIndex < PATH_TIERS.length ? PATH_TIERS[nextPathIndex] : null;

  return (
    <div className="bs-herald">
      <article className="bs-herald__plaque" aria-label="Herald share plaque">
        <div className="bs-herald__plaque-top">
          <div className="bs-herald__seal">
            <span className="bs-herald__brand">EQUILIBRIUM</span>
            <span className="bs-herald__sub">Leagues II · seal</span>
          </div>

          <div className="bs-herald__crest-row" aria-label="Unlocked region crests">
            {unlocked.map((id) => {
              const region = SHOWCASE_REGIONS.find((r) => r.id === id);
              return (
                <div key={id} className="bs-herald__crest" title={region?.name ?? id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/game/regions/${id}.png`} alt="" width={28} height={32} />
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, 6 - unlocked.length) }).map((_, i) => (
              <div key={`void-${i}`} className="bs-herald__crest is-empty" aria-hidden>
                <span className="bs-herald__crest-void">·</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bs-herald__stamp">
          <span
            className={`bs-herald__mono${seatedName ? " is-seated" : " is-empty"}`}
            aria-hidden
          >
            {mono}
          </span>
          {seatedName ? (
            <p className="bs-herald__relic-name">{seatedName}</p>
          ) : (
            <p className="bs-herald__relic-hint">Seat a T1 relic</p>
          )}
          {seated?.effects[0] ? (
            <p className="bs-herald__relic-hint line-clamp-2">{seated.effects[0]}</p>
          ) : null}
        </div>

        <div className="bs-herald__ribbon-block">
          <span className="bs-herald__ribbon-label">Blessing path</span>
          <div className="bs-herald__ribbon" aria-label="Blessing path ribbon">
            {pathRibbon.map((path, i) =>
              path ? (
                <span key={i} className={`bs-herald__path-chip ${pathClass(path)}`}>
                  {path}
                </span>
              ) : (
                <span key={i} className="bs-herald__path-chip is-empty">
                  ·
                </span>
              ),
            )}
          </div>
        </div>

        <div className="bs-herald__foot">
          <div className="bs-herald__pick-bar">
            <span className="bs-herald__count" aria-live="polite">
              {pickCounter}
            </span>
            <button
              type="button"
              onClick={clearElectives}
              disabled={!loaded || picks.length === 0}
              className="bs-herald__clear"
            >
              Clear picks
            </button>
          </div>
          <button
            type="button"
            onClick={copyShareLink}
            disabled={!loaded}
            className="bs-herald__share"
          >
            {copyLabel === "Copy link" ? "Copy share link" : copyLabel}
          </button>
          <p className="bs-herald__status">
            {pickCounter}
            {seatedName ? ` · ${seatedName}` : " · no relic"}
            {build.blessingPicks.length ? ` · ${build.blessingPicks.join("→")}` : ""}
          </p>
        </div>
      </article>

      <section className="bs-herald__tools-panel" aria-label="Herald planner tools">
        <div className="bs-herald__tools-head">Tools · denser region lattice</div>
        <div
          className={`bs-herald__tools-body${loaded ? "" : " is-loading"}`}
        >
          <div className="bs-herald__region-grid">
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
                  className={`bs-herald__region${
                    isOn || unlockedSet.has(region.id as RegionId) ? " is-on" : ""
                  }${pickBlocked ? " is-blocked" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/game/regions/${region.id}.png`}
                    alt=""
                    width={22}
                    height={26}
                  />
                  <span className="bs-herald__region-name">{region.name}</span>
                  <span className="bs-herald__region-meta">
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

          {t1 && t1.revealed && t1.choices.length > 0 ? (
            <>
              <p className="bs-herald__note">T1 Relic Court · monogram only</p>
              <div className="bs-herald__relic-row">
                {t1.choices.map((relic) => {
                  const selected = seatedName === relic.name;
                  return (
                    <button
                      key={relic.name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleRelic(t1.tier, relic.name)}
                      className={`bs-herald__relic${selected ? " is-selected" : ""}`}
                    >
                      <span
                        className={`bs-herald__mono bs-herald__mono--sm${
                          selected ? " is-seated" : ""
                        }`}
                        aria-hidden
                      >
                        {relicMono(relic.name)}
                      </span>
                      <span className="bs-herald__relic-label">{relic.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {nextPathTier != null ? (
            <>
              <p className="bs-herald__note">Next path · tier {nextPathTier}</p>
              <div className="bs-herald__path-pick">
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
            <p className="bs-herald__note">
              Path complete · {PATH_TIERS.length} picks seated
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
