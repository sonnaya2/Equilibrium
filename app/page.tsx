import type { Metadata } from "next";
import tasksData from "#shard/league/tasks.json";
import { Page } from "@/components/Page";
import { OverviewPlan } from "@/components/OverviewPlan";
import { getResearchCatalogIndex } from "@/research/catalog";

export const metadata: Metadata = {
  title: { absolute: "RS3 Equilibrium" },
};

function taskListTotal(): number {
  const records = (tasksData as { records?: unknown[] }).records;
  if (Array.isArray(records) && records.length > 0) return records.length;
  const fallback = (
    tasksData as {
      testFallback?: { enabled?: boolean; expectedRecords?: number };
    }
  ).testFallback;
  if (fallback?.enabled && typeof fallback.expectedRecords === "number") {
    return fallback.expectedRecords;
  }
  return 0;
}

function catalogRegionCount(): number {
  return getResearchCatalogIndex().regions.length;
}

export default function OverviewPage() {
  return (
    <Page className="!max-w-none !px-0 !py-0">
      <OverviewPlan taskTotal={taskListTotal()} catalogCount={catalogRegionCount()} />
    </Page>
  );
}
