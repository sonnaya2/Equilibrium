import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TEAMS, type TeamId } from "@/concepts/restoration/teams";
import { TeamFullBleed } from "@/concepts/restoration/TeamFullBleed";

const IDS = new Set(TEAMS.map((t) => t.id));

export function generateStaticParams() {
  return TEAMS.map((t) => ({ team: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team } = await params;
  const meta = TEAMS.find((t) => t.id === team);
  return {
    title: meta ? `${meta.codename} · Restoration` : "Restoration team",
    robots: { index: false, follow: false },
  };
}

export default async function RestorationTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: raw } = await params;
  if (!IDS.has(raw as TeamId)) notFound();
  const meta = TEAMS.find((t) => t.id === raw)!;

  return (
    <div className="flex min-h-screen flex-col bg-stone-950">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-4 py-2 text-xs text-parch-100">
        <Link href="/concepts/restoration" className="text-gem-300 hover:underline">
          ← All restoration skins
        </Link>
        <span className="text-parch-400">·</span>
        <span className="font-medium text-parch-50">
          {meta.name} · {meta.codename}
        </span>
        <span className="hidden text-parch-300 sm:inline">· {meta.thesis}</span>
        <nav className="ml-auto flex flex-wrap gap-1" aria-label="Switch restoration skin">
          {TEAMS.map((t) => (
            <Link
              key={t.id}
              href={`/concepts/restoration/${t.id}`}
              className={`border px-2 py-1 ${
                t.id === raw
                  ? "border-gem-500 text-gem-300"
                  : "border-stone-750 text-parch-100 hover:border-stone-carve"
              }`}
            >
              {t.codename}
            </Link>
          ))}
        </nav>
      </div>
      <TeamFullBleed team={raw as TeamId} />
    </div>
  );
}
