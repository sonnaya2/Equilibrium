import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import {
  TASKS_DENSITY_PASS,
  TASKS_DENSITY_TEAMS,
} from "@/concepts/tasks-density/teams";

export const metadata: Metadata = {
  title: "Tasks density tournament",
  description: "Four topology bets to kill dead space on /tasks. Harsh CEO. Pass bar 9.0.",
  robots: { index: false, follow: false },
};

export default function TasksDensityArenaPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Tasks density tournament"
        note="Crystal × Data DNA fixed. Topology competes. Kill dead space. Pass bar 9.0 — hardass CEO."
      />

      <p className="mb-4 text-sm text-parch-100">
        Pass bar <span className="font-mono text-gem-400">{TASKS_DENSITY_PASS.toFixed(1)}</span>
        {" · "}
        <Link href="/concepts" className="text-gem-300 hover:underline">
          Concepts hub
        </Link>
        {" · "}
        <Link href="/tasks" className="text-parch-300 hover:underline">
          Production /tasks
        </Link>
      </p>

      <section className="panel mb-6">
        <div className="panel-head">Fixed recipe</div>
        <ul className="panel-body list-inside list-disc space-y-1 text-sm text-parch-100">
          <li>Editorial tokens · gem interactive · gold display only</li>
          <li>Feature parity: My build, region, tier, search, progress, Comp% wiki, virtualization</li>
          <li>Real Catalyst data via loadConceptTasks — no invented rows</li>
          <li>Density floors: ≥14px names, ≥70% content at 1440p, no 40px voids</li>
        </ul>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">R1 teams</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Codename</th>
              <th>Thesis</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {TASKS_DENSITY_TEAMS.map((t) => (
              <tr key={t.id}>
                <td className="text-parch-50">{t.name}</td>
                <td className="text-gem-300">{t.codename}</td>
                <td className="text-parch-100">{t.thesis}</td>
                <td>
                  <Link
                    href={`/concepts/tasks-density/${t.id}`}
                    className="text-gem-300 hover:underline"
                  >
                    full page
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">R2 Composite</div>
        <div className="panel-body text-sm text-parch-100">
          R1: no winner (Ledger 8.8).{" "}
          <Link href="/concepts/tasks-density/composite" className="text-gem-300 hover:underline">
            Open R2 composite
          </Link>
          {" · "}
          <Link
            href="/concepts"
            className="text-parch-300 hover:underline"
          >
            Concepts hub
          </Link>
        </div>
      </section>

      <p className="text-xs text-parch-300">
        R1 verdict:{" "}
        <code className="font-mono text-parch-100">src/concepts/tasks-density/r1/ceo-verdict.md</code>
      </p>
    </div>
  );
}
