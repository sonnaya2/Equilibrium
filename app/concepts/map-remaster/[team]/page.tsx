import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/Heading";
import { MapRemasterArena } from "@/concepts/map-remaster/MapRemasterArena";
import {
  getMapRemasterTeam,
  isMapRemasterTeamId,
  MAP_REMASTER_TEAMS,
} from "@/concepts/map-remaster/teams";

type Props = { params: Promise<{ team: string }> };

export async function generateStaticParams() {
  return MAP_REMASTER_TEAMS.map((t) => ({ team: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { team } = await params;
  const meta = getMapRemasterTeam(team);
  return {
    title: meta ? `${meta.codename} · Map remaster` : "Map remaster",
    robots: { index: false, follow: false },
  };
}

export default async function MapRemasterTeamPage({ params }: Props) {
  const { team } = await params;
  if (!isMapRemasterTeamId(team)) notFound();
  const meta = getMapRemasterTeam(team)!;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading title={meta.codename} note={`${meta.name} · ${meta.thesis}`} />
      <p className="mb-4 text-sm text-parch-100">
        <Link href="/concepts/map-remaster" className="text-gem-300 hover:underline">
          ← Tournament arena
        </Link>
        {" · agents "}
        <span className="font-mono text-xs text-parch-300">{meta.agents.join(" · ")}</span>
      </p>
      <MapRemasterArena initialTeam={team} />
    </div>
  );
}
