import type { Metadata } from "next";
import tasksData from "#data/league/tasks.json";
import unknownsData from "#data/reference/unknowns.json";
import { Page } from "@/components/Page";
import { TaskRecords } from "@/components/TaskRecords";
import {
  applyCompletionRates,
  CATALYST_TASKS_URL,
  fetchCatalystCompletionRates,
  loadCatalystSnapshot,
} from "@/tasks/catalyst";

export const metadata: Metadata = {
  title: "Tasks",
};

export const revalidate = 3600;

type UnknownItem = {
  key: string;
  known?: string;
  missing?: string[];
};

const testFallback = (
  tasksData as {
    testFallback?: {
      enabled: boolean;
      url: string;
      note: string;
      expectedRecords: number;
      completionSource?: string;
      league?: string;
      testingOnly?: boolean;
    };
  }
).testFallback;

export default async function TasksPage() {
  const taskUnknown = (unknownsData.items as UnknownItem[]).find(
    (item) => item.key === "equilibrium_tasks",
  );
  const useCatalystStandIn = tasksData.records.length === 0 && testFallback?.enabled === true;
  const catalystResult = useCatalystStandIn
    ? loadCatalystSnapshot(testFallback?.expectedRecords)
    : { records: [] as ReturnType<typeof loadCatalystSnapshot>["records"], error: undefined };
  const baseRecords = useCatalystStandIn ? catalystResult.records : tasksData.records;

  const completion = useCatalystStandIn
    ? await fetchCatalystCompletionRates()
    : { rates: null, live: false };
  const records = useCatalystStandIn
    ? applyCompletionRates(catalystResult.records, completion.rates)
    : baseRecords;

  const sourceUrl = useCatalystStandIn
    ? (testFallback?.url ?? CATALYST_TASKS_URL)
    : tasksData.source.url;

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill">
        <TaskRecords
          records={records}
          tiers={tasksData.tiers}
          tierConfidence={tasksData.tierConfidence}
          tasksWikiUrl={useCatalystStandIn ? CATALYST_TASKS_URL : tasksData.source.url}
          completionLive={completion.live}
          dataset={{
            label: useCatalystStandIn ? (testFallback?.league ?? "Catalyst League") : "Equilibrium",
            testingOnly: useCatalystStandIn && testFallback?.testingOnly === true,
            provisional: useCatalystStandIn,
            sourceUrl,
            wikiSyncSupported: useCatalystStandIn,
            verifiedAt: tasksData.source.verifiedAt,
            note: useCatalystStandIn ? testFallback?.note : tasksData.note,
          }}
          emptyMessage={
            useCatalystStandIn && catalystResult.error
              ? `Catalyst list failed: ${catalystResult.error}`
              : (tasksData.note ?? taskUnknown?.known ?? "No tasks loaded.")
          }
        />
      </div>
    </Page>
  );
}
