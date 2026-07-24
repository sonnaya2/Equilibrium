import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { Stat } from "@/components/Stat";

import blessings from "../../data/league/blessings.json";
import regions from "../../data/league/regions.json";
import relics from "../../data/league/relics.json";
import tasks from "../../data/league/tasks.json";

import abilities from "../../data/combat/abilities.json";
import effects from "../../data/combat/effects.json";
import equipment from "../../data/combat/equipment.json";
import perks from "../../data/combat/perks.json";
import prayers from "../../data/combat/prayers.json";

const LEAGUE = { Regions: regions, Relics: relics, Blessings: blessings, Tasks: tasks };
const COMBAT = { Abilities: abilities, Equipment: equipment, Prayers: prayers, Perks: perks, Effects: effects };

function Synced({ value }: { value: string | null }) {
  return <span className="num">{value ?? "never"}</span>;
}

export default function DataPage() {
  const leagueRecords = Object.values(LEAGUE).reduce((n, d) => n + d.records.length, 0);
  const combatRecords = Object.values(COMBAT).reduce((n, d) => n + d.records.length, 0);
  return (
    <Page>
      <PageHeading
        title="Data"
        note="Every dataset the tool ships, with its sync date and record count. Nothing is estimated."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <dl className="panel panel-body">
          <Stat label="League records" value={leagueRecords} hint="regions, relics, blessings, tasks" />
        </dl>
        <dl className="panel panel-body">
          <Stat label="Combat records" value={combatRecords} hint="abilities, gear, prayers, perks, effects" />
        </dl>
        <dl className="panel panel-body">
          <Stat label="Sources" value="4" hint="RuneScape Wiki, RS Analysis, PvME, Jagex" />
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel">
          <div className="panel-head">League data</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Records</th>
                <th>Verified</th>
                <th>Last synced</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(LEAGUE).map(([name, d]) => (
                <tr key={name}>
                  <td className="font-medium text-parch-50">{name}</td>
                  <td className="num">{d.records.length}</td>
                  <td>{d.verified ? "yes" : "no"}</td>
                  <td>
                    <Synced value={d.lastSynced} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head">Combat data</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Records</th>
                <th>Tracked since</th>
                <th>Last synced</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(COMBAT).map(([name, d]) => (
                <tr key={name}>
                  <td className="font-medium text-parch-50">{name}</td>
                  <td className="num">{d.records.length}</td>
                  <td className="num">{d.trackedSince}</td>
                  <td>
                    <Synced value={d.lastSynced} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Page>
  );
}
