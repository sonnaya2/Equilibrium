"use client";

/**
 * Build — modelled on official Leagues II: Equilibrium client menu
 * (Jagex news screenshots: relicmenu.jpg / blessing.jpg).
 * Tabs: Regions · Relics · Blessings · Share
 * Relics: left choice column + locked tier grid.
 * Blessings: Order/Chaos/Balance path cells.
 * T1 relic portraits from official countdown news (CC fan use / credit Jagex).
 */

import { useMemo, useState } from "react";
import {
  blessingResetsLeft,
  canSelectElective,
  type RegionId,
} from "@/league";
import {
  BLESSING_PATHS,
  godTierAlignments,
  PATH_TIERS,
  type BlessingPath,
} from "@/league/blessings";
import { buildShareUrl } from "@/league/share";
import { buildHasContent, useBuild } from "@/league/useBuild";
import "./build-game-menu.css";

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

const TABS = [
  { id: "regions", label: "Regions" },
  { id: "relics", label: "Relics" },
  { id: "blessings", label: "Blessings" },
  { id: "share", label: "Share" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Official countdown portraits (Jagex CDN, mirrored under public/game/relics). */
const RELIC_ART: Record<string, string> = {
  Survivalist: "/game/relics/survivalist.jpg",
  "Endless Harvest": "/game/relics/endless-harvest.jpg",
  "Golden Touch": "/game/relics/golden-touch.jpg",
};

const RELIC_MONO: Record<string, string> = {
  Survivalist: "SV",
  "Endless Harvest": "EH",
  "Golden Touch": "GT",
};

/** Passive XP line shown on client next to Tier 1 (from official menu). */
const TIER_PASSIVE: Record<number, string> = {
  1: "5 × XP",
  2: "—",
  3: "—",
  4: "—",
  5: "—",
  6: "—",
  7: "—",
};

function availabilityLabel(value: string): string {
  if (value === "automatic_early") return "milestone";
  if (value === "starting") return "start";
  return "elective";
}

function pathClass(path: string): string {
  if (path === "Chaos") return "build-game__path-chaos";
  if (path === "Balance") return "build-game__path-balance";
  if (path === "Order") return "build-game__path-order";
  return "";
}

export function BuildPlanner({
  regions,
  relicTiers,
  blessingTiers,
  resetCount,
}: {
  regions: PlannerRegion[];
  relicTiers: RelicTier[];
  blessingTiers: BlessingTier[];
  resetCount: number;
}) {
  const {
    build,
    loaded,
    toggleRegion,
    toggleRelic,
    pickBlessing,
    resetBlessings,
    clearElectives,
    resetBuild,
  } = useBuild();

  const [tab, setTab] = useState<TabId>("relics");
  const [focusRelicTier, setFocusRelicTier] = useState(1);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "ok" | "err">("idle");

  const picks = build.elective;
  const pickCounter = loaded ? `${picks.length}/3` : "…/3";
  const hasFullBuild = buildHasContent(build);
  const resetsLeft = blessingResetsLeft(build);
  const alignments = godTierAlignments(build.blessingPicks);

  const paths = useMemo(
    () => blessingTiers.find((t) => !t.godTier)?.paths ?? ["Order", "Balance", "Chaos"],
    [blessingTiers],
  );

  const focusTier =
    relicTiers.find((t) => t.tier === focusRelicTier) ?? relicTiers[0];
  const seatedName = focusTier ? build.relics[String(focusTier.tier)] ?? null : null;
  const seated =
    focusTier?.choices.find((c) => c.name === seatedName) ?? null;

  /** Locked grid slots: remaining choices on this tier + unrevealed higher tiers. */
  const lockedSlots = useMemo(() => {
    const slots: { key: string; label: string }[] = [];
    for (const tier of relicTiers) {
      if (tier.tier === focusRelicTier && tier.revealed) {
        // Filler empty cells like the client right pane (blurred hexes)
        for (let i = 0; i < 18; i++) {
          slots.push({ key: `t${tier.tier}-pad-${i}`, label: "" });
        }
      } else if (!tier.revealed || tier.choices.length === 0) {
        for (let i = 0; i < 3; i++) {
          slots.push({ key: `t${tier.tier}-lock-${i}`, label: `T${tier.tier}` });
        }
      }
    }
    return slots.slice(0, 24);
  }, [relicTiers, focusRelicTier]);

  const flashCopy = (next: "ok" | "err") => {
    setCopyFeedback(next);
    setTimeout(() => setCopyFeedback("idle"), 1500);
  };

  const copyShareLink = () => {
    if (!navigator.clipboard?.writeText) {
      flashCopy("err");
      return;
    }
    void navigator.clipboard
      .writeText(buildShareUrl(build))
      .then(() => flashCopy("ok"))
      .catch(() => flashCopy("err"));
  };

  const trackLit = Math.min(7, Object.keys(build.relics).length + (picks.length > 0 ? 1 : 0));

  return (
    <div className="build-game">
      <div className="build-game__frame">
        <header className="build-game__titlebar">
          <span className="build-game__logo" aria-hidden />
          <h1 className="build-game__title">Leagues II: Equilibrium</h1>
          <p className="build-game__title-meta" aria-live="polite">
            Picks <strong>{pickCounter}</strong>
            {seatedName ? (
              <>
                {" "}
                · <strong>{RELIC_MONO[seatedName] ?? seatedName}</strong>
              </>
            ) : null}
          </p>
        </header>

        <div className="build-game__tabs" role="tablist" aria-label="Build sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`build-game__tab${tab === t.id ? " is-on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="build-game__track">
          <span className="build-game__track-gem" aria-hidden />
          <span>
            {tab === "blessings"
              ? `Blessing path · ${build.blessingPicks.length || 0} chosen`
              : `League plan · ${Object.keys(build.relics).length} relics seated`}
          </span>
          <div className="build-game__track-bar" aria-hidden>
            <div
              className="build-game__track-fill"
              style={{ width: `${Math.min(100, (trackLit / 7) * 100)}%` }}
            />
          </div>
          <div className="build-game__track-pips" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={`build-game__track-pip${i < trackLit ? " is-lit" : ""}`}
              />
            ))}
          </div>
        </div>

        <div className="build-game__body">
          {/* ── Regions ───────────────────────────────────── */}
          {tab === "regions" ? (
            <div className="build-game__regions" aria-busy={!loaded}>
              <div className="build-game__tier-label">
                <strong>Region unlocks</strong>
                <span className="text-[12px] text-[color:var(--parch-dim)]">
                  2 start + Karamja · 3 electives
                </span>
                <button
                  type="button"
                  className="build-game__btn ml-auto"
                  disabled={!loaded || picks.length === 0}
                  onClick={clearElectives}
                >
                  Clear picks
                </button>
              </div>
              <div
                className={`build-game__region-grid${
                  loaded ? "" : " pointer-events-none opacity-60"
                }`}
              >
                {regions.map((region) => {
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
                      className={`build-game__region${isOn ? " is-on" : ""}${
                        pickBlocked ? " is-blocked" : ""
                      }`}
                      onClick={() => {
                        if (elective && loaded && selectable) {
                          toggleRegion(region.id as RegionId);
                        }
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/game/regions/${region.id}.png`}
                        alt=""
                        width={32}
                        height={36}
                      />
                      <span className="build-game__region-name">{region.name}</span>
                      <span className="build-game__region-meta">
                        {isOn
                          ? elective
                            ? "picked"
                            : availabilityLabel(region.availability)
                          : `${region.primaryQuests} quests`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* ── Relics (official menu layout) ─────────────── */}
          {tab === "relics" ? (
            <div className="build-game__relics">
              <div>
                <div className="build-game__tier-label">
                  <strong>Tier {focusTier?.tier ?? 1}</strong>
                  <span className="build-game__passive">
                    {TIER_PASSIVE[focusTier?.tier ?? 1] ?? "—"}
                  </span>
                </div>
                <div className="build-game__choice-col" role="listbox" aria-label="Relic choices">
                  {(focusTier?.revealed ? focusTier.choices : []).map((relic) => {
                    const on = build.relics[String(focusTier!.tier)] === relic.name;
                    const art = RELIC_ART[relic.name];
                    const mono = RELIC_MONO[relic.name] ?? "·";
                    return (
                      <button
                        key={relic.name}
                        type="button"
                        role="option"
                        aria-selected={on}
                        aria-pressed={on}
                        className={`build-game__choice${on ? " is-on" : ""}`}
                        onClick={() => toggleRelic(focusTier!.tier, relic.name)}
                      >
                        <span className="build-game__choice-icon" aria-hidden>
                          {art ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={art} alt="" />
                          ) : (
                            <span className="mono-fallback">{mono}</span>
                          )}
                        </span>
                        <span className="build-game__choice-name">{relic.name}</span>
                      </button>
                    );
                  })}
                  {(!focusTier?.revealed || focusTier.choices.length === 0) && (
                    <p className="text-xs text-[color:var(--parch-dim)] px-1">
                      Tier sealed until Jagex reveals choices.
                    </p>
                  )}
                </div>

                {/* Tier rail under choices */}
                <div
                  className="mt-2 flex flex-wrap gap-1"
                  role="tablist"
                  aria-label="Relic tiers"
                >
                  {relicTiers.map((tier) => {
                    const open = tier.revealed && tier.choices.length > 0;
                    const on = focusRelicTier === tier.tier;
                    return (
                      <button
                        key={tier.tier}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        className={`build-game__btn${on ? " build-game__btn--gem" : ""}`}
                        style={{ padding: "0.25rem 0.45rem", fontSize: "0.7rem" }}
                        onClick={() => setFocusRelicTier(tier.tier)}
                        title={open ? `Tier ${tier.tier}` : `Tier ${tier.tier} unrevealed`}
                      >
                        T{tier.tier}
                        {!open ? " ·" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="build-game__slot-grid" aria-label="Locked relic slots">
                  {lockedSlots.map((slot) => (
                    <div
                      key={slot.key}
                      className="build-game__slot is-locked"
                      title="Unrevealed"
                    >
                      <span className="build-game__slot-hex" aria-hidden />
                      {slot.label ? <span>{slot.label}</span> : null}
                    </div>
                  ))}
                </div>
                {seated ? (
                  <div className="build-game__detail">
                    <h3>{seated.name}</h3>
                    <ul>
                      {seated.effects.map((fx) => (
                        <li key={fx}>{fx}</li>
                      ))}
                    </ul>
                  </div>
                ) : focusTier?.revealed ? (
                  <div className="build-game__detail">
                    <h3>Select a relic</h3>
                    <p className="m-0 text-sm text-[color:var(--parch-dim)]">
                      Pick one Tier {focusTier.tier} choice on the left. Higher tiers stay
                      sealed until official reveal.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── Blessings (official path grid) ────────────── */}
          {tab === "blessings" ? (
            <div className="build-game__bless">
              <div className="build-game__bless-actions">
                <div className="build-game__tier-label" style={{ marginBottom: 0 }}>
                  <strong>Blessing paths</strong>
                  <span className="text-[12px] text-[color:var(--parch-dim)]">
                    Order · Chaos · Balance · God Tier at 4 &amp; 8
                  </span>
                </div>
                <button
                  type="button"
                  className="build-game__btn ml-auto"
                  disabled={resetsLeft === 0 || build.blessingPicks.length === 0}
                  onClick={resetBlessings}
                >
                  Reset ({resetsLeft}/{resetCount})
                </button>
              </div>

              <div className="build-game__bless-grid" role="grid" aria-label="Blessing lattice">
                <span className="build-game__bless-corner" />
                {blessingTiers.map((tier) => (
                  <span key={tier.tier} className="build-game__bless-colhead">
                    T{tier.tier}
                    {tier.godTier ? "★" : ""}
                  </span>
                ))}
                {paths.flatMap((path) => {
                  const label = (
                    <span
                      key={`${path}-label`}
                      className={`build-game__bless-path ${pathClass(path)}`}
                    >
                      {path}
                    </span>
                  );
                  const cells = blessingTiers.map((tier) => {
                    if (tier.godTier) {
                      const god = alignments[tier.tier];
                      const lit = god === path;
                      return (
                        <div
                          key={`${path}-${tier.tier}`}
                          className={`build-game__bless-cell is-god${lit ? " is-on" : " is-locked"}`}
                          title={
                            god
                              ? `God Tier ${tier.tier}: ${god}`
                              : `God Tier ${tier.tier} undecided`
                          }
                          aria-label={`Tier ${tier.tier} God ${path}${lit ? " active" : ""}`}
                        >
                          <span className="build-game__bless-dot" aria-hidden />
                        </div>
                      );
                    }
                    const pickIndex = PATH_TIERS.indexOf(tier.tier);
                    const validPath = (BLESSING_PATHS as readonly string[]).includes(path);
                    if (pickIndex < 0 || !validPath) {
                      return (
                        <div
                          key={`${path}-${tier.tier}`}
                          className="build-game__bless-cell is-locked"
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
                        aria-label={`Tier ${tier.tier} ${path}`}
                        className={`build-game__bless-cell${
                          locked ? " is-locked" : " is-open"
                        }${selected ? " is-on" : ""}`}
                        onClick={() => pickBlessing(tier.tier, path as BlessingPath)}
                      >
                        <span className="build-game__bless-dot" aria-hidden />
                      </button>
                    );
                  });
                  return [label, ...cells];
                })}
              </div>
              <p className="m-0 text-xs text-[color:var(--parch-dim)]">
                {blessingTiers.some((t) => t.revealed)
                  ? blessingTiers
                      .filter((t) => t.godTier)
                      .map((t) =>
                        alignments[t.tier]
                          ? `T${t.tier} ${alignments[t.tier]} God`
                          : `T${t.tier} God undecided`,
                      )
                      .join(" · ")
                  : "Blessing choices empty until Jagex publishes tier details — path picks still plan ahead."}
              </p>
            </div>
          ) : null}

          {/* ── Share ─────────────────────────────────────── */}
          {tab === "share" ? (
            <div className="flex flex-col gap-3 p-1">
              <div className="build-game__tier-label">
                <strong>Share plan</strong>
              </div>
              <p className="m-0 text-sm text-[color:var(--parch)]">
                Copy a link that restores regions, relics, and blessing path on another device.
              </p>
              <div className="build-game__footer" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
                <button type="button" className="build-game__btn build-game__btn--gem" onClick={copyShareLink}>
                  {copyFeedback === "ok"
                    ? "Copied"
                    : copyFeedback === "err"
                      ? "Copy failed"
                      : "Copy link"}
                </button>
                <button
                  type="button"
                  className="build-game__btn"
                  disabled={!loaded || picks.length === 0}
                  onClick={clearElectives}
                >
                  Clear picks
                </button>
                <button
                  type="button"
                  className="build-game__btn"
                  disabled={!loaded || !hasFullBuild}
                  onClick={resetBuild}
                >
                  Reset build
                </button>
              </div>
              <p className="m-0 font-mono text-xs text-[color:var(--parch-dim)]">
                {pickCounter}
                {seatedName ? ` · ${seatedName}` : ""}
                {build.blessingPicks.length
                  ? ` · ${build.blessingPicks.join(" → ")}`
                  : ""}
              </p>
            </div>
          ) : null}

          {/* Persistent actions on non-share tabs */}
          {tab !== "share" ? (
            <div className="build-game__footer">
              <button
                type="button"
                className="build-game__btn"
                disabled={!loaded || picks.length === 0}
                onClick={clearElectives}
              >
                Clear picks
              </button>
              <button
                type="button"
                className="build-game__btn build-game__btn--gem"
                onClick={copyShareLink}
              >
                {copyFeedback === "ok" ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <p className="build-game__credit">
        Layout modelled on the official Leagues II: Equilibrium client menu.{" "}
        <a
          href="https://secure.runescape.com/m=news/countdown-to-leagues-ii-equilibrium"
          target="_blank"
          rel="noreferrer"
        >
          Countdown blog
        </a>
        . T1 portraits from Jagex news art (fan tool, not affiliated).
      </p>
    </div>
  );
}
