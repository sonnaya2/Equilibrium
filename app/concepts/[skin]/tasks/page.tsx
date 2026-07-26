import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/Heading";
import { TaskRecords } from "@/components/TaskRecords";
import { ConceptPage } from "@/concepts/live/ConceptPage";
import { loadConceptTasks } from "@/concepts/live/tasksData";
import { getLiveSkin, isLiveSkinId, LIVE_CONCEPTS } from "@/concepts/skins/registry";

export async function generateStaticParams() {
  return LIVE_CONCEPTS.map((s) => ({ skin: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ skin: string }>;
}): Promise<Metadata> {
  const { skin } = await params;
  const meta = getLiveSkin(skin);
  return {
    title: meta ? `Tasks · ${meta.label}` : "Tasks concept",
    robots: { index: false, follow: false },
  };
}

export default async function ConceptTasksPage({
  params,
}: {
  params: Promise<{ skin: string }>;
}) {
  const { skin: raw } = await params;
  if (!isLiveSkinId(raw)) notFound();
  const meta = getLiveSkin(raw)!;
  const t = await loadConceptTasks();

  return (
    <ConceptPage>
      {t.useCatalystStandIn ? (
        <div className="mb-2">
          <span className="tag text-chaos-300">Provisional · Catalyst</span>
        </div>
      ) : null}
      <PageHeading
        title="Tasks"
        note={`${meta.label} · ${t.records.length} real rows`}
      />
      <TaskRecords
        records={t.records}
        tiers={t.tiers}
        tierConfidence={t.tierConfidence}
        tasksWikiUrl={t.tasksWikiUrl}
        completionLive={t.completionLive}
      />
    </ConceptPage>
  );
}
