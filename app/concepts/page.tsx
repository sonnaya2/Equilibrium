import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { ControlSurfaceMock } from "@/concepts/ControlSurfaceMock";
import { LatticeBenchMock } from "@/concepts/LatticeBenchMock";
import { WarTableMock } from "@/concepts/WarTableMock";
import { AXIS_WEIGHTS, TOURNAMENT } from "@/concepts/tournament";

export const metadata: Metadata = {
  title: "GUI concepts lab",
  description:
    "Design tournament for the Equilibrium workbench shell. Lab only — not primary product navigation.",
  robots: { index: false, follow: false },
};

const MOCKS: Record<string, ReactNode> = {
  "r1-lattice": <LatticeBenchMock />,
  "r1-wartable": <WarTableMock />,
  "r1-control": <ControlSurfaceMock />,
};

function statusClass(status: string): string {
  if (status === "winner") return "text-gem-300";
  if (status === "provisional") return "text-gold-400";
  if (status === "eliminated") return "text-parch-500";
  return "text-parch-200";
}

export default function ConceptsLabPage() {
  const { concepts, currentRound, passBar, winnerId } = TOURNAMENT;
  const winner = concepts.find((c) => c.id === winnerId);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="GUI concepts lab"
        note="Design tournament only. Not in primary nav. Fixture rows are labeled fixtures — not published league numbers. Rubric: docs/gui-tournament-rubric.md."
      />

      <div className="mb-4 flex flex-wrap items-baseline gap-4 text-sm">
        <p className="text-parch-300">
          Round <span className="font-mono text-parch-50">{currentRound}</span>
          {" · "}
          pass bar <span className="font-mono text-gem-400">{passBar.toFixed(1)}</span>
          {" · "}
          max 5 rounds
        </p>
        <Link href="/" className="text-parch-400 underline-offset-2 hover:text-parch-100 hover:underline">
          Back to Overview
        </Link>
        <Link
          href="/sources"
          className="text-parch-400 underline-offset-2 hover:text-parch-100 hover:underline"
        >
          Sources
        </Link>
      </div>

      {winner ? (
        <section className="panel mb-6 p-4">
          <p className="text-xs uppercase tracking-[0.1em] text-parch-400">Winner · round 1</p>
          <h2 className="mt-1 font-display text-base uppercase tracking-[0.14em] text-gold-400">
            {winner.name}
          </h2>
          <p className="mt-1 text-sm text-parch-100">
            Score{" "}
            <span className="font-mono text-xl text-gem-400">{winner.score?.toFixed(1)}</span>
            /10 · agent {winner.agent} · ship Control Surface shell into production with crests
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-parch-300">
            {winner.mustFix.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel mb-6">
        <div className="panel-head">Scoreboard</div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Concept</th>
                <th>Agent</th>
                <th>Round</th>
                <th>Score</th>
                <th>Status</th>
                <th>Bias</th>
              </tr>
            </thead>
            <tbody>
              {concepts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`#${c.id}`} className="text-parch-50 hover:text-gem-300">
                      {c.name}
                    </a>
                  </td>
                  <td className="num">{c.agent}</td>
                  <td className="num">{c.round}</td>
                  <td className="num">{c.score != null ? c.score.toFixed(1) : "—"}</td>
                  <td className={statusClass(c.status)}>{c.status}</td>
                  <td className="max-w-md text-parch-300">{c.bias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">Rubric weights</div>
        <ul className="panel-body grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(AXIS_WEIGHTS).map(([key, weight]) => (
            <li key={key} className="flex justify-between gap-2 border-b border-stone-800 py-1">
              <span className="text-parch-300">{key}</span>
              <span className="font-mono text-parch-50">{weight}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-10">
        {concepts.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-4">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-sm uppercase tracking-[0.14em] text-gold-400">
                  {c.name}
                </h2>
                <p className="mt-1 text-sm text-parch-300">{c.summary}</p>
              </div>
              <p className="font-mono text-sm">
                <span className={statusClass(c.status)}>{c.status}</span>
                {" · "}
                {c.score != null ? (
                  <span className="text-gem-400">{c.score.toFixed(1)}</span>
                ) : (
                  "unscored"
                )}
              </p>
            </header>

            {MOCKS[c.id]}

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="panel p-3">
                <h3 className="text-xs uppercase tracking-[0.08em] text-parch-400">Data tree</h3>
                <ul className="mt-2 space-y-1 text-sm text-parch-100">
                  {c.dataTree.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="panel p-3 lg:col-span-2">
                <h3 className="text-xs uppercase tracking-[0.08em] text-parch-400">Wireframes</h3>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-5 text-parch-300">
                  {c.wireframes}
                </pre>
              </div>
            </div>

            {c.axes ? (
              <div className="panel mt-3 overflow-x-auto">
                <div className="panel-head">Axis scores (points of weight)</div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fill /20</th>
                      <th>Cats /20</th>
                      <th>Read /15</th>
                      <th>ID /15</th>
                      <th>Slop /15</th>
                      <th>Ops /10</th>
                      <th>Cons /5</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="num">{c.axes.workbenchFill}</td>
                      <td className="num">{c.axes.categorization}</td>
                      <td className="num">{c.axes.readability}</td>
                      <td className="num">{c.axes.gameIdentity}</td>
                      <td className="num">{c.axes.antiSlop}</td>
                      <td className="num">{c.axes.operability}</td>
                      <td className="num">{c.axes.consistency}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {c.ceoNotes.length > 0 ? (
              <div className="mt-3 border border-stone-750 p-3">
                <h3 className="text-xs uppercase tracking-[0.08em] text-parch-400">CEO notes</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-parch-200">
                  {c.ceoNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-stone-750 pt-4 text-xs text-parch-500">
        Tournament protocol: 3 rounds default, bump to 5 if no concept hits {passBar}. Round 1
        winner is Control Surface at 9.1 — implement production shell next.
      </p>
    </div>
  );
}
