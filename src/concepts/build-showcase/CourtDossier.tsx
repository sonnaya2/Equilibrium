"use client";

/**
 * Court Dossier — Dense Folio
 * Two-column war folio: region lattice | monogram court + path stamps.
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

export function CourtDossier() {
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
  const seated = t1?.choices.find((c) => c.name === seatedName) ?? null;
  const mono = seatedName ? relicMono(seatedName) : "·";

  const nextPathIndex = build.blessingPicks.length;
  const nextPathTier =
    nextPathIndex < PATH_TIERS.length ? PATH_TIERS[nextPathIndex] : null;

  return (
    <div className="bs-dossier">
      <header className="bs-dossier__mast">
        <div className="bs-dossier__mast-left">
          <h2 className="bs-dossier__title">Court Dossier</h2>
          <span className="bs-dossier__folio">Dense folio · plan sheet</span>
        </div>
        <div className="bs-dossier__mast-right">
          <span className="bs-dossier__count" aria-live="polite">
            {pickCounter}
          </span>
          <button
            type="button"
            className="bs-dossier__clear"
            onClick={clearElectives}
            disabled={!loaded || picks.length === 0}
          >
            Clear picks
          </button>
        </div>
      </header>

      <div className="bs-dossier__sheet">
        <section className="bs-dossier__col bs-dossier__col--regions" aria-label="Regions">
          <div className="bs-dossier__col-head">
            <span className="bs-dossier__col-title">Regions</span>
            <span className="bs-dossier__col-meta">{unlocked.length}/6 unlocked</span>
          </div>
          <div className={`bs-dossier__region-grid${loaded ? "" : " is-loading"}`}>
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
                  className={`bs-dossier__region${
                    isOn || unlockedSet.has(region.id as RegionId) ? " is-on" : ""
                  }${pickBlocked ? " is-blocked" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="bs-dossier__crest"
                    src={`/game/regions/${region.id}.png`}
                    alt=""
                    width={18}
                    height={22}
                  />
                  <span className="bs-dossier__region-name">{region.name}</span>
                  <span className="bs-dossier__region-meta mono">
                    {isOn
                      ? elective
                        ? "picked"
                        : availLabel(region.availability)
                      : `${region.primaryQuests}q`}
                  </span>
                </button>
              );
            })}
          </div>

          <dl className="bs-dossier__ledger">
            <div>
              <dt>Primary quests</dt>
              <dd className="mono">
                {SHOWCASE_REGIONS.filter(
                  (r) =>
                    r.availability !== "elective" ||
                    picks.includes(r.id as RegionId),
                ).reduce((n, r) => n + r.primaryQuests, 0)}
              </dd>
            </div>
            <div>
              <dt>Electives</dt>
              <dd>
                {picks.length
                  ? picks
                      .map((id) => SHOWCASE_REGIONS.find((r) => r.id === id)?.name ?? id)
                      .join(" · ")
                  : "none"}
              </dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd className="mono">
                {build.blessingPicks.length
                  ? build.blessingPicks.join(" → ")
                  : "empty"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="bs-dossier__col bs-dossier__col--court" aria-label="Court">
          <div className="bs-dossier__col-head">
            <span className="bs-dossier__col-title">Monogram court</span>
            <span className="bs-dossier__col-meta">T1 · stamps</span>
          </div>

          {t1 && t1.revealed && t1.choices.length > 0 ? (
            <div className="bs-dossier__relics">
              {t1.choices.map((relic) => {
                const on = seatedName === relic.name;
                return (
                  <button
                    key={relic.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleRelic(t1.tier, relic.name)}
                    className={`bs-dossier__relic${on ? " is-seated" : ""}`}
                  >
                    <span className="bs-dossier__mono" aria-hidden>
                      {relicMono(relic.name)}
                    </span>
                    <span className="bs-dossier__relic-body">
                      <span className="bs-dossier__relic-name">{relic.name}</span>
                      {on ? <span className="bs-dossier__seated-tag">seated</span> : null}
                      <span className="bs-dossier__relic-blurb">{relic.effects[0]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="bs-dossier__fx-empty">Court sealed until T1 reveals.</p>
          )}

          {seated ? (
            <div className="bs-dossier__effects">
              <p className="bs-dossier__effects-label">
                <span className="bs-dossier__effects-mono">{mono}</span>
                {seated.name} · effects
              </p>
              <ul className="bs-dossier__fx-list">
                {seated.effects.map((fx) => (
                  <li key={fx}>{fx}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="bs-dossier__fx-empty">Seat a T1 relic for full effects.</p>
          )}

          <div className="bs-dossier__bless">
            <span className="bs-dossier__bless-label">Blessing stamps</span>
            <div className="bs-dossier__path-row">
              {BLESSING_PATHS.map((path) => {
                const n = build.blessingPicks.filter((p) => p === path).length;
                const picked = n > 0;
                return (
                  <button
                    key={path}
                    type="button"
                    disabled={nextPathTier == null}
                    onClick={() => {
                      if (nextPathTier != null) {
                        pickBlessing(nextPathTier, path as BlessingPath);
                      }
                    }}
                    className={`bs-dossier__path-seal ${pathClass(path)}${
                      picked ? " is-picked" : ""
                    }`}
                  >
                    {path}
                    {n > 0 ? ` · ${n}` : ""}
                  </button>
                );
              })}
            </div>
            <p className="bs-dossier__bless-stamp">
              {nextPathTier != null
                ? `Next open · tier ${nextPathTier}`
                : `Path full · ${PATH_TIERS.length} seated`}
            </p>
          </div>

          <div className="bs-dossier__stamps">
            <div>
              <span className="bs-dossier__stamp-k">T1</span>
              <span className="bs-dossier__stamp-v">{seatedName ?? "—"}</span>
            </div>
            <div className="bs-dossier__stamp--share">
              <button type="button" className="bs-dossier__share" onClick={copyShareLink}>
                {copyLabel}
              </button>
              <button
                type="button"
                className="bs-dossier__clear bs-dossier__clear--foot"
                onClick={clearElectives}
                disabled={!loaded || picks.length === 0}
              >
                Clear picks
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
