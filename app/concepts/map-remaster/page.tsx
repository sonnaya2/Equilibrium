import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { MapRemasterArena } from "@/concepts/map-remaster/MapRemasterArena";
import scores from "@/concepts/map-remaster/r1/scores.json";
import {
  MAP_REMASTER_PASS,
  MAP_REMASTER_RECIPE,
  MAP_REMASTER_TEAMS,
  type MapRemasterTeamId,
} from "@/concepts/map-remaster/teams";

export const metadata: Metadata = {
  title: "Map remaster tournament",
  description:
    "Five teams compete on Daylit Reliquary, Crystal Frontier, Cartographer, Deep Board Sky, and Raised Court map overhauls.",
  robots: { index: false, follow: false },
};

export default function MapRemasterTournamentPage() {
  // Quality champion is Daylit Reliquary (R4 materials/vines pass), not R1 CSS scores.
  const championId = "daylit" as MapRemasterTeamId;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Map remaster tournament"
        note="R2: all five skins run on real WebGPU landmasses (production REGION_SHAPES). CSS mocks retired."
      />

      <p className="mb-4 text-sm text-parch-100">
        Pass bar <span className="font-mono text-gem-400">{MAP_REMASTER_PASS.toFixed(1)}</span>
        {" · R1 CSS champion "}
        <span className="font-mono text-gem-300">{scores.champion}</span>
        {" · now "}
        <span className="text-gem-300">shared Three/WebGPU board + skins</span>
        {" · "}
        <Link href="/concepts" className="text-gem-300 hover:underline">
          Concepts hub
        </Link>
        {" · "}
        <Link href="/map" className="text-parch-300 hover:underline">
          Production /map
        </Link>
      </p>

      <section className="panel mb-6">
        <div className="panel-head">Fixed recipe</div>
        <dl className="panel-body grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(MAP_REMASTER_RECIPE).map(([k, v]) => (
            <div key={k} className="flex gap-2 border-b border-stone-800 py-1">
              <dt className="w-24 shrink-0 capitalize text-parch-100">{k}</dt>
              <dd className="text-parch-50">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">R1 scores · pass bar {MAP_REMASTER_PASS.toFixed(1)}</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Mean</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {scores.teams.map((t) => (
              <tr key={t.id}>
                <td className="num">{t.rank}</td>
                <td className="text-parch-50">
                  {t.codename}
                  {t.id === scores.champion ? (
                    <span className="ml-2 text-xs text-gem-300">champion</span>
                  ) : null}
                </td>
                <td className="num font-mono text-parch-50">{t.mean.toFixed(2)}</td>
                <td>
                  <Link
                    href={`/concepts/map-remaster/${t.id}`}
                    className="text-gem-300 hover:underline"
                  >
                    full page
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="panel-body text-sm text-parch-100">{scores.productionRecommendation}</p>
        <p className="px-3 pb-3 text-xs text-parch-400">
          Full write-up:{" "}
          <code className="font-mono text-parch-100">src/concepts/map-remaster/r1/ceo-verdict.md</code>
        </p>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">Teams (2 agents each)</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Codename</th>
              <th>Agents</th>
              <th>Thesis</th>
            </tr>
          </thead>
          <tbody>
            {MAP_REMASTER_TEAMS.map((t) => (
              <tr key={t.id}>
                <td className="text-parch-50">{t.name}</td>
                <td className="text-gem-300">{t.codename}</td>
                <td className="font-mono text-xs">{t.agents.join(" · ")}</td>
                <td className="text-parch-100">{t.thesis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <MapRemasterArena initialTeam={championId} />
    </div>
  );
}
