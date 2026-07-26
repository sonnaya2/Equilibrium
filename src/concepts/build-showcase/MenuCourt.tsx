"use client";

/**
 * Menu Court — isolated board (menu-court.css only).
 * Seal -> 11 region tiles -> T1-T7 relic rows -> blessing lattice.
 */

import { canSelectElective, type RegionId } from "@/league";
import {
  godTierAlignments,
  PATH_TIERS,
  type BlessingPath,
} from "@/league/blessings";
import { regionCrestPath } from "@/lib/gameArt";
import {
  availLabel,
  relicIcon,
  relicMono,
  SHOWCASE_BLESSING_TIERS,
  SHOWCASE_REGIONS,
  SHOWCASE_RELIC_TIERS,
} from "./showcaseData";
import { useShowcaseActions } from "./useShowcaseActions";
import "./menu-court.css";

const SEATS = 3;

function shortName(name: string): string {
  if (name.length <= 11) return name;
  const first = name.split(/\s+/)[0] ?? name;
  return first.length <= 11 ? first : `${first.slice(0, 10)}...`;
}

export function MenuCourt() {
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

  const picks = build.elective;
  const pickCounter = loaded ? `${picks.length}/3` : ".../3";
  const alignments = godTierAlignments(build.blessingPicks);
  const blessTiers = SHOWCASE_BLESSING_TIERS;

  return (
    <div className="mc">
      <div className="mc__frame">
        <header className="mc__seal">
          <h2 className="mc__title">Build</h2>
          <span className="mc__count" aria-live="polite">
            {pickCounter}
          </span>
          {build.blessingPicks.length > 0 ? (
            <span
              className="mc__pips"
              aria-label={`Path ${build.blessingPicks.join(" then ")}`}
            >
              {build.blessingPicks.map((p, i) => (
                <span
                  key={`${p}-${i}`}
                  className={`mc__pip is-${p.toLowerCase()}`}
                  title={p}
                />
              ))}
            </span>
          ) : null}
          <div className="mc__actions">
            <button
              type="button"
              className="mc__btn"
              disabled={!loaded || picks.length === 0}
              onClick={clearElectives}
            >
              Clear picks
            </button>
            <button
              type="button"
              className="mc__btn mc__btn--gem"
              disabled={!loaded}
              onClick={copyShareLink}
            >
              {copyLabel}
            </button>
            <button
              type="button"
              className="mc__btn"
              disabled={!loaded}
              onClick={resetBuild}
            >
              Reset build
            </button>
          </div>
        </header>

        <section className="mc__zone" aria-label="Regions">
          <h3 className="mc__zone-title">Regions</h3>
          <div className="mc__crests">
            {SHOWCASE_REGIONS.map((region) => {
              const elective = region.availability === "elective";
              const selectable =
                elective && canSelectElective(build, region.id as RegionId);
              const blocked = elective && (!loaded || !selectable);
              const isOn = !elective || picks.includes(region.id as RegionId);
              const meta = availLabel(region.availability);
              const status = blocked
                ? "blocked"
                : isOn && elective
                  ? "picked"
                  : meta;
              const cls = [
                "mc__crest",
                isOn ? "is-on" : "",
                elective && !isOn ? "is-dim" : "",
                blocked ? "is-blocked" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={region.id}
                  type="button"
                  className={cls}
                  aria-pressed={isOn}
                  aria-disabled={blocked || undefined}
                  disabled={blocked}
                  aria-label={`${region.name}, ${status}`}
                  onClick={() => {
                    if (elective && loaded && selectable) {
                      toggleRegion(region.id as RegionId);
                    }
                  }}
                >
                  <span
                    className="mc__crest-art"
                    aria-hidden
                    style={{ backgroundImage: `url(${regionCrestPath(region.id)})` }}
                  />
                  <span className="mc__crest-name" aria-hidden>
                    {region.name}
                  </span>
                  <span className="mc__crest-meta" aria-hidden>
                    {meta}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mc__zone" aria-label="Relics">
          <h3 className="mc__zone-title">Relics - hover for effects</h3>
          <div className="mc__relics">
            {SHOWCASE_RELIC_TIERS.map((tier) => {
              const open = tier.revealed && tier.choices.length > 0;
              const seated = build.relics[String(tier.tier)] ?? null;
              const choices = open ? tier.choices : [];
              const seats = Array.from({ length: SEATS }, (_, i) => choices[i] ?? null);

              return (
                <div
                  key={tier.tier}
                  className={`mc__tier${open ? "" : " is-sealed"}`}
                  role="group"
                  aria-label={`Tier ${tier.tier}${open ? "" : " sealed"}`}
                >
                  <span className="mc__tier-id" aria-hidden>
                    T{tier.tier}
                  </span>
                  <div
                    className="mc__seats"
                    role="listbox"
                    aria-label={`Tier ${tier.tier} choices`}
                  >
                    {seats.map((relic, i) => {
                      if (!relic) {
                        return (
                          <span
                            key={`e-${tier.tier}-${i}`}
                            className="mc__seat is-empty"
                            title={open ? undefined : "Sealed until reveal"}
                            aria-hidden
                          >
                            <span className="mc__seat-plus">+</span>
                          </span>
                        );
                      }
                      const on = seated === relic.name;
                      const icon = relicIcon(relic.name);
                      const mono = relicMono(relic.name);
                      return (
                        <button
                          key={relic.name}
                          type="button"
                          role="option"
                          aria-selected={on}
                          aria-pressed={on}
                          aria-label={relic.name}
                          className={`mc__seat${on ? " is-on" : ""}`}
                          onClick={() => toggleRelic(tier.tier, relic.name)}
                        >
                          {icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={icon} alt="" width={32} height={32} />
                          ) : (
                            <span className="mc__seat-mono" aria-hidden>
                              {mono}
                            </span>
                          )}
                          <span className="mc__seat-name">{shortName(relic.name)}</span>
                          <span className="mc__tip" role="tooltip">
                            <strong>{relic.name}</strong>
                            <ul>
                              {relic.effects.map((fx) => (
                                <li key={fx}>{fx}</li>
                              ))}
                            </ul>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="mc__tier-mark" aria-hidden>
                    *
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mc__zone mc__zone--bless" aria-label="Blessings">
          <h3 className="mc__zone-title">Blessings</h3>
          <div className="mc__bless-board">
            <div
              className="mc__lattice"
              role="grid"
              aria-label="Blessing path lattice"
              style={{
                gridTemplateColumns: `7.5rem repeat(${blessTiers.length}, minmax(0, 1fr))`,
              }}
            >
              <span className="mc__lat-corner" aria-hidden />
              {blessTiers.map((t) => (
                <span
                  key={t.tier}
                  className={`mc__lat-head${t.godTier ? " is-god" : ""}`}
                >
                  T{t.tier}
                  {t.godTier ? "?" : ""}
                </span>
              ))}

              {(["Order", "Balance", "Chaos"] as const).map((path) => (
                <div key={path} className="mc__lat-contents" style={{ display: "contents" }}>
                  <div className={`mc__lat-path is-${path.toLowerCase()}`}>
                    <span className="mc__lat-ico" aria-hidden>
                      {path === "Order" ? (
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path
                            fill="currentColor"
                            d="M8 1.2 8.9 5h3.6L9.7 7.3l1 3.9L8 9.2l-2.7 2 1-3.9L3.5 5h3.6L8 1.2z"
                          />
                        </svg>
                      ) : path === "Balance" ? (
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path
                            fill="currentColor"
                            d="M8 1v2.2L3.5 5.5 2 9.5h4L8 5.8l2 3.7h4L12.5 5.5 8 3.2V1zm0 9.5L5.8 14h4.4L8 10.5z"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path
                            fill="currentColor"
                            d="M8 1c1.2 2.4 3.8 3.8 3.8 6.4A3.8 3.8 0 0 1 8 15a3.8 3.8 0 0 1-3.8-3.6C4.2 8.8 6.8 7.4 8 1z"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="mc__lat-path-name">{path}</span>
                  </div>
                  {blessTiers.map((tier) => {
                    if (tier.godTier) {
                      const god = alignments[tier.tier];
                      const lit = god === path;
                      return (
                        <div
                          key={`${path}-${tier.tier}`}
                          className={`mc__lat-cell is-god${lit ? " is-on" : ""}`}
                          role="img"
                          title={
                            lit
                              ? `God T${tier.tier}: ${path}`
                              : `God T${tier.tier} undecided`
                          }
                          aria-label={`${path}, god tier ${tier.tier}${lit ? ", active" : ", open"}`}
                        >
                          <span className="mc__lat-fill" aria-hidden />
                        </div>
                      );
                    }
                    const pickIndex = PATH_TIERS.indexOf(tier.tier);
                    if (pickIndex < 0) {
                      return (
                        <div
                          key={`${path}-${tier.tier}`}
                          className="mc__lat-cell"
                          aria-hidden
                        />
                      );
                    }
                    const locked = pickIndex > build.blessingPicks.length;
                    const selected = build.blessingPicks[pickIndex] === path;
                    return (
                      <button
                        key={`${path}-${tier.tier}`}
                        type="button"
                        disabled={locked}
                        aria-pressed={selected}
                        aria-label={`${path}, tier ${tier.tier}${selected ? ", selected" : locked ? ", locked" : ""}`}
                        className={`mc__lat-cell${selected ? " is-on" : ""}${locked ? " is-locked" : ""}`}
                        onClick={() => pickBlessing(tier.tier, path as BlessingPath)}
                      >
                        <span className="mc__lat-fill" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
