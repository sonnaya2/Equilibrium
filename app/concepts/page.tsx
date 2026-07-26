import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { ControlSurfaceMock } from "@/concepts/ControlSurfaceMock";
import { LatticeBenchMock } from "@/concepts/LatticeBenchMock";
import { WarTableMock } from "@/concepts/WarTableMock";
import { ParchmentLiftMock } from "@/concepts/r2/ParchmentLiftMock";
import { RaisedBenchMock } from "@/concepts/r2/RaisedBenchMock";
import { WikiDenseMock } from "@/concepts/r2/WikiDenseMock";
import { HybridFullMock } from "@/concepts/r3/HybridFullMock";
import { HybridInkMock } from "@/concepts/r3/HybridInkMock";
import { HybridStageMock } from "@/concepts/r3/HybridStageMock";
import { LIVE_CONCEPTS } from "@/concepts/skins/registry";
import { TEAMS } from "@/concepts/restoration/teams";
import { MAX_ROUNDS, TOURNAMENT } from "@/concepts/tournament";

export const metadata: Metadata = {
  title: "GUI concepts lab",
  description: "Hands-on layout + color concepts with real data, plus fixture previews.",
  robots: { index: false, follow: false },
};

const RESTORATION_COLORS = TEAMS.map((t) => ({
  id: t.id,
  label: t.codename,
  thesis: t.thesis,
  href: `/concepts/restoration/${t.id}`,
}));

const FIXTURE_MOCKS: { id: string; name: string; node: ReactNode }[] = [
  { id: "r1-lattice", name: "Lattice Bench (fixture mock)", node: <LatticeBenchMock /> },
  { id: "r1-wartable", name: "War Table (fixture mock)", node: <WarTableMock /> },
  { id: "r1-control", name: "Control Surface (fixture mock)", node: <ControlSurfaceMock /> },
  { id: "r2-parchment", name: "Parchment Lift R2", node: <ParchmentLiftMock /> },
  { id: "r2-raised", name: "Raised Bench R2", node: <RaisedBenchMock /> },
  { id: "r2-wiki", name: "Wiki Dense R2", node: <WikiDenseMock /> },
  { id: "r3-stage", name: "Hybrid Stage R3", node: <HybridStageMock /> },
  { id: "r3-ink", name: "Hybrid Ink R3", node: <HybridInkMock /> },
  { id: "r3-full", name: "Hybrid Full R3", node: <HybridFullMock /> },
];

export default function ConceptsLabPage() {
  const layouts = LIVE_CONCEPTS.filter((c) => c.kind === "layout");
  const colors = LIVE_CONCEPTS.filter((c) => c.kind === "color");

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="GUI concepts lab"
        note="Live mini-apps use real catalog/build/tasks. Fixture mocks below are the original R1–R3 interactive previews."
      />

      <p className="mb-6 flex flex-wrap gap-4 text-sm text-parch-100">
        <span>
          Tournament round{" "}
          <span className="font-mono text-parch-50">{TOURNAMENT.currentRound}</span> · max{" "}
          {MAX_ROUNDS}
        </span>
        <Link href="/concepts/tasks-density" className="text-gem-300 hover:underline">
          Tasks density tournament →
        </Link>
        <Link href="/concepts/hybrid" className="text-gem-300 hover:underline">
          Hybrid tournament →
        </Link>
        <Link href="/concepts/build-showcase" className="text-gem-300 hover:underline">
          Build Showcase →
        </Link>
        <Link href="/concepts/restoration" className="text-parch-300 hover:underline">
          Restoration skins →
        </Link>
        <Link href="/" className="text-parch-300 hover:underline">
          Overview
        </Link>
      </p>

      {/* RESTORATION COLOR SKINS — full interactive previews */}
      <section className="panel mb-6">
        <div className="panel-head">
          Restoration color skins · full interactive previews (Daylight · Stone UI · Cinematic ·
          Crystal · Editorial)
        </div>
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
          {RESTORATION_COLORS.map((c) => (
            <Link
              key={c.id}
              href={c.href}
              className="flex flex-col gap-2 border-b border-stone-750 p-4 transition-colors duration-150 hover:bg-stone-raised sm:border-r lg:border-b-0 last:border-r-0"
            >
              <span className="font-display text-sm uppercase tracking-[0.12em] text-gold-400">
                {c.label}
              </span>
              <p className="text-sm leading-5 text-parch-100">{c.thesis}</p>
              <span className="mt-auto pt-2 text-xs text-gem-300">Open full page →</span>
            </Link>
          ))}
        </div>
        <p className="border-t border-stone-750 px-4 py-2 text-xs text-parch-300">
          Tabbed compare:{" "}
          <Link href="/concepts/restoration" className="text-gem-300 hover:underline">
            /concepts/restoration
          </Link>
          {" · "}
          Production site uses Daylight tokens (provisional 8.9).
        </p>
      </section>

      {/* LIVE LAYOUTS */}
      <section className="panel mb-6">
        <div className="panel-head">Live layouts · real data · click Open Data</div>
        <div className="grid gap-0 sm:grid-cols-3">
          {layouts.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-2 border-b border-stone-750 p-4 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <span className="font-display text-sm uppercase tracking-[0.12em] text-gold-400">
                {c.label}
              </span>
              <p className="text-sm leading-5 text-parch-100">{c.thesis}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2 text-xs">
                <Link
                  href={`/concepts/${c.id}/data`}
                  className="border border-gem-600 bg-stone-850 px-2.5 py-1 text-gem-300 hover:border-gem-400"
                >
                  Open Data
                </Link>
                <Link
                  href={`/concepts/${c.id}/build`}
                  className="border border-stone-750 px-2.5 py-1 text-parch-100 hover:border-stone-carve"
                >
                  Build
                </Link>
                <Link
                  href={`/concepts/${c.id}/tasks`}
                  className="border border-stone-750 px-2.5 py-1 text-parch-100 hover:border-stone-carve"
                >
                  Tasks
                </Link>
                <Link
                  href={`/concepts/${c.id}`}
                  className="border border-stone-750 px-2.5 py-1 text-parch-300 hover:border-stone-carve"
                >
                  Home
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE COLORS */}
      <section className="panel mb-6">
        <div className="panel-head">Live color skins · same tabs shell · real data</div>
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          {colors.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-2 border-b border-stone-750 p-4 sm:border-r lg:border-b-0 lg:last:border-r-0"
            >
              <span className="font-display text-sm uppercase tracking-[0.12em] text-gold-400">
                {c.label}
              </span>
              <p className="text-sm text-parch-100">{c.thesis}</p>
              <Link
                href={`/concepts/${c.id}/data`}
                className="mt-auto pt-2 text-xs text-gem-300 hover:underline"
              >
                Open Data →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Quick link table */}
      <section className="panel mb-8 overflow-x-auto">
        <div className="panel-head">All live routes</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Concept</th>
              <th>Kind</th>
              <th>Home</th>
              <th>Data</th>
              <th>Build</th>
              <th>Tasks</th>
            </tr>
          </thead>
          <tbody>
            {LIVE_CONCEPTS.map((c) => (
              <tr key={c.id}>
                <td className="text-parch-50">{c.label}</td>
                <td className="secondary">{c.kind}</td>
                <td>
                  <Link href={`/concepts/${c.id}`} className="text-gem-300 hover:underline">
                    open
                  </Link>
                </td>
                <td>
                  <Link href={`/concepts/${c.id}/data`} className="text-gem-300 hover:underline">
                    open
                  </Link>
                </td>
                <td>
                  <Link href={`/concepts/${c.id}/build`} className="text-gem-300 hover:underline">
                    open
                  </Link>
                </td>
                <td>
                  <Link href={`/concepts/${c.id}/tasks`} className="text-gem-300 hover:underline">
                    open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* FIXTURE PREVIEWS — always visible, not buried in details */}
      <h2 className="mb-4 font-display text-sm uppercase tracking-[0.14em] text-gold-400">
        Fixture previews (R1–R3 interactive mocks)
      </h2>
      <p className="mb-6 text-sm text-parch-100">
        These are the original tournament mocks with fixture rows. For real data, use Live layouts
        above.
      </p>

      <div className="space-y-10">
        {FIXTURE_MOCKS.map((m) => (
          <section key={m.id} id={m.id} className="scroll-mt-4">
            <h3 className="mb-2 text-sm font-medium text-parch-50">{m.name}</h3>
            {m.node}
          </section>
        ))}
      </div>
    </div>
  );
}
