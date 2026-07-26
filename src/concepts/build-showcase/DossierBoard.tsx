"use client";

/**
 * Dossier Board — Art Folio (R2)
 * Dense two-column editorial planner: region lattice | hex court + splash + path stamps.
 * Sticky share strip. No section tabs. Real relic/region/league art.
 */

import { canSelectElective, type RegionId, unlockedRegions } from "@/league";
import { BLESSING_PATHS, PATH_TIERS, type BlessingPath } from "@/league/blessings";
import {
  availLabel,
  LEAGUE_ART,
  relicIcon,
  relicPortrait,
  SHOWCASE_REGIONS,
  SHOWCASE_RELIC_TIERS,
} from "./showcaseData";
import { useShowcaseActions } from "./useShowcaseActions";

function pathClass(path: string): string {
  return `is-${path.toLowerCase()}`;
}

export function DossierBoard() {
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
  const seatedName = t1 ? (build.relics[String(t1.tier)] ?? null) : null;
  const seated = t1?.choices.find((c) => c.name === seatedName) ?? null;
  const seatedIcon = relicIcon(seatedName);
  const seatedPortrait = relicPortrait(seatedName);

  const nextPathIndex = build.blessingPicks.length;
  const nextPathTier =
    nextPathIndex < PATH_TIERS.length ? PATH_TIERS[nextPathIndex] : null;

  const pathRibbon: (string | null)[] = Array.from(
    { length: PATH_TIERS.length },
    (_, i) => build.blessingPicks[i] ?? null,
  );

  const pathSummary = build.blessingPicks.length
    ? build.blessingPicks.join(" → ")
    : "path empty";

  const electiveNames = picks
    .map((id) => SHOWCASE_REGIONS.find((r) => r.id === id)?.name ?? id)
    .join(" · ");

  const primarySum = SHOWCASE_REGIONS.filter(
    (r) => r.availability !== "elective" || picks.includes(r.id as RegionId),
  ).reduce((n, r) => n + r.primaryQuests, 0);

  return (
    <div className="bs-dossier-board">
      {/* Sticky share strip — always operable */}
      <div
        className="bs-dossier-board__strip"
        role="region"
        aria-label="Plan share strip"
      >
        <span className="bs-dossier-board__count" aria-live="polite">
          {pickCounter}
        </span>
        <button
          type="button"
          className="bs-dossier-board__clear"
          onClick={clearElectives}
          disabled={!loaded || picks.length === 0}
        >
          Clear picks
        </button>
        <button
          type="button"
          className="bs-dossier-board__share"
          onClick={copyShareLink}
          disabled={!loaded}
        >
          {copyLabel}
        </button>
        <span className="bs-dossier-board__strip-sep" aria-hidden>
          ·
        </span>
        <span className="bs-dossier-board__strip-meta mono">
          {seatedName ?? "no T1"}
        </span>
        <span className="bs-dossier-board__strip-sep" aria-hidden>
          ·
        </span>
        <span className="bs-dossier-board__strip-path" title={pathSummary}>
          {pathSummary}
        </span>
        {unlocked.length > 0 ? (
          <div className="bs-dossier-board__strip-crests" aria-hidden>
            {unlocked.slice(0, 6).map((id) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={id}
                src={`/game/regions/${id}.png`}
                alt=""
                width={16}
                height={18}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Thin mast — optional official plate as atmosphere only */}
      <header
        className="bs-dossier-board__mast"
        style={{
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--color-stone-900) 78%, transparent) 0%, var(--color-stone-950) 100%), url(${LEAGUE_ART.header})`,
        }}
      >
        <div className="bs-dossier-board__mast-left">
          <h2 className="bs-dossier-board__title">Dossier Board</h2>
          <span className="bs-dossier-board__folio">Art folio · full plan sheet</span>
        </div>
        <div className="bs-dossier-board__mast-right">
          <span className="bs-dossier-board__mast-stat mono">
            {unlocked.length}/6 unlocked
          </span>
          <span className="bs-dossier-board__mast-stat mono">
            {primarySum} primary q
          </span>
        </div>
      </header>

      <div className="bs-dossier-board__sheet">
        {/* ── Left: region lattice ── */}
        <section
          className="bs-dossier-board__col bs-dossier-board__col--regions"
          aria-label="Regions"
        >
          <div className="bs-dossier-board__col-head">
            <span className="bs-dossier-board__col-title">Regions</span>
            <span className="bs-dossier-board__col-meta">
              11 · crests · quests
            </span>
          </div>

          <div
            className={`bs-dossier-board__region-table${loaded ? "" : " is-loading"}`}
            role="table"
            aria-label="Region pick table"
          >
            <div className="bs-dossier-board__region-head" role="row">
              <span role="columnheader">Region</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Q</span>
            </div>
            {SHOWCASE_REGIONS.map((region) => {
              const elective = region.availability === "elective";
              const selectable =
                elective && canSelectElective(build, region.id as RegionId);
              const pickBlocked = elective && (!loaded || !selectable);
              const isOn = !elective || picks.includes(region.id as RegionId);
              const isUnlocked = unlockedSet.has(region.id as RegionId);
              return (
                <button
                  key={region.id}
                  type="button"
                  role="row"
                  aria-pressed={isOn}
                  aria-disabled={pickBlocked || undefined}
                  disabled={pickBlocked}
                  onClick={() => {
                    if (elective && loaded && selectable) {
                      toggleRegion(region.id as RegionId);
                    }
                  }}
                  className={`bs-dossier-board__region${
                    isOn || isUnlocked ? " is-on" : ""
                  }${pickBlocked ? " is-blocked" : ""}${
                    elective ? " is-elective" : " is-fixed"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="bs-dossier-board__crest"
                    src={`/game/regions/${region.id}.png`}
                    alt=""
                    width={18}
                    height={22}
                  />
                  <span className="bs-dossier-board__region-name">
                    {region.name}
                  </span>
                  <span className="bs-dossier-board__region-status mono">
                    {isOn
                      ? elective
                        ? "picked"
                        : availLabel(region.availability)
                      : elective
                        ? "open"
                        : availLabel(region.availability)}
                  </span>
                  <span className="bs-dossier-board__region-q mono">
                    {region.primaryQuests}
                  </span>
                </button>
              );
            })}
          </div>

          <dl className="bs-dossier-board__ledger">
            <div>
              <dt>Electives</dt>
              <dd>{electiveNames || "none"}</dd>
            </div>
            <div>
              <dt>Primary quests</dt>
              <dd className="mono">{primarySum}</dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd className="mono">{pathSummary}</dd>
            </div>
          </dl>
        </section>

        {/* ── Right: relic court + splash + blessings ── */}
        <section
          className="bs-dossier-board__col bs-dossier-board__col--court"
          aria-label="Relic court and blessings"
        >
          <div className="bs-dossier-board__col-head">
            <span className="bs-dossier-board__col-title">Relic court</span>
            <span className="bs-dossier-board__col-meta">T1 · hex · splash</span>
          </div>

          {t1 && t1.revealed && t1.choices.length > 0 ? (
            <div className="bs-dossier-board__relics" role="list">
              {t1.choices.map((relic) => {
                const on = seatedName === relic.name;
                const icon = relicIcon(relic.name);
                return (
                  <button
                    key={relic.name}
                    type="button"
                    role="listitem"
                    aria-pressed={on}
                    onClick={() => toggleRelic(t1.tier, relic.name)}
                    className={`bs-dossier-board__relic${on ? " is-seated" : ""}`}
                  >
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="bs-dossier-board__hex"
                        src={icon}
                        alt=""
                        width={40}
                        height={40}
                      />
                    ) : (
                      <span className="bs-dossier-board__hex-void" aria-hidden>
                        ·
                      </span>
                    )}
                    <span className="bs-dossier-board__relic-body">
                      <span className="bs-dossier-board__relic-name">
                        {relic.name}
                      </span>
                      {on ? (
                        <span className="bs-dossier-board__seated-tag">seated</span>
                      ) : null}
                      <span className="bs-dossier-board__relic-blurb">
                        {relic.effects[0]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="bs-dossier-board__empty">Court sealed until T1 reveals.</p>
          )}

          {/* Seated splash portrait + full effects */}
          <div
            className={`bs-dossier-board__splash${seated ? " is-lit" : ""}`}
            aria-label={seated ? `${seated.name} detail` : "Open relic seat"}
          >
            {seated && seatedPortrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="bs-dossier-board__portrait"
                src={seatedPortrait}
                alt=""
                width={120}
                height={160}
              />
            ) : (
              <div className="bs-dossier-board__portrait-void" aria-hidden>
                {seatedIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seatedIcon} alt="" width={48} height={48} />
                ) : (
                  <span>·</span>
                )}
              </div>
            )}
            <div className="bs-dossier-board__splash-body">
              {seated ? (
                <>
                  <p className="bs-dossier-board__splash-name">{seated.name}</p>
                  <p className="bs-dossier-board__splash-k">T1 effects</p>
                  <ul className="bs-dossier-board__fx-list">
                    {seated.effects.map((fx) => (
                      <li key={fx}>{fx}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="bs-dossier-board__empty">
                  Seat a T1 relic — hex pick loads splash detail.
                </p>
              )}
            </div>
          </div>

          {/* Blessing path stamps + lattice */}
          <div className="bs-dossier-board__bless">
            <div className="bs-dossier-board__col-head">
              <span className="bs-dossier-board__col-title">Blessing path</span>
              <span className="bs-dossier-board__col-meta">
                {nextPathTier != null
                  ? `next · tier ${nextPathTier}`
                  : `full · ${PATH_TIERS.length}`}
              </span>
            </div>

            <div
              className="bs-dossier-board__lattice"
              aria-label="Blessing path lattice"
            >
              {pathRibbon.map((path, i) => (
                <div
                  key={PATH_TIERS[i] ?? i}
                  className={`bs-dossier-board__slot${
                    path ? ` is-filled ${pathClass(path)}` : " is-open"
                  }${nextPathIndex === i ? " is-next" : ""}`}
                >
                  <span className="bs-dossier-board__slot-tier mono">
                    T{PATH_TIERS[i]}
                  </span>
                  <span className="bs-dossier-board__slot-path">
                    {path ?? "—"}
                  </span>
                </div>
              ))}
            </div>

            <div className="bs-dossier-board__path-row">
              {BLESSING_PATHS.map((path) => {
                const n = build.blessingPicks.filter((p) => p === path).length;
                const picked = n > 0;
                return (
                  <button
                    key={path}
                    type="button"
                    disabled={nextPathTier == null || !loaded}
                    onClick={() => {
                      if (nextPathTier != null) {
                        pickBlessing(nextPathTier, path as BlessingPath);
                      }
                    }}
                    className={`bs-dossier-board__path-seal ${pathClass(path)}${
                      picked ? " is-picked" : ""
                    }`}
                  >
                    {path}
                    {n > 0 ? ` · ${n}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
