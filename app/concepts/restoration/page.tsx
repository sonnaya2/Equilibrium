import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { TEAMS, PASS_BAR, ROUND_COUNT } from "@/concepts/restoration/teams";
import { RestorationArena } from "@/concepts/restoration/RestorationArena";
import r3 from "@/concepts/restoration/r3/scores.json";

export const metadata: Metadata = {
  title: "Restoration tournament",
  description: "5 color skins · full interactive previews · CEO ranked.",
  robots: { index: false, follow: false },
};

const SCORE: Record<string, number | null> = Object.fromEntries(
  (r3.teams as { id: string; score: number }[]).map((t) => [t.id, t.score]),
);

export default function RestorationTournamentPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Restoration color skins"
        note="Five full interactive designs from the art-led tournament. Open any skin full-page, or compare in the tabbed arena below. Production currently uses Daylight tokens."
      />

      <p className="mb-4 text-sm text-parch-100">
        {ROUND_COUNT} rounds · pass bar{" "}
        <span className="font-mono text-gem-400">{PASS_BAR.toFixed(1)}</span>
        {" · "}
        provisional winner <span className="font-mono text-gem-300">Daylight 8.9</span>
        {" · "}
        <Link href="/concepts" className="text-gem-300 hover:underline">
          Concepts hub
        </Link>
        {" · "}
        <Link href="/" className="text-parch-300 hover:underline">
          Production site
        </Link>
      </p>

      {/* Big open links for every color skin */}
      <section className="panel mb-6">
        <div className="panel-head">Open full-page preview</div>
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
          {TEAMS.map((t) => {
            const score = SCORE[t.id];
            return (
              <Link
                key={t.id}
                href={`/concepts/restoration/${t.id}`}
                className="flex flex-col gap-2 border-b border-stone-750 p-4 transition-colors duration-150 hover:bg-stone-raised sm:border-r lg:border-b-0 last:border-r-0"
              >
                <span className="font-display text-sm uppercase tracking-[0.12em] text-gold-400">
                  {t.codename}
                </span>
                <span className="text-xs text-parch-300">{t.name}</span>
                <p className="text-sm leading-5 text-parch-100">{t.thesis}</p>
                <span className="mt-auto pt-2 text-xs text-gem-300">
                  Open full page →
                  {score != null ? (
                    <span className="ml-1 font-mono text-parch-100">· {score.toFixed(1)}</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">Quick links</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Skin</th>
              <th>Score (R3)</th>
              <th>Full page</th>
            </tr>
          </thead>
          <tbody>
            {TEAMS.map((t) => (
              <tr key={t.id}>
                <td className="text-parch-50">{t.codename}</td>
                <td className="num">{SCORE[t.id] != null ? SCORE[t.id]!.toFixed(1) : "—"}</td>
                <td>
                  <Link
                    href={`/concepts/restoration/${t.id}`}
                    className="text-gem-300 hover:underline"
                  >
                    /concepts/restoration/{t.id}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="mb-3 font-display text-sm uppercase tracking-[0.14em] text-gold-400">
        Tabbed arena (switch without leaving)
      </h2>
      <RestorationArena />
    </div>
  );
}
