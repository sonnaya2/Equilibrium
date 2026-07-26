import type { Metadata } from "next";
import tasksData from "#data/league/tasks.json";
import catalogData from "#data/research/catalog.json";
import { Page } from "@/components/Page";
import { OverviewCourtyard } from "@/components/OverviewCourtyard";

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
  const regions = (catalogData as { regions?: unknown[] }).regions;
  return Array.isArray(regions) ? regions.length : 0;
}

/** Overview is the courtyard gate only — champion DNA, not a status blog. */
export default function OverviewPage() {
  return (
    <Page className="!max-w-none !px-0 !py-0">
      <OverviewCourtyard taskTotal={taskListTotal()} catalogCount={catalogRegionCount()} />
    </Page>
  );
}
