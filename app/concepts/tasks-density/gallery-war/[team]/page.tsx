import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/Heading";
import { loadConceptTasks } from "@/concepts/live/tasksData";
import { GalleryWarMount } from "@/concepts/tasks-density/gallery-war/GalleryWarMount";
import {
  GALLERY_WAR_TEAMS,
  getGalleryWarTeam,
  isGalleryWarId,
} from "@/concepts/tasks-density/gallery-war/teams";

export function generateStaticParams() {
  return GALLERY_WAR_TEAMS.map((t) => ({ team: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team } = await params;
  const meta = getGalleryWarTeam(team);
  return {
    title: meta ? `Gallery War · ${meta.codename}` : "Gallery War",
    robots: { index: false, follow: false },
  };
}

export default async function GalleryWarTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: raw } = await params;
  if (!isGalleryWarId(raw)) notFound();
  const meta = getGalleryWarTeam(raw)!;
  const data = await loadConceptTasks();

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <PageHeading title={meta.codename} note={`${meta.id} · ${meta.thesis}`} />
        <Link
          href="/concepts/tasks-density/gallery-war"
          className="text-xs text-gem-300 hover:underline"
        >
          ← War arena
        </Link>
      </div>
      <GalleryWarMount
        teamId={raw}
        records={data.records}
        tiers={data.tiers}
        tierConfidence={data.tierConfidence}
        tasksWikiUrl={data.tasksWikiUrl}
        completionLive={data.completionLive}
      />
    </div>
  );
}
