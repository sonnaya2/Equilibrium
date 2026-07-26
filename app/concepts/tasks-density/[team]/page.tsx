import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/Heading";
import { loadConceptTasks } from "@/concepts/live/tasksData";
import {
  getTasksDensityTeam,
  isTasksDensityTeamId,
  TASKS_DENSITY_TEAMS,
} from "@/concepts/tasks-density/teams";
import { TasksDensityTeamMount } from "@/concepts/tasks-density/TasksDensityTeamMount";

export function generateStaticParams() {
  return TASKS_DENSITY_TEAMS.map((t) => ({ team: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team } = await params;
  const meta = getTasksDensityTeam(team);
  return {
    title: meta ? `Tasks density · ${meta.codename}` : "Tasks density",
    robots: { index: false, follow: false },
  };
}

export default async function TasksDensityTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: raw } = await params;
  if (!isTasksDensityTeamId(raw)) notFound();
  const meta = getTasksDensityTeam(raw)!;
  const data = await loadConceptTasks();

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <PageHeading
          title={meta.codename}
          note={`${meta.name} · ${meta.thesis}`}
        />
        <Link href="/concepts/tasks-density" className="text-xs text-gem-300 hover:underline">
          ← Arena
        </Link>
      </div>
      {data.useCatalystStandIn ? (
        <p className="mb-2 text-[11px] text-chaos-300">Provisional · Catalyst · real snapshot</p>
      ) : null}
      <TasksDensityTeamMount
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
