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
  description:
    "League tasks and points for RS3 Leagues II: Equilibrium. Catalyst stand-in until Equilibrium list publishes.",
};

export const revalidate = 3600;

const TASK_ORDER = ["easy", "medium", "hard", "elite", "master"] as const;

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
    ? testFallback?.url ?? CATALYST_TASKS_URL
    : tasksData.source.url;

  const pointsLine = TASK_ORDER.map((t) => `${t[0].toUpperCase()}${tasksData.tiers[t] ?? "?"}`).join(
    " · ",
  );

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill">
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-parch-100">
          {useCatalystStandIn ? (
            <span className="tag text-chaos-300">Provisional · Catalyst</span>
          ) : null}
          <span className="font-medium text-parch-50">Tasks</span>
          <span className="font-mono text-parch-300">
            {records.length} tasks loaded
            {completion.live ? " · Comp% live" : useCatalystStandIn ? " · Comp% snap" : ""}
          </span>
          <span className="text-parch-300">
            <span>Points</span> {pointsLine}
          </span>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-gem-300 hover:underline"
          >
            Source
          </a>
        </div>

        <TaskRecords
          records={records}
          tiers={tasksData.tiers}
          tierConfidence={tasksData.tierConfidence}
          tasksWikiUrl={useCatalystStandIn ? CATALYST_TASKS_URL : tasksData.source.url}
          completionLive={completion.live}
        />

        {records.length === 0 ? (
          <p className="mt-2 text-sm text-parch-300">
            {useCatalystStandIn && catalystResult.error
              ? `Catalyst list failed: ${catalystResult.error}`
              : (tasksData.note ??
                taskUnknown?.known ??
                "No tasks loaded yet.")}
          </p>
        ) : null}
      </div>
    </Page>
  );
}
