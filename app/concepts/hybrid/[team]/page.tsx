import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HYBRID_TEAMS, type HybridTeamId } from "@/concepts/hybrid/teams";
import { HybridTeamBleed } from "@/concepts/hybrid/HybridTeamBleed";

const IDS = new Set(HYBRID_TEAMS.map((t) => t.id));

export function generateStaticParams() {
  return HYBRID_TEAMS.map((t) => ({ team: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team } = await params;
  const meta = HYBRID_TEAMS.find((t) => t.id === team);
  return {
    title: meta ? `${meta.codename} · Hybrid` : "Hybrid team",
    robots: { index: false, follow: false },
  };
}

export default async function HybridTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: raw } = await params;
  if (!IDS.has(raw as HybridTeamId)) notFound();
  const meta = HYBRID_TEAMS.find((t) => t.id === raw)!;

  return (
    <div className="flex min-h-screen flex-col bg-stone-950">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-4 py-2 text-xs text-parch-100">
        <Link href="/concepts/hybrid" className="text-gem-300 hover:underline">
          ← Hybrid arena
        </Link>
        <span className="font-medium text-parch-50">
          {meta.name} · {meta.codename}
        </span>
        <nav className="ml-auto flex flex-wrap gap-1">
          {HYBRID_TEAMS.map((t) => (
            <Link
              key={t.id}
              href={`/concepts/hybrid/${t.id}`}
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
      <HybridTeamBleed team={raw as HybridTeamId} />
    </div>
  );
}
