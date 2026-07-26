"use client";

/**
 * Herald Stage — R2 Share Stage
 * Share-first plaque (crest seal · official hex stamp · path ribbon) with full
 * operable tools below — no section tabs. Live useBuild via useShowcaseActions.
 */

import type { CSSProperties } from "react";
import {
  canSelectElective,
  type RegionId,
  unlockedRegions,
} from "@/league";
import {
  BLESSING_PATHS,
  godTierAlignments,
  PATH_TIERS,
  type BlessingPath,
} from "@/league/blessings";
import {
  availLabel,
  LEAGUE_ART,
  relicIcon,
  relicMono,
  relicPortrait,
  SHOWCASE_BLESSING_TIERS,
  SHOWCASE_REGIONS,
  SHOWCASE_RELIC_TIERS,
} from "./showcaseData";
import { useShowcaseActions } from "./useShowcaseActions";

function pathClass(path: string): string {
  return `is-${path.toLowerCase()}`;
}

export function HeraldStage() {
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
  const hexSrc = relicIcon(seatedName);
  const portraitSrc = relicPortrait(seatedName);
  const mono = seatedName ? relicMono(seatedName) : "·";

  const pathRibbon: (string | null)[] = Array.from(
    { length: PATH_TIERS.length },
    (_, i) => build.blessingPicks[i] ?? null,
  );

  const alignments = godTierAlignments(build.blessingPicks);
  const latticePaths =
    SHOWCASE_BLESSING_TIERS.find((t) => !t.godTier)?.paths ??
    ([...BLESSING_PATHS] as string[]);

  return (
    <div className="bs-herald-stage">
      {/* ── Share plaque (screenshot crop) ── */}
      <article
        className="bs-herald-stage__plaque"
        aria-label="Herald share plaque"
        style={
          {
            "--bs-hs-plate": `url(${LEAGUE_ART.trophy})`,
          } as CSSProperties
        }
      >
        <div className="bs-herald-stage__plate" aria-hidden />

        <header className="bs-herald-stage__head">
          <div className="bs-herald-stage__seal">
            <span className="bs-herald-stage__brand">EQUILIBRIUM</span>
            <span className="bs-herald-stage__sub">Leagues II · herald stage</span>
          </div>
          <span className="bs-herald-stage__count" aria-live="polite">
            {pickCounter}
          </span>
        </header>

        <div
          className="bs-herald-stage__crests"
          aria-label="Unlocked region crest seal"
        >
          {SHOWCASE_REGIONS.map((region) => {
            const lit = unlockedSet.has(region.id as RegionId);
            return (
              <div
                key={region.id}
                className={`bs-herald-stage__crest${lit ? " is-lit" : ""}`}
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
                  <span className="bs-herald-stage__crest-void" aria-hidden>
                    ·
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="bs-herald-stage__stamp-block">
          {portraitSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="bs-herald-stage__portrait-wash"
              src={portraitSrc}
              alt=""
              aria-hidden
            />
          ) : null}
          <div
            className={`bs-herald-stage__hex-stamp${
              seatedName ? " is-seated" : " is-empty"
            }`}
          >
            {hexSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hexSrc} alt="" width={72} height={72} />
            ) : (
              <span className="bs-herald-stage__mono-fallback" aria-hidden>
                {mono}
              </span>
            )}
          </div>
          <div className="bs-herald-stage__stamp-copy">
            <h2 className="bs-herald-stage__relic-title">
              {seatedName ?? "Open seat"}
            </h2>
            <p className="bs-herald-stage__relic-sub">
              {seatedName
                ? seated?.effects[0] ?? "T1 hex stamp seated"
                : "Seat a T1 relic · official hex when revealed"}
            </p>
          </div>
        </div>

        <div className="bs-herald-stage__ribbon-block">
          <span className="bs-herald-stage__ribbon-label">Blessing path</span>
          <div
            className="bs-herald-stage__ribbon"
            aria-label="Blessing path ribbon"
          >
            {pathRibbon.map((path, i) =>
              path ? (
                <span
                  key={i}
                  className={`bs-herald-stage__path-chip ${pathClass(path)}`}
                >
                  {path}
                </span>
              ) : (
                <span key={i} className="bs-herald-stage__path-chip is-empty">
                  ·
                </span>
              ),
            )}
          </div>
        </div>

        <footer className="bs-herald-stage__foot">
          <div className="bs-herald-stage__pick-bar">
            <button
              type="button"
              className="bs-herald-stage__clear"
              onClick={clearElectives}
              disabled={!loaded || picks.length === 0}
            >
              Clear picks
            </button>
          </div>
          <button
            type="button"
            className="bs-herald-stage__share"
            onClick={copyShareLink}
            disabled={!loaded}
          >
            {copyLabel === "Copy link" ? "Copy share link" : copyLabel}
          </button>
          <p className="bs-herald-stage__status">
            {pickCounter}
            {seatedName ? ` · ${seatedName}` : " · no relic"}
            {build.blessingPicks.length
              ? ` · ${build.blessingPicks.join("→")}`
              : ""}
          </p>
        </footer>
      </article>

      {/* ── Tools: always visible, no tabs ── */}
      <section
        className={`bs-herald-stage__tools${loaded ? "" : " is-loading"}`}
        aria-label="Herald planner tools"
      >
        <div className="bs-herald-stage__tool-block">
          <div className="bs-herald-stage__tool-head">
            <span className="bs-herald-stage__tool-title">Regions</span>
            <span className="bs-herald-stage__tool-meta">
              {unlocked.length}/6 unlocked · electives {pickCounter}
            </span>
          </div>
          <div className="bs-herald-stage__region-grid">
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
                  className={`bs-herald-stage__region${
                    isOn || unlockedSet.has(region.id as RegionId)
                      ? " is-on"
                      : ""
                  }${pickBlocked ? " is-blocked" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/game/regions/${region.id}.png`}
                    alt=""
                    width={20}
                    height={24}
                  />
                  <span className="bs-herald-stage__region-name">
                    {region.name}
                  </span>
                  <span className="bs-herald-stage__region-meta">
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

        <div className="bs-herald-stage__tool-block">
          <div className="bs-herald-stage__tool-head">
            <span className="bs-herald-stage__tool-title">Relic Court</span>
            <span className="bs-herald-stage__tool-meta">
              T1 · hex icons when art ships
            </span>
          </div>
          {t1 && t1.revealed && t1.choices.length > 0 ? (
            <div className="bs-herald-stage__relic-row">
              {t1.choices.map((relic) => {
                const on = seatedName === relic.name;
                const icon = relicIcon(relic.name);
                return (
                  <button
                    key={relic.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleRelic(t1.tier, relic.name)}
                    className={`bs-herald-stage__relic${on ? " is-seated" : ""}`}
                  >
                    <span className="bs-herald-stage__relic-hex" aria-hidden>
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt="" width={36} height={36} />
                      ) : (
                        <span className="bs-herald-stage__mono-fallback is-sm">
                          {relicMono(relic.name)}
                        </span>
                      )}
                    </span>
                    <span className="bs-herald-stage__relic-body">
                      <span className="bs-herald-stage__relic-name">
                        {relic.name}
                      </span>
                      {relic.effects[0] ? (
                        <span className="bs-herald-stage__relic-fx">
                          {relic.effects[0]}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="bs-herald-stage__note">
              T1 choices locked until data reveals
            </p>
          )}
        </div>

        <div className="bs-herald-stage__tool-block bs-herald-stage__tool-block--lattice">
          <div className="bs-herald-stage__tool-head">
            <span className="bs-herald-stage__tool-title">Blessing lattice</span>
            <span className="bs-herald-stage__tool-meta">
              Order · Balance · Chaos · God at 4 &amp; 8
            </span>
          </div>
          <div
            className="bs-herald-stage__lattice"
            role="grid"
            aria-label="Blessing path lattice"
          >
            <span className="bs-herald-stage__lat-corner" />
            {SHOWCASE_BLESSING_TIERS.map((tier) => (
              <span key={tier.tier} className="bs-herald-stage__lat-colhead">
                T{tier.tier}
                {tier.godTier ? "★" : ""}
              </span>
            ))}
            {latticePaths.flatMap((path) => {
              const label = (
                <span
                  key={`${path}-label`}
                  className={`bs-herald-stage__lat-path ${pathClass(path)}`}
                >
                  {path}
                </span>
              );
              const cells = SHOWCASE_BLESSING_TIERS.map((tier) => {
                if (tier.godTier) {
                  const god = alignments[tier.tier];
                  const lit = god === path;
                  return (
                    <div
                      key={`${path}-${tier.tier}`}
                      className={`bs-herald-stage__lat-cell is-god${
                        lit ? " is-on" : ""
                      }`}
                      title={
                        god
                          ? `God Tier ${tier.tier}: ${god}`
                          : `God Tier ${tier.tier} undecided`
                      }
                      aria-label={`Tier ${tier.tier} God ${path}${
                        lit ? " active" : ""
                      }`}
                    >
                      <span className="bs-herald-stage__lat-dot" aria-hidden />
                    </div>
                  );
                }
                const pickIndex = PATH_TIERS.indexOf(tier.tier);
                const validPath = (BLESSING_PATHS as readonly string[]).includes(
                  path,
                );
                if (pickIndex < 0 || !validPath) {
                  return (
                    <div
                      key={`${path}-${tier.tier}`}
                      className="bs-herald-stage__lat-cell is-locked"
                    />
                  );
                }
                const locked = pickIndex > build.blessingPicks.length;
                const selected = build.blessingPicks[pickIndex] === path;
                return (
                  <button
                    key={`${path}-${tier.tier}`}
                    type="button"
                    disabled={locked || !loaded}
                    aria-pressed={selected}
                    aria-label={`Tier ${tier.tier} ${path}`}
                    className={`bs-herald-stage__lat-cell${
                      locked ? " is-locked" : " is-open"
                    }${selected ? " is-on" : ""}`}
                    onClick={() =>
                      pickBlessing(tier.tier, path as BlessingPath)
                    }
                  >
                    <span className="bs-herald-stage__lat-dot" aria-hidden />
                  </button>
                );
              });
              return [label, ...cells];
            })}
          </div>
          <p className="bs-herald-stage__note">
            {build.blessingPicks.length
              ? `Path ${build.blessingPicks.join(" → ")} · god tiers derive from segments`
              : "Path void intentional · pick cells in tier order"}
          </p>
        </div>
      </section>
    </div>
  );
}
