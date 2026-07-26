"use client";

/**
 * War Court — Open Relic Court (R2)
 * Single viewport: region crests · relic hex icons · blessing lattice.
 * No section tabs. Official plates as atmosphere. Live useBuild.
 */

import { useMemo, useState } from "react";
import {
  blessingResetsLeft,
  canSelectElective,
  type RegionId,
  unlockedRegions,
} from "@/league";
import {
  BLESSING_PATHS,
  BLESSING_RESET_COUNT,
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

const TIER_PASSIVE: Record<number, string> = {
  1: "5 × XP",
};

export function WarCourt() {
  const {
    build,
    loaded,
    toggleRegion,
    toggleRelic,
    pickBlessing,
    resetBlessings,
    clearElectives,
    copyShareLink,
    copyLabel,
  } = useShowcaseActions();

  const [focusTier, setFocusTier] = useState(1);

  const picks = build.elective;
  const pickCounter = loaded ? `${picks.length}/3` : "…/3";
  const unlocked = unlockedRegions(build);
  const unlockedSet = new Set(unlocked);
  const resetsLeft = blessingResetsLeft(build);
  const alignments = godTierAlignments(build.blessingPicks);

  const activeTier =
    SHOWCASE_RELIC_TIERS.find((t) => t.tier === focusTier) ?? SHOWCASE_RELIC_TIERS[0];
  const seatedName = activeTier
    ? build.relics[String(activeTier.tier)] ?? null
    : null;
  const seated =
    activeTier?.choices.find((c) => c.name === seatedName) ?? null;
  const seatedIcon = relicIcon(seatedName);
  const seatedPortrait = relicPortrait(seatedName);

  const t1Seated = build.relics["1"] ?? null;
  const nextPathIndex = build.blessingPicks.length;
  const nextPathTier =
    nextPathIndex < PATH_TIERS.length ? PATH_TIERS[nextPathIndex] : null;

  const lockedHexes = useMemo(() => {
    const slots: { key: string; label: string }[] = [];
    for (const tier of SHOWCASE_RELIC_TIERS) {
      if (!tier.revealed || tier.choices.length === 0) {
        for (let i = 0; i < 3; i++) {
          slots.push({ key: `t${tier.tier}-lock-${i}`, label: `T${tier.tier}` });
        }
      }
    }
    return slots.slice(0, 18);
  }, []);

  return (
    <div className="bs-war-court">
      {/* Desaturated official plate underlay */}
      <div
        className="bs-war-court__underlay"
        style={{ backgroundImage: `url(${LEAGUE_ART.relicMenu})` }}
        aria-hidden
      />

      {/* ── Mast ─────────────────────────────────────────── */}
      <header className="bs-war-court__mast">
        <div className="bs-war-court__mast-left">
          <h2 className="bs-war-court__title">War Court</h2>
          <span className="bs-war-court__sub">Open court · full plan</span>
        </div>
        <div className="bs-war-court__mast-actions">
          <span className="bs-war-court__count" aria-live="polite">
            {pickCounter}
          </span>
          <button
            type="button"
            className="bs-war-court__btn bs-war-court__btn--gem"
            onClick={copyShareLink}
            disabled={!loaded}
          >
            {copyLabel}
          </button>
          <button
            type="button"
            className="bs-war-court__btn"
            onClick={clearElectives}
            disabled={!loaded || picks.length === 0}
          >
            Clear picks
          </button>
        </div>
      </header>

      {/* ── Main band: regions | relics | detail ─────────── */}
      <div className="bs-war-court__main">
        {/* Regions */}
        <section className="bs-war-court__col bs-war-court__col--regions" aria-label="Regions">
          <div className="bs-war-court__col-head">
            <span className="bs-war-court__col-title">Regions</span>
            <span className="bs-war-court__col-meta">
              {unlocked.length}/6 · {pickCounter}
            </span>
          </div>
          <div
            className={`bs-war-court__region-grid${loaded ? "" : " is-loading"}`}
          >
            {SHOWCASE_REGIONS.map((region) => {
              const elective = region.availability === "elective";
              const selectable =
                elective && canSelectElective(build, region.id as RegionId);
              const pickBlocked = elective && (!loaded || !selectable);
              const isOn = !elective || picks.includes(region.id as RegionId);
              const lit = isOn || unlockedSet.has(region.id as RegionId);
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
                  className={`bs-war-court__region${lit ? " is-on" : ""}${
                    pickBlocked ? " is-blocked" : ""
                  }${elective ? " is-elective" : " is-fixed"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="bs-war-court__crest"
                    src={`/game/regions/${region.id}.png`}
                    alt=""
                    width={28}
                    height={32}
                  />
                  <span className="bs-war-court__region-name">{region.name}</span>
                  <span className="bs-war-court__region-meta">
                    {isOn
                      ? elective
                        ? "picked"
                        : availLabel(region.availability)
                      : elective
                        ? availLabel(region.availability)
                        : `${region.primaryQuests}q`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Relics — hex icons + tier rail */}
        <section className="bs-war-court__col bs-war-court__col--relics" aria-label="Relics">
          <div className="bs-war-court__col-head">
            <span className="bs-war-court__col-title">Relic court</span>
            <span className="bs-war-court__col-meta">
              T{activeTier?.tier ?? 1}
              {TIER_PASSIVE[activeTier?.tier ?? 1]
                ? ` · ${TIER_PASSIVE[activeTier!.tier]}`
                : ""}
            </span>
          </div>

          <div
            className="bs-war-court__tier-rail"
            role="tablist"
            aria-label="Relic tiers"
          >
            {SHOWCASE_RELIC_TIERS.map((tier) => {
              const open = tier.revealed && tier.choices.length > 0;
              const on = focusTier === tier.tier;
              const seatedHere = build.relics[String(tier.tier)];
              return (
                <button
                  key={tier.tier}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={
                    open
                      ? `Tier ${tier.tier}${seatedHere ? `, ${seatedHere}` : ""}`
                      : `Tier ${tier.tier} unrevealed`
                  }
                  className={`bs-war-court__tier-pip${on ? " is-on" : ""}${
                    open ? " is-open" : " is-sealed"
                  }${seatedHere ? " is-seated" : ""}`}
                  onClick={() => setFocusTier(tier.tier)}
                >
                  <span className="bs-war-court__tier-n">T{tier.tier}</span>
                  {seatedHere ? (
                    <span className="bs-war-court__tier-dot" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          {activeTier && activeTier.revealed && activeTier.choices.length > 0 ? (
            <div
              className="bs-war-court__choices"
              role="listbox"
              aria-label={`Tier ${activeTier.tier} relic choices`}
            >
              {activeTier.choices.map((relic) => {
                const on = seatedName === relic.name;
                const icon = relicIcon(relic.name);
                const mono = relicMono(relic.name);
                return (
                  <button
                    key={relic.name}
                    type="button"
                    role="option"
                    aria-selected={on}
                    aria-pressed={on}
                    onClick={() => toggleRelic(activeTier.tier, relic.name)}
                    className={`bs-war-court__choice${on ? " is-on" : ""}`}
                  >
                    <span className="bs-war-court__hex" aria-hidden>
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt="" width={56} height={56} />
                      ) : (
                        <span className="bs-war-court__hex-mono">{mono}</span>
                      )}
                    </span>
                    <span className="bs-war-court__choice-name">{relic.name}</span>
                    {on ? (
                      <span className="bs-war-court__seated-tag">seated</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bs-war-court__sealed-pane">
              <p className="bs-war-court__sealed-copy">
                Tier {activeTier?.tier ?? focusTier} sealed until Jagex reveals
                choices.
              </p>
              <div className="bs-war-court__frost-row" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="bs-war-court__frost-hex" />
                ))}
              </div>
            </div>
          )}

          {lockedHexes.length > 0 ? (
            <div className="bs-war-court__lock-grid" aria-label="Unrevealed relic slots">
              {lockedHexes.map((slot) => (
                <div key={slot.key} className="bs-war-court__lock-cell" title="Unrevealed">
                  <span className="bs-war-court__frost-hex bs-war-court__frost-hex--sm" />
                  <span className="bs-war-court__lock-label">{slot.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Detail — portrait splash + effects */}
        <section className="bs-war-court__col bs-war-court__col--detail" aria-label="Relic detail">
          <div className="bs-war-court__col-head">
            <span className="bs-war-court__col-title">Detail</span>
            <span className="bs-war-court__col-meta">
              {seatedName ? seatedName : "open seat"}
            </span>
          </div>

          <div
            className={`bs-war-court__splash${seatedPortrait ? " has-art" : ""}`}
          >
            {seatedPortrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="bs-war-court__portrait"
                src={seatedPortrait}
                alt=""
              />
            ) : (
              <div className="bs-war-court__splash-void" aria-hidden>
                <span
                  className="bs-war-court__hex bs-war-court__hex--void"
                  style={
                    LEAGUE_ART.relicPlate
                      ? {
                          backgroundImage: `url(${LEAGUE_ART.relicPlate})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {seatedIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seatedIcon} alt="" width={48} height={48} />
                  ) : (
                    <span className="bs-war-court__hex-mono">
                      {relicMono(t1Seated)}
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className="bs-war-court__splash-scrim" aria-hidden />
            <div className="bs-war-court__splash-caption">
              {seatedIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="bs-war-court__splash-icon"
                  src={seatedIcon}
                  alt=""
                  width={40}
                  height={40}
                />
              ) : null}
              <div>
                <p className="bs-war-court__splash-name">
                  {seatedName ?? "Select a relic"}
                </p>
                <p className="bs-war-court__splash-meta">
                  {seated
                    ? `Tier ${activeTier?.tier ?? 1} · seated`
                    : activeTier?.revealed
                      ? `Pick one Tier ${activeTier.tier} choice`
                      : "Higher tiers sealed"}
                </p>
              </div>
            </div>
          </div>

          {seated ? (
            <ul className="bs-war-court__fx">
              {seated.effects.map((fx) => (
                <li key={fx}>{fx}</li>
              ))}
            </ul>
          ) : (
            <p className="bs-war-court__fx-empty">
              Seat a revealed relic to read full effects.
            </p>
          )}

          <dl className="bs-war-court__ledger">
            <div>
              <dt>T1</dt>
              <dd>{t1Seated ?? "—"}</dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd className="mono">
                {build.blessingPicks.length
                  ? build.blessingPicks.join(" → ")
                  : "empty"}
              </dd>
            </div>
            <div>
              <dt>Electives</dt>
              <dd>
                {picks.length
                  ? picks
                      .map(
                        (id) =>
                          SHOWCASE_REGIONS.find((r) => r.id === id)?.name ?? id,
                      )
                      .join(" · ")
                  : "none"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ── Blessing lattice (full width) ─────────────────── */}
      <section className="bs-war-court__bless" aria-label="Blessings">
        <div className="bs-war-court__bless-head">
          <div className="bs-war-court__bless-titles">
            <span className="bs-war-court__col-title">Blessing lattice</span>
            <span className="bs-war-court__col-meta">
              Order · Chaos · Balance · God Tier at 4 &amp; 8
              {nextPathTier != null
                ? ` · next open T${nextPathTier}`
                : ` · path full`}
            </span>
          </div>
          <button
            type="button"
            className="bs-war-court__btn"
            disabled={resetsLeft === 0 || build.blessingPicks.length === 0}
            onClick={resetBlessings}
          >
            Reset ({resetsLeft}/{BLESSING_RESET_COUNT})
          </button>
        </div>

        <div
          className="bs-war-court__bless-grid"
          role="grid"
          aria-label="Blessing path lattice"
        >
          <span className="bs-war-court__bless-corner" aria-hidden />
          {SHOWCASE_BLESSING_TIERS.map((tier) => (
            <span key={tier.tier} className="bs-war-court__bless-colhead">
              T{tier.tier}
              {tier.godTier ? "★" : ""}
            </span>
          ))}
          {BLESSING_PATHS.flatMap((path) => {
            const label = (
              <span
                key={`${path}-label`}
                className={`bs-war-court__bless-path ${pathClass(path)}`}
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
                    className={`bs-war-court__bless-cell is-god${
                      lit ? " is-on" : " is-locked"
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
                    <span className="bs-war-court__bless-dot" aria-hidden />
                  </div>
                );
              }
              const pickIndex = PATH_TIERS.indexOf(tier.tier);
              if (pickIndex < 0) {
                return (
                  <div
                    key={`${path}-${tier.tier}`}
                    className="bs-war-court__bless-cell is-locked"
                  />
                );
              }
              const locked = pickIndex > build.blessingPicks.length;
              const selected = build.blessingPicks[pickIndex] === path;
              const unrevealed = !tier.revealed;
              return (
                <button
                  key={`${path}-${tier.tier}`}
                  type="button"
                  disabled={locked}
                  aria-pressed={selected}
                  aria-label={`Tier ${tier.tier} ${path}${
                    unrevealed ? ", effects unrevealed" : ""
                  }`}
                  className={`bs-war-court__bless-cell${
                    locked ? " is-locked" : " is-open"
                  }${selected ? " is-on" : ""}${
                    unrevealed && !selected ? " is-frost" : ""
                  } ${pathClass(path)}`}
                  onClick={() => pickBlessing(tier.tier, path as BlessingPath)}
                >
                  <span className="bs-war-court__bless-dot" aria-hidden />
                </button>
              );
            });
            return [label, ...cells];
          })}
        </div>

        <p className="bs-war-court__bless-note">
          {SHOWCASE_BLESSING_TIERS.some((t) => t.revealed)
            ? SHOWCASE_BLESSING_TIERS.filter((t) => t.godTier)
                .map((t) =>
                  alignments[t.tier]
                    ? `T${t.tier} ${alignments[t.tier]} God`
                    : `T${t.tier} God undecided`,
                )
                .join(" · ")
            : "Blessing effects empty until Jagex publishes — path picks still plan ahead."}
        </p>
      </section>
    </div>
  );
}
