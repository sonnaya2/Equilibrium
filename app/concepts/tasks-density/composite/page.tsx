import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { loadConceptTasks } from "@/concepts/live/tasksData";
import { CompositePreview } from "@/concepts/tasks-density/r2/CompositePreview";

export const metadata: Metadata = {
  title: "Tasks density · R2 Composite",
  robots: { index: false, follow: false },
};

export default async function TasksDensityCompositePage() {
  const data = await loadConceptTasks();
  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <PageHeading
          title="R2 Composite"
          note="CEO must-fix: full-width · 28px rows · one region band · collapsible detail. Pass bar 9.0."
        />
        <Link href="/concepts/tasks-density" className="text-xs text-gem-300 hover:underline">
          ← Arena
        </Link>
      </div>
      <CompositePreview
        records={data.records}
        tiers={data.tiers}
        tierConfidence={data.tierConfidence}
        tasksWikiUrl={data.tasksWikiUrl}
        completionLive={data.completionLive}
      />
    </div>
  );
}
