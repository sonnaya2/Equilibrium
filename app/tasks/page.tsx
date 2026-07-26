import type { Metadata } from "next";
import tasksData from "#data/league/tasks.json";
import unknownsData from "#data/reference/unknowns.json";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { TaskRecords } from "@/components/TaskRecords";
import { loadCatalystSnapshot } from "@/tasks/catalyst";

export const metadata: Metadata = {
  title: "Tasks",
  description:
    "Track League tasks and points for RS3 Leagues II: Equilibrium. Provisional Catalyst list until Equilibrium tasks publish. Ironman / self-sufficient play only.",
};

const TASK_ORDER = ["easy", "medium", "hard", "elite", "master"] as const;

type UnknownItem = {
  key: string;
  known?: string;
  missing?: string[];
};

/**
 * Catalyst stand-in while Equilibrium has published no tasks of its own.
 * Product path is the static snapshot (data/league/catalyst-tasks-snapshot.json),
 * not a live wiki scrape. Refresh: node scripts/refresh-catalyst-snapshot.mjs
 */
const testFallback = (
  tasksData as {
    testFallback?: {
      enabled: boolean;
      url: string;
      note: string;
      expectedRecords: number;
    };
  }
).testFallback;

export default function TasksPage() {
  const taskUnknown = (unknownsData.items as UnknownItem[]).find((item) => item.key === "equilibrium_tasks");
  const useCatalystStandIn = tasksData.records.length === 0 && testFallback?.enabled === true;
  const catalystResult = useCatalystStandIn
    ? loadCatalystSnapshot(testFallback?.expectedRecords)
    : { records: [] as typeof tasksData.records, error: undefined };
  const records = useCatalystStandIn ? catalystResult.records : tasksData.records;
  const sourceUrl = useCatalystStandIn ? testFallback?.url ?? tasksData.source.url : tasksData.source.url;
  const sourceLabel = useCatalystStandIn ? "Catalyst task source (static snapshot)" : "Jagex reveal";

  return (
    <Page>
      {useCatalystStandIn ? (
        <div className="mb-2">
          <span className="tag text-chaos-300">Provisional · Catalyst tasks</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          title="Tasks"
          note={
            useCatalystStandIn
              ? (testFallback?.note ??
                "Showing Catalyst League tasks for now. This list will be replaced when the full Equilibrium task list is published.")
              : tasksData.pointValueNote
          }
        />
        <div className="flex gap-3 pt-1">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
          >
            {sourceLabel}
          </a>
          {useCatalystStandIn ? (
            <a
              href={tasksData.source.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-parch-300 underline decoration-stone-750 underline-offset-4 hover:text-parch-50 hover:decoration-parch-300"
            >
              Equilibrium reveal
            </a>
          ) : null}
        </div>
      </div>
      {useCatalystStandIn ? (
        <p className="-mt-4 mb-6 max-w-3xl text-xs leading-5 text-parch-400">
          Static snapshot of the Catalyst task list (ironman / no-trade play). Comp% is historical
          Catalyst completion on the Wiki. Equilibrium will replace this when published.
        </p>
      ) : null}

      <section className="border-b border-stone-750 py-5">
        <h2 className="text-sm font-medium text-parch-50">Points</h2>
        <div className="mt-2 grid border-t border-stone-750 sm:grid-cols-5">
          {TASK_ORDER.map((tier, index) => (
            <div
              key={tier}
              className={`py-3 sm:px-3 ${index > 0 ? "border-t border-stone-750 sm:border-l sm:border-t-0" : ""}`}
            >
              <div className="text-xs capitalize text-parch-300">{tier}</div>
              <div className="mt-1 font-mono text-lg text-parch-50">{tasksData.tiers[tier]}</div>
              {!useCatalystStandIn && tasksData.tierConfidence[tier]?.startsWith("provisional") ? (
                <div className="mt-1 text-[11px] text-parch-400">provisional</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-parch-50">Task list</h2>
          <span className="text-xs text-parch-300">
            {records.length} tasks loaded
            {useCatalystStandIn ? ` · static Catalyst snapshot` : ""}
          </span>
        </div>
        <div className="mt-2 border-t border-stone-750">
          {records.length === 0 ? (
            <>
              {useCatalystStandIn && catalystResult.error ? (
                <p className="border-b border-stone-750/70 py-3 text-sm leading-6 text-chaos-300">
                  Catalyst task list could not be loaded: {catalystResult.error}
                </p>
              ) : null}
              <p className="border-b border-stone-750/70 py-3 text-sm leading-6 text-parch-300">
                {tasksData.note}
              </p>
              {taskUnknown?.known ? (
                <p className="border-b border-stone-750/70 py-3 text-sm leading-6 text-parch-300">
                  {taskUnknown.known}
                </p>
              ) : null}
              {taskUnknown?.missing?.length ? (
                <div className="border-b border-stone-750/70 py-3">
                  <div className="text-xs text-parch-300">Waiting on</div>
                  <div className="mt-1 text-sm leading-6 text-parch-50">
                    {taskUnknown.missing.join(" · ")}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="py-3">
              <TaskRecords
                records={records}
                tiers={tasksData.tiers}
                tierConfidence={useCatalystStandIn ? {} : tasksData.tierConfidence}
              />
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}
