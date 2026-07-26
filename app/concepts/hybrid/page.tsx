import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { HYBRID_PASS, HYBRID_RECIPE, HYBRID_TEAMS } from "@/concepts/hybrid/teams";
import { HybridArena } from "@/concepts/hybrid/HybridArena";

export const metadata: Metadata = {
  title: "Hybrid composition tournament",
  description: "5 teams execute the Editorial/Daylight/Crystal/Lattice recipe. CEO ranks.",
  robots: { index: false, follow: false },
};

export default function HybridTournamentPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Hybrid composition tournament"
        note="Recipe is fixed by product lead. Teams compete on execution. Pass bar 9.0. Hardass CEO ranks."
      />

      <p className="mb-4 text-sm text-parch-100">
        Pass bar <span className="font-mono text-gem-400">{HYBRID_PASS.toFixed(1)}</span>
        {" · "}
        <Link href="/concepts" className="text-gem-300 hover:underline">
          Concepts hub
        </Link>
        {" · "}
        <Link href="/concepts/restoration" className="text-parch-300 hover:underline">
          Restoration skins
        </Link>
      </p>

      <section className="panel mb-6">
        <div className="panel-head">Fixed recipe</div>
        <dl className="panel-body grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(HYBRID_RECIPE).map(([k, v]) => (
            <div key={k} className="flex gap-2 border-b border-stone-800 py-1">
              <dt className="w-24 shrink-0 capitalize text-parch-100">{k}</dt>
              <dd className="text-parch-50">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">Teams (2 agents each)</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Codename</th>
              <th>Agents</th>
              <th>Angle</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {HYBRID_TEAMS.map((t) => (
              <tr key={t.id}>
                <td className="text-parch-50">{t.name}</td>
                <td className="text-gem-300">{t.codename}</td>
                <td className="font-mono text-xs">{t.agents.join(" · ")}</td>
                <td className="text-parch-100">{t.angle}</td>
                <td>
                  <Link href={`/concepts/hybrid/${t.id}`} className="text-gem-300 hover:underline">
                    full page
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <HybridArena />
    </div>
  );
}
