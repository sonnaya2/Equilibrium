"use client";

/**
 * Production Build board — regions, all relic tiers, blessing lattice.
 * Live useBuild state is shared with Map.
 */

import Link from "next/link";
import { useState } from "react";
import { equipmentById } from "@/combat/data";
import type { EquipmentSlot } from "@/combat/data/records";
import { canSelectElective, ELECTIVE_CAP, type BuildState, type RegionId } from "@/league";
import { godTierAlignments, PATH_TIERS, type BlessingPath } from "@/league/blessings";
import { buildShareUrl } from "@/league/share";
import { useBuild } from "@/league/useBuild";
import { equipmentIconPath, regionCrestPath, styleIconPath } from "@/lib/gameArt";
import { GameIcon } from "@/components/GameIcon";
import { useLoadout } from "@/components/combat/useLoadout";
import "./build-board.css";

export type PlannerRegion = {
  id: string;
  name: string;
  availability: string;
  skills: string[];
  trainingCount: number;
  upgradeCount: number;
  hardRules: string[];
  primaryQuests: number;
  touchedQuests: number;
};

export type RelicChoice = {
  name: string;
  effects: string[];
  sourceUrl?: string;
  verified?: boolean;
};

export type RelicTier = {
  tier: number;
  revealed: boolean;
  verified?: boolean;
  sourceUrl?: string;
  choices: RelicChoice[];
};

export type BlessingTier = {
  tier: number;
  revealed: boolean;
  paths: string[];
  godTier: boolean;
  choices: unknown[];
  sourceUrl?: string;
  verified?: boolean;
};

const SEATS = ELECTIVE_CAP;

const STYLE_LABEL = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
} as const;

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  mainhand: "Main-hand",
  offhand: "Off-hand",
  twohand: "Two-hand",
  helmet: "Head",
  body: "Body",
  legs: "Legs",
  gloves: "Hands",
  boots: "Feet",
  cape: "Cape",
  amulet: "Neck",
  ring: "Ring",
  pocket: "Pocket",
  ammo: "Ammo",
};

const LOADOUT_DOLL: Array<EquipmentSlot | "style" | null> = [
  "cape",
  "helmet",
  "ammo",
  "mainhand",
  "amulet",
  "offhand",
  "gloves",
  "style",
  "boots",
  "twohand",
  "body",
  "pocket",
  "ring",
  "legs",
  null,
];

const RELIC_ICON: Record<string, string> = {
  Survivalist: "/game/relics/survivalist.webp",
  "Endless Harvest": "/game/relics/endless-harvest.webp",
  "Golden Touch": "/game/relics/golden-touch.webp",
};

const RELIC_MONO: Record<string, string> = {
  Survivalist: "SV",
  "Endless Harvest": "EH",
  "Golden Touch": "GT",
};

function availLabel(value: string): string {
  if (value === "automatic_early") return "early";
  if (value === "starting") return "start";
  if (value === "elective") return "pick";
  return value.replaceAll("_", " ");
}

function shortName(name: string): string {
  if (name.length <= 12) return name;
  const first = name.split(/\s+/)[0] ?? name;
  return first.length <= 11 ? first : `${first.slice(0, 10)}...`;
}

function relicIcon(name: string): string | undefined {
  return RELIC_ICON[name];
}

function relicMono(name: string): string {
  return RELIC_MONO[name] ?? "·";
}

function CharacterLoadout({
  build,
  regions,
  relicTierCount,
}: {
  build: BuildState;
  regions: PlannerRegion[];
  relicTierCount: number;
}) {
  const [loadout] = useLoadout();
  const equippedCount = LOADOUT_DOLL.reduce(
    (count, entry) => count + (entry && entry !== "style" && loadout.equipmentSlots[entry] ? 1 : 0),
    0,
  );
  const pickedRelics = Object.values(build.relics).filter(Boolean);
  const pickedRegions = build.elective
    .map((id) => regions.find((region) => region.id === id))
    .filter((region): region is PlannerRegion => Boolean(region));

  return (
    <aside className="build-board__zone build-board__loadout" aria-label="Final loadout">
      <div className="build-board__loadout-head">
        <h2 className="build-board__zone-title">Final loadout</h2>
        <Link href="/combat">Edit in Combat</Link>
      </div>

      <div className="build-board__loadout-style">
        <GameIcon src={styleIconPath(loadout.style)} size={34} />
        <div>
          <strong>{STYLE_LABEL[loadout.style]}</strong>
          <span>{equippedCount} / 13 gear slots</span>
        </div>
        <span className="build-board__loadout-tier">T{loadout.weaponTier}</span>
      </div>

      <div className="build-board__doll" aria-label={`${STYLE_LABEL[loadout.style]} equipment`}>
        {LOADOUT_DOLL.map((entry, index) => {
          if (entry === null) return <span key={`space-${index}`} aria-hidden />;
          if (entry === "style") {
            return (
              <span key="style" className="build-board__doll-core" aria-hidden>
                <GameIcon src={styleIconPath(loadout.style)} size={30} />
              </span>
            );
          }
          const id = loadout.equipmentSlots[entry];
          const item = equipmentById(id ?? "");
          const label = SLOT_LABEL[entry];
          return (
            <div
              key={entry}
              className={`build-board__doll-slot${item ? " is-filled" : ""}`}
              aria-label={`${label}: ${item?.name ?? "Empty"}`}
              title={item ? `${label}: ${item.name}` : `${label}: Empty`}
            >
              {item ? (
                <GameIcon src={equipmentIconPath(item.id)} size={30} />
              ) : (
                <span className="build-board__doll-empty" aria-hidden>
                  —
                </span>
              )}
              <small>{label}</small>
            </div>
          );
        })}
      </div>

      <div className="build-board__loadout-plan">
        <h3>League plan</h3>
        <div className="build-board__loadout-regions" aria-label="Elective regions">
          {Array.from({ length: ELECTIVE_CAP }, (_, index) => {
            const region = pickedRegions[index];
            return (
              <span
                key={region?.id ?? `empty-${index}`}
                className={region ? "is-filled" : ""}
                aria-label={region?.name ?? "Open region pick"}
                title={region?.name ?? "Open region pick"}
                style={
                  region ? { backgroundImage: `url(${regionCrestPath(region.id)})` } : undefined
                }
              />
            );
          })}
        </div>
        <dl>
          <div>
            <dt>Relics</dt>
            <dd>
              {pickedRelics.length} / {relicTierCount}
            </dd>
          </div>
          <div>
            <dt>Blessings</dt>
            <dd>
              {build.blessingPicks.length} / {PATH_TIERS.length}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

export function BuildPlanner({
  regions,
  relicTiers,
  blessingTiers,
}: {
  regions: PlannerRegion[];
  relicTiers: RelicTier[];
  blessingTiers: BlessingTier[];
}) {
  const { build, loaded, toggleRegion, toggleRelic, pickBlessing, clearElectives, resetBuild } =
    useBuild();

  const [copyFeedback, setCopyFeedback] = useState<"idle" | "ok" | "err">("idle");

  const picks = build.elective;
  const pickCounter = loaded ? `${picks.length}/${ELECTIVE_CAP}` : `…/${ELECTIVE_CAP}`;
  const alignments = godTierAlignments(build.blessingPicks);

  const flash = (next: "ok" | "err") => {
    setCopyFeedback(next);
    window.setTimeout(() => setCopyFeedback("idle"), 1400);
  };

  const copyShareLink = () => {
    if (!navigator.clipboard?.writeText) {
      flash("err");
      return;
    }
    void navigator.clipboard
      .writeText(buildShareUrl(build))
      .then(() => flash("ok"))
      .catch(() => flash("err"));
  };

  const copyLabel =
    copyFeedback === "ok" ? "Copied" : copyFeedback === "err" ? "Failed" : "Copy link";

  return (
    <div className="build-board">
      <div className="build-board__frame">
        {(["tl", "tr", "br", "bl"] as const).map((corner) => (
          <span key={corner} className={`build-board__corner is-${corner}`} aria-hidden />
        ))}
        <header className="build-board__seal">
          <h1 className="build-board__title">Build</h1>
          <span className="build-board__count" aria-live="polite">
            {pickCounter}
          </span>
          <span className="build-board__pips" aria-hidden>
            {Array.from({ length: ELECTIVE_CAP }, (_, i) => (
              <span key={i} className={`build-board__pip${i < picks.length ? " is-on" : ""}`} />
            ))}
          </span>
          <div className="build-board__actions">
            <button
              type="button"
              className="build-board__btn"
              // Elective count only (empty server snapshot) — same as RegionPicker.
              disabled={Boolean(picks.length === 0)}
              onClick={clearElectives}
            >
              Clear picks
            </button>
            <button
              type="button"
              className="build-board__btn build-board__btn--gem"
              disabled={Boolean(!loaded)}
              onClick={copyShareLink}
            >
              {copyLabel}
            </button>
            <button
              type="button"
              className="build-board__btn"
              disabled={Boolean(!loaded)}
              onClick={resetBuild}
            >
              Reset build
            </button>
          </div>
        </header>

        <section className="build-board__zone" aria-label="Regions">
          <h2 className="build-board__zone-title">Regions</h2>
          <div className="build-board__crests">
            {regions.map((region) => {
              const elective = region.availability === "elective";
              const selectable = elective && canSelectElective(build, region.id as RegionId);
              const blocked = elective && (!loaded || !selectable);
              const isOn = !elective || picks.includes(region.id as RegionId);
              const meta = availLabel(region.availability);
              const status = blocked ? "blocked" : isOn && elective ? "picked" : meta;
              const cls = [
                "build-board__crest",
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
                  aria-disabled={blocked ? true : undefined}
                  aria-label={`${region.name}, ${status}`}
                  onClick={() => {
                    if (elective && loaded && selectable) {
                      toggleRegion(region.id as RegionId);
                    }
                  }}
                >
                  <span
                    className="build-board__crest-art"
                    aria-hidden
                    style={{ backgroundImage: `url(${regionCrestPath(region.id)})` }}
                  />
                  <span className="build-board__crest-name" aria-hidden>
                    {region.name}
                  </span>
                  <span className="build-board__crest-meta" aria-hidden>
                    {meta}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="build-board__court">
          <div className="build-board__court-main">
            <section className="build-board__zone" aria-label="Relics">
              <h2 className="build-board__zone-title">Relics · hover for effects</h2>
              <div className="build-board__relics">
                {relicTiers.map((tier) => {
                  const open = tier.revealed && tier.choices.length > 0;
                  const seated = build.relics[String(tier.tier)] ?? null;
                  const choices = open ? tier.choices : [];
                  const seats = Array.from({ length: SEATS }, (_, i) => choices[i] ?? null);

                  return (
                    <div
                      key={tier.tier}
                      className={`build-board__tier${open ? "" : " is-sealed"}`}
                      role="group"
                      aria-label={`Tier ${tier.tier}${open ? "" : " sealed"}`}
                    >
                      <span className="build-board__tier-id" aria-hidden>
                        T{tier.tier}
                      </span>
                      <div
                        className="build-board__seats"
                        role="listbox"
                        aria-label={`Tier ${tier.tier} choices`}
                      >
                        {seats.map((relic, i) => {
                          if (!relic) {
                            return (
                              <span
                                key={`e-${tier.tier}-${i}`}
                                className="build-board__seat is-empty"
                                title={open ? undefined : "Sealed until reveal"}
                                aria-hidden
                              >
                                <span className="build-board__seat-plus" />
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
                              aria-label={relic.name}
                              className={`build-board__seat${on ? " is-on" : ""}`}
                              onClick={() => toggleRelic(tier.tier, relic.name)}
                            >
                              <span className="build-board__seat-emblem" aria-hidden>
                                {icon ? (
                                  <img
                                    src={icon}
                                    alt=""
                                    width={32}
                                    height={32}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <span className="build-board__seat-mono">{mono}</span>
                                )}
                              </span>
                              <span className="build-board__seat-name">
                                {shortName(relic.name)}
                              </span>
                              <span className="build-board__tip" role="tooltip">
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
                      <span className="build-board__tier-mark" aria-hidden />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="build-board__zone build-board__zone--bless" aria-label="Blessings">
              <h2 className="build-board__zone-title">Blessings</h2>
              <div className="build-board__bless-board">
                <div className="build-board__bless-scroll">
                  <div
                    className="build-board__lattice"
                    role="grid"
                    aria-label="Blessing path lattice"
                    style={{
                      gridTemplateColumns: `6.5rem repeat(${blessingTiers.length}, minmax(3.25rem, 1fr))`,
                    }}
                  >
                    <span className="build-board__lat-corner" aria-hidden />
                    {blessingTiers.map((t) => (
                      <span
                        key={t.tier}
                        className={`build-board__lat-head${t.godTier ? " is-god" : ""}`}
                      >
                        T{t.tier}
                        {t.godTier ? "?" : ""}
                      </span>
                    ))}

                    {(["Order", "Balance", "Chaos"] as const).map((path) => (
                      <div key={path} style={{ display: "contents" }}>
                        <div className={`build-board__lat-path is-${path.toLowerCase()}`}>
                          <span className="build-board__lat-ico" aria-hidden>
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
                          <span className="build-board__lat-path-name">{path}</span>
                        </div>
                        {blessingTiers.map((tier) => {
                          if (tier.godTier) {
                            const god = alignments[tier.tier];
                            const lit = god === path;
                            return (
                              <div
                                key={`${path}-${tier.tier}`}
                                className={`build-board__lat-cell is-god${lit ? " is-on" : ""}`}
                                role="img"
                                title={
                                  lit ? `God T${tier.tier}: ${path}` : `God T${tier.tier} undecided`
                                }
                                aria-label={`${path}, god tier ${tier.tier}${lit ? ", active" : ", open"}`}
                              >
                                <span className="build-board__lat-fill" aria-hidden />
                              </div>
                            );
                          }
                          const pickIndex = PATH_TIERS.indexOf(tier.tier);
                          if (pickIndex < 0) {
                            return (
                              <div
                                key={`${path}-${tier.tier}`}
                                className="build-board__lat-cell"
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
                              className={`build-board__lat-cell${selected ? " is-on" : ""}${locked ? " is-locked" : ""}`}
                              onClick={() => pickBlessing(tier.tier, path as BlessingPath)}
                            >
                              <span className="build-board__lat-fill" aria-hidden />
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <CharacterLoadout build={build} regions={regions} relicTierCount={relicTiers.length} />
        </div>
      </div>
    </div>
  );
}
