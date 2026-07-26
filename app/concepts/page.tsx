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
import {
  AXIS_WEIGHTS,
  MAX_ROUNDS,
  TOURNAMENT,
  type ConceptRecord,
} from "@/concepts/tournament";

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
  "r2-parchment": <ParchmentLiftMock />,
  "r2-raised": <RaisedBenchMock />,
  "r2-wiki": <WikiDenseMock />,
  "r3-stage": <HybridStageMock />,
  "r3-ink": <HybridInkMock />,
  "r3-full": <HybridFullMock />,
};

const ROUND_LABELS: Record<number, string> = {
  1: "Shell",
  2: "Color / readability",
  3: "Hybrid",
  4: "Production lanes",
};

function statusClass(status: string): string {
  if (status === "winner") return "text-gem-300";
  if (status === "provisional") return "text-gold-400";
  if (status === "eliminated") return "text-parch-500";
  return "text-parch-200";
}

function groupByRound(concepts: ConceptRecord[]): { round: number; items: ConceptRecord[] }[] {
  const map = new Map<number, ConceptRecord[]>();
  for (const c of concepts) {
    const list = map.get(c.round) ?? [];
    list.push(c);
    map.set(c.round, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, items]) => ({ round, items }));
}

function ScoreboardTable({ items }: { items: ConceptRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Concept</th>
            <th>Agent</th>
            <th>Score</th>
            <th>Status</th>
            <th>Bias</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <a href={`#${c.id}`} className="text-parch-50 hover:text-gem-300">
                  {c.name}
                </a>
              </td>
              <td className="num">{c.agent}</td>
              <td className="num">{c.score != null ? c.score.toFixed(1) : "—"}</td>
              <td className={statusClass(c.status)}>{c.status}</td>
              <td className="max-w-md text-parch-300">{c.bias}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ConceptsLabPage() {
  const { concepts, currentRound, passBar, winnerId, layoutDnaId } = TOURNAMENT;
  const winner = winnerId ? concepts.find((c) => c.id === winnerId) : null;
  const layoutDna = concepts.find((c) => c.id === layoutDnaId);
  const byRound = groupByRound(concepts);
  const closest = [...concepts]
    .filter((c) => c.score != null && c.id !== layoutDnaId)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="GUI concepts lab"
        note="Design tournament only. Not in primary nav. Fixture rows are labeled fixtures — not published league numbers."
      />

      <div className="mb-4 flex flex-wrap items-baseline gap-4 text-sm">
        <p className="text-parch-300">
          Round <span className="font-mono text-parch-50">{currentRound}</span>
          {" · "}
          pass bar <span className="font-mono text-gem-400">{passBar.toFixed(1)}</span>
          {" · "}
          max {MAX_ROUNDS} rounds
          {" · "}
          winnerId <span className="font-mono text-parch-50">{winnerId ?? "null"}</span>
        </p>
        <Link
          href="/"
          className="text-parch-400 underline-offset-2 hover:text-parch-100 hover:underline"
        >
          Back to Overview
        </Link>
        <Link
          href="/sources"
          className="text-parch-400 underline-offset-2 hover:text-parch-100 hover:underline"
        >
          Sources
        </Link>
        <a
          href="https://github.com/sonnaya2/Equilibrium/blob/main/docs/gui-tournament-rubric.md"
          className="text-parch-400 underline-offset-2 hover:text-parch-100 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Rubric (docs/gui-tournament-rubric.md)
        </a>
      </div>

      <section className="panel mb-6 p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-parch-400">Tournament state</p>
        {winner ? (
          <>
            <h2 className="mt-1 font-display text-base uppercase tracking-[0.14em] text-gold-400">
              {winner.name}
            </h2>
            <p className="mt-1 text-sm text-parch-100">
              Score{" "}
              <span className="font-mono text-xl text-gem-400">{winner.score?.toFixed(1)}</span>
              /10 · agent {winner.agent}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-parch-100">
            No overall winner yet (nothing ≥ {passBar.toFixed(1)} after R1 shell). Closest color
            hybrid:{" "}
            {closest ? (
              <>
                <a href={`#${closest.id}`} className="text-parch-50 hover:text-gem-300">
                  {closest.name}
                </a>{" "}
                at{" "}
                <span className="font-mono text-gem-400">{closest.score?.toFixed(1)}</span>
              </>
            ) : (
              "—"
            )}
            .
          </p>
        )}
        {layoutDna ? (
          <p className="mt-2 text-sm text-parch-300">
            Layout DNA (R1):{" "}
            <a href={`#${layoutDna.id}`} className="text-parch-50 hover:text-gem-300">
              {layoutDna.name}
            </a>{" "}
            <span className="font-mono text-gem-400">{layoutDna.score?.toFixed(1)}</span> — tree ·
            table · inspector still binding.
          </p>
        ) : null}
        <p className="mt-2 text-sm text-parch-300">
          Production color ship after R3 CEO guidance landed in{" "}
          <span className="font-mono text-parch-100">app/globals.css</span> (@theme surface ladder,
          parch micro-bump, Wiki Dense <span className="font-mono">.data-table</span> law). R4 is
          production polish lanes (J/K/L), not another triple-mock contest — scores pending.
        </p>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">Scoreboard by round</div>
        <div className="space-y-6 p-3">
          {byRound.map(({ round, items }) => (
            <div key={round}>
              <h3 className="mb-2 text-xs uppercase tracking-[0.1em] text-parch-400">
                Round {round}
                {ROUND_LABELS[round] ? ` · ${ROUND_LABELS[round]}` : ""}
              </h3>
              <ScoreboardTable items={items} />
            </div>
          ))}
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
        {byRound.map(({ round, items }) => (
          <div key={`detail-${round}`} className="space-y-10">
            <h2 className="border-b border-stone-750 pb-2 font-display text-sm uppercase tracking-[0.14em] text-gold-400">
              Round {round}
              {ROUND_LABELS[round] ? ` · ${ROUND_LABELS[round]}` : ""}
            </h2>
            {items.map((c) => (
              <section key={c.id} id={c.id} className="scroll-mt-4">
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm uppercase tracking-[0.14em] text-gold-400">
                      {c.name}
                    </h3>
                    <p className="mt-1 text-sm text-parch-300">{c.summary}</p>
                    <p className="mt-1 text-xs text-parch-500">
                      Fixture mock · agent {c.agent} · id {c.id}
                    </p>
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

                {MOCKS[c.id] ?? (
                  <div className="border border-dashed border-stone-750 p-4 text-sm text-parch-400">
                    No interactive mock for this production lane. See notes under{" "}
                    <span className="font-mono text-parch-300">src/concepts/r4/</span>.
                  </div>
                )}

                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div className="panel p-3">
                    <h4 className="text-xs uppercase tracking-[0.08em] text-parch-400">Data tree</h4>
                    <ul className="mt-2 space-y-1 text-sm text-parch-100">
                      {c.dataTree.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="panel p-3 lg:col-span-2">
                    <h4 className="text-xs uppercase tracking-[0.08em] text-parch-400">Wireframes</h4>
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
                    <h4 className="text-xs uppercase tracking-[0.08em] text-parch-400">CEO notes</h4>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-parch-200">
                      {c.ceoNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {c.mustFix.length > 0 ? (
                  <div className="mt-3 border border-stone-750 p-3">
                    <h4 className="text-xs uppercase tracking-[0.08em] text-parch-400">Must-fix</h4>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-parch-200">
                      {c.mustFix.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-10 border-t border-stone-750 pt-4 text-xs text-parch-500">
        Tournament protocol: up to {MAX_ROUNDS} rounds. Pass bar {passBar.toFixed(1)}. R1 Control
        Surface remains layout DNA at 9.1. R2 max Raised Bench 8.4 · R3 max Hybrid Full 8.9 (0.1
        under). R4 ships Full DNA into production lanes — score when ready. Rubric:
        docs/gui-tournament-rubric.md.
      </p>
    </div>
  );
}
