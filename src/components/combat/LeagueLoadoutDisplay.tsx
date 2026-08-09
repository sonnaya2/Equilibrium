"use client";

import Link from "next/link";
import relicsData from "#shard/league/relics.json";
import { activeBlessings, PATH_TIERS, type BlessingChoice } from "@/league/blessings";
import type { BuildState, RegionId } from "@/league";
import { blessingIconPath, relicIconPath, regionCrestPath } from "@/lib/gameArt";
import { CombatFrame } from "./CombatFrame";
import { GameIcon } from "../GameIcon";

type RelicRecord = {
  tier: number | null;
  revealed: boolean;
  choices: readonly { name: string; effects?: readonly string[] }[];
};

const relicRecords = (relicsData.records as readonly RelicRecord[])
  .filter((record) => typeof record.tier === "number")
  .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));

function BlessingCard({ choice }: { choice?: BlessingChoice }) {
  return (
    <div className={`setup-league-blessing${choice ? " is-active" : " is-empty"}`}>
      <div className="setup-league-blessing__icon">
        {choice ? <GameIcon src={blessingIconPath(choice.name)} size={30} /> : <span>+</span>}
      </div>
      <div className="setup-league-blessing__copy">
        <span className="setup-league-blessing__tier">{choice ? `T${choice.tier}` : "NEXT"}</span>
        <strong>{choice?.name ?? "Choose a blessing"}</strong>
        <small>{choice?.effects[0] ?? "Open the build planner to set your path"}</small>
      </div>
      {choice ? <span className="setup-league-blessing__path">{choice.path}</span> : null}
    </div>
  );
}

export function LeagueLoadoutDisplay({
  build,
  regions,
}: {
  build: BuildState;
  regions: readonly RegionId[];
}) {
  const blessings = activeBlessings(build.blessingPicks);
  const selectedByTier = new Map(
    Object.entries(build.relics).map(([tier, name]) => [Number(tier), name]),
  );
  const relicSlots =
    relicRecords.length > 0
      ? relicRecords
      : Array.from({ length: 7 }, (_, i) => ({ tier: i + 1, revealed: true, choices: [] }));

  return (
    <CombatFrame className="setup-league-display" title="League loadout">
      <div className="setup-league-display__header">
        <div>
          <span className="combat-kicker">League loadout</span>
          <h2>Relics &amp; blessings</h2>
        </div>
        <div
          className="setup-league-display__regions"
          aria-label={`${regions.length} regions unlocked`}
        >
          {regions.map((region) => (
            <GameIcon key={region} src={regionCrestPath(region)} size={22} />
          ))}
          <span>{regions.length}/6 regions</span>
        </div>
        <Link className="setup-league-display__edit" href="/build">
          Edit build
        </Link>
      </div>
      <div className="setup-league-display__grid">
        <section aria-labelledby="league-relics-heading">
          <div className="setup-league-display__section-head">
            <h3 id="league-relics-heading">Relics</h3>
            <span>{selectedByTier.size} selected</span>
          </div>
          <div className="setup-league-relics">
            {relicSlots.map((record) => {
              const tier = record.tier ?? 0;
              const name = selectedByTier.get(tier);
              const effect = record.choices.find((choice) => choice.name === name)?.effects?.[0];
              return (
                <Link
                  key={tier}
                  href="/build"
                  className={`setup-league-relic${name ? " is-filled" : " is-empty"}`}
                >
                  <span className="setup-league-relic__icon">
                    {name ? <GameIcon src={relicIconPath(name)} size={34} /> : <span>R{tier}</span>}
                  </span>
                  <span className="setup-league-relic__copy">
                    <small>RELIC {tier}</small>
                    <strong>{name ?? "Open relic seat"}</strong>
                    <em>
                      {effect ??
                        (name
                          ? "Selected in build"
                          : record.revealed
                            ? "Choose a relic"
                            : "Locked")}
                    </em>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
        <section aria-labelledby="league-blessings-heading">
          <div className="setup-league-display__section-head">
            <h3 id="league-blessings-heading">Blessing path</h3>
            <span>
              {blessings.length}/{PATH_TIERS.length} active
            </span>
          </div>
          <div className="setup-league-blessings">
            {blessings.slice(0, 6).map((choice) => (
              <BlessingCard key={choice.id} choice={choice} />
            ))}
            {blessings.length < PATH_TIERS.length ? <BlessingCard /> : null}
          </div>
        </section>
      </div>
    </CombatFrame>
  );
}
