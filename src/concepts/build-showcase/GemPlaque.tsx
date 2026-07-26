"use client";

/**
 * Gem Plaque — Centered Seal
 * Showcase-first gem frame; tools under the seal.
 */

import { useState } from "react";
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

export function GemPlaque() {
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

  const nextPathIndex = build.blessingPicks.length;
  const nextPathTier =
    nextPathIndex < PATH_TIERS.length ? PATH_TIERS[nextPathIndex] : null;

  const [toolsOpen, setToolsOpen] = useState(true);

  return (
    <div className="bs-plaque">
      <div className="bs-plaque__card">
        <div className="bs-plaque__gem-edge" aria-hidden />
        <div className="bs-plaque__inner">
          <div className="bs-plaque__head">
            <p className="bs-plaque__eyebrow">Gem plaque · plan seal</p>
            <span className="bs-plaque__count" aria-live="polite">
              {pickCounter}
            </span>
          </div>

          <div className="bs-plaque__hero">
            <div
              className={`bs-plaque__mono-seal${seatedName ? " is-seated" : ""}`}
              aria-hidden
            >
              {mono}
            </div>
            <div className="bs-plaque__hero-copy">
              <h2 className="bs-plaque__title">{seatedName ?? "Open seat"}</h2>
              <p className="bs-plaque__sub">
                {seatedName
                  ? "T1 monogram seated · SV / EH / GT only"
                  : "Carved void · seat a T1 relic"}
              </p>
            </div>
          </div>

          <div className="bs-plaque__crest-arc" aria-label="Region crest arc">
            {SHOWCASE_REGIONS.map((region) => {
              const lit = unlockedSet.has(region.id as RegionId);
              return (
                <div
                  key={region.id}
                  className={`bs-plaque__crest-cell${lit ? " is-lit" : ""}`}
                  title={region.name}
                >
                  {lit ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/game/regions/${region.id}.png`}
                      alt=""
                      width={26}
                      height={30}
                    />
                  ) : (
                    <span className="bs-plaque__crest-empty">·</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bs-plaque__triad" aria-label="Path triad">
            {BLESSING_PATHS.map((path) => {
              const n = build.blessingPicks.filter((p) => p === path).length;
              return (
                <div
                  key={path}
                  className={`bs-plaque__path-seal ${pathClass(path)}${
                    n > 0 ? " is-picked" : ""
                  }`}
                >
                  <span className="bs-plaque__path-name">{path}</span>
                  <span className="bs-plaque__path-n">{n || "—"}</span>
                </div>
              );
            })}
          </div>
          <p
            className={`bs-plaque__path-trail${
              build.blessingPicks.length ? "" : " is-quiet"
            }`}
          >
            {build.blessingPicks.length
              ? build.blessingPicks.join(" → ")
              : "path void · intentional empty"}
          </p>

          <div className="bs-plaque__cta-row">
            <button type="button" className="bs-plaque__share" onClick={copyShareLink}>
              {copyLabel === "Copy link" ? "Copy share link" : copyLabel}
            </button>
            <button
              type="button"
              className="bs-plaque__clear"
              onClick={clearElectives}
              disabled={!loaded || picks.length === 0}
            >
              Clear picks
            </button>
          </div>
        </div>
      </div>

      <div className="bs-plaque__tools">
        <button
          type="button"
          className="bs-plaque__tools-toggle"
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((v) => !v)}
        >
          <span>Tools · regions · relics · path</span>
          <span>{toolsOpen ? "Hide" : "Show"}</span>
        </button>
        {toolsOpen ? (
          <div className="bs-plaque__tools-body">
            {t1 && t1.revealed && t1.choices.length > 0 ? (
              <div className="bs-plaque__relic-row">
                {t1.choices.map((relic) => {
                  const on = seatedName === relic.name;
                  return (
                    <button
                      key={relic.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleRelic(t1.tier, relic.name)}
                      className={`bs-plaque__relic${on ? " is-seated" : ""}`}
                    >
                      <span className="bs-plaque__relic-mono" aria-hidden>
                        {relicMono(relic.name)}
                      </span>
                      <span className="bs-plaque__relic-name">{relic.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {nextPathTier != null ? (
              <div className="bs-plaque__path-pick">
                {BLESSING_PATHS.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => pickBlessing(nextPathTier, path as BlessingPath)}
                    className={`bs-plaque__path-btn ${pathClass(path)}`}
                  >
                    {path}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="bs-plaque__region-grid">
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
                    className={`bs-plaque__region${isOn ? " is-on" : ""}${
                      pickBlocked ? " is-blocked" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/game/regions/${region.id}.png`}
                      alt=""
                      width={18}
                      height={22}
                    />
                    <span className="bs-plaque__region-name">{region.name}</span>
                    <span className="bs-plaque__region-meta">
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
            <p className="bs-plaque__fixed-note">
              Fixed regions always on · 3 electives max · monograms SV/EH/GT only
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
