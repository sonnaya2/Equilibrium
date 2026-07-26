"use client";

/**
 * R3-A Court Rail — tier rail · court stage · region hive · lattice belt.
 * Topology distinct from R2 war-table / dossier / herald.
 */

import { useState } from "react";
import type { RegionId } from "@/league";
import type { BlessingPath } from "@/league/blessings";
import {
  relicPortrait,
  SHOWCASE_RELIC_TIERS,
} from "./showcaseData";
import {
  BlessingLattice,
  Mast,
  RegionHive,
} from "./R3Shared";
import { RelicStagePanel } from "./RelicStagePanel";
import { useShowcaseActions } from "./useShowcaseActions";
import "./r3-build.css";

export function CourtRail() {
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

  const [focusTier, setFocusTier] = useState(1);
  const picks = build.elective;
  const pickCounter = loaded ? `${picks.length}/3` : "…/3";

  const tier =
    SHOWCASE_RELIC_TIERS.find((t) => t.tier === focusTier) ?? SHOWCASE_RELIC_TIERS[0];
  const seatedName = tier ? (build.relics[String(tier.tier)] ?? null) : null;
  const seated = tier?.choices.find((c) => c.name === seatedName) ?? null;
  const splash = relicPortrait(seatedName);

  return (
    <div className="r3-build">
      <Mast
        title="Court Rail"
        pickCounter={pickCounter}
        loaded={loaded}
        picksLen={picks.length}
        onClear={clearElectives}
        onCopy={copyShareLink}
        copyLabel={copyLabel}
        onReset={resetBuild}
      />

      <div className="r3-court">
        <aside className="r3-court__rail" aria-label="Relic tiers">
          <p className="r3-label">Tiers</p>
          {SHOWCASE_RELIC_TIERS.map((t) => {
            const open = t.revealed && t.choices.length > 0;
            const seatedHere = build.relics[String(t.tier)];
            return (
              <button
                key={t.tier}
                type="button"
                className={`r3-tier${focusTier === t.tier ? " is-on" : ""}${
                  open ? "" : " is-sealed"
                }`}
                aria-pressed={focusTier === t.tier}
                onClick={() => setFocusTier(t.tier)}
                title={open ? `Tier ${t.tier}` : `Tier ${t.tier} sealed`}
              >
                T{t.tier}
                {seatedHere ? ` · ${seatedHere.slice(0, 2)}` : open ? "" : " ·"}
              </button>
            );
          })}
          {splash ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="r3-splash" src={splash} alt="" />
          ) : null}
        </aside>

        {/* Stage via shared RelicStagePanel — splash stays on the tier rail. */}
        <RelicStagePanel
          tier={tier?.tier ?? 1}
          revealed={Boolean(tier?.revealed)}
          choices={tier?.revealed ? tier.choices : []}
          seatedName={seatedName}
          seatedEffects={seated?.effects ?? []}
          onPick={(name) => {
            if (tier) toggleRelic(tier.tier, name);
          }}
        />

        <aside className="r3-court__hive" aria-label="Regions">
          <p className="r3-label" style={{ gridColumn: "1 / -1" }}>
            Regions
          </p>
          <RegionHive
            build={build}
            loaded={loaded}
            onToggle={(id: RegionId) => toggleRegion(id)}
            className="contents"
          />
        </aside>

        <section className="r3-court__lattice" aria-label="Blessings">
          <p className="r3-label">Blessings · Order · Chaos · Balance · God 4 &amp; 8</p>
          <BlessingLattice
            build={build}
            compact
            onPick={(tierN, path: BlessingPath) => pickBlessing(tierN, path)}
          />
        </section>
      </div>
    </div>
  );
}
