import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import {
  GALLERY_WAR_PASS,
  GALLERY_WAR_PRIZE,
  GALLERY_WAR_TEAMS,
  type GalleryWarId,
} from "@/concepts/tasks-density/gallery-war/teams";

export const metadata: Metadata = {
  title: "Gallery War",
  description: "10 agents · 3 rounds · PM executes failure · pass 9.2 · prize production /tasks",
  robots: { index: false, follow: false },
};

/** R2 hardcode from `r2/scores.json` — PM kill-order after CEO scores. Finalists only. */
const R2_ALIVE: { id: GalleryWarId; total: number; rank: number }[] = [
  { id: "cipher", total: 9.13, rank: 1 },
  { id: "sigil", total: 9.09, rank: 2 },
];

/** R2 kills first, then R1 dead (no soft-revive). Rank = last known field rank. */
const R2_DEAD: { id: GalleryWarId; total: number; rank: number }[] = [
  { id: "quill", total: 9.05, rank: 3 },
  { id: "grove", total: 8.99, rank: 4 },
  { id: "crucible", total: 8.9, rank: 5 },
  { id: "ash", total: 8.72, rank: 6 },
  { id: "oracle", total: 8.67, rank: 7 },
  { id: "ember", total: 8.62, rank: 8 },
  { id: "bastion", total: 8.57, rank: 9 },
  { id: "vault", total: 8.38, rank: 10 },
];

const teamById = Object.fromEntries(GALLERY_WAR_TEAMS.map((t) => [t.id, t])) as Record<
  GalleryWarId,
  (typeof GALLERY_WAR_TEAMS)[number]
>;

function FighterTable({
  rows,
  dead,
}: {
  rows: { id: GalleryWarId; total: number; rank: number }[];
  dead?: boolean;
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>ID</th>
          <th>Codename</th>
          <th>Σ</th>
          <th>Thesis</th>
          <th>Open</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const t = teamById[r.id];
          return (
            <tr key={r.id} className={dead ? "opacity-60" : undefined}>
              <td className="font-mono text-parch-50">{r.rank}</td>
              <td className="font-mono text-parch-50">{r.id}</td>
              <td className={dead ? "text-parch-300" : "text-gem-300"}>{t.codename}</td>
              <td className="font-mono text-parch-50">{r.total.toFixed(2)}</td>
              <td className="text-parch-100">{t.thesis}</td>
              <td>
                <Link
                  href={`/concepts/tasks-density/gallery-war/${r.id}`}
                  className="text-gem-300 hover:underline"
                >
                  {dead ? "archive" : "fight"}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function GalleryWarArenaPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Gallery War"
        note="Gallery Board deathmatch. Humanizer + frontend craft. Pass bar 9.2. PM kills losers. Winners live on /tasks."
      />

      <p className="mb-4 text-sm text-parch-100">
        Pass <span className="font-mono text-gem-400">{GALLERY_WAR_PASS.toFixed(1)}</span>
        {" · prize "}
        <span className="text-parch-50">{GALLERY_WAR_PRIZE}</span>
        {" · R2 complete · 2 finalists / 8 dead · promote "}
        <span className="font-mono text-parch-50">false</span>
        {" · "}
        <Link href="/concepts/tasks-density" className="text-gem-300 hover:underline">
          Density arena
        </Link>
        {" · "}
        <Link href="/tasks" className="text-parch-300 hover:underline">
          Production
        </Link>
      </p>

      <section className="panel mb-6">
        <div className="panel-head">
          Alive — R3 finals ({R2_ALIVE.length})
          <span className="ml-2 font-mono text-xs font-normal text-gem-400">
            cipher leads 9.13 · neither ≥ 9.2
          </span>
        </div>
        <FighterTable rows={R2_ALIVE} />
      </section>

      <section className="panel mb-6">
        <div className="panel-head">
          Dead — no soft-revive ({R2_DEAD.length})
          <span className="ml-2 font-mono text-xs font-normal text-parch-300">
            quill · grove · crucible · ash · oracle · ember · bastion · vault
          </span>
        </div>
        <FighterTable rows={R2_DEAD} dead />
      </section>

      <p className="text-xs text-parch-300">
        Kill order{" "}
        <code className="font-mono text-parch-100">
          src/concepts/tasks-density/gallery-war/r2/kill-order.md
        </code>
        {" · R3 must-fix "}
        <code className="font-mono text-parch-100">
          src/concepts/tasks-density/gallery-war/r3/mustfix.md
        </code>
        {" · scores "}
        <code className="font-mono text-parch-100">
          src/concepts/tasks-density/gallery-war/r2/scores.json
        </code>
      </p>
    </div>
  );
}
